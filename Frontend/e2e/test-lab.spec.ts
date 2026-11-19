import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Issue B5 — Test Lab runs the saved agent against simulated callers and shows real results:
 * scores, issues, transcripts, and saved history. (The old screen never showed results because
 * it expected a field the server did not send.)
 */

const AGENT = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Lotus Booking',
  description: null,
  agentType: 'prompt',
  type: 'prompt',
  status: 'active',
  version: 1,
  workspaceId: null,
  model: null,
  voiceName: null,
  temperature: 0.7,
  systemPrompt: 'You are Meera, the booking assistant for Lotus Yoga Studio.',
  flowGraph: null,
  agentConfig: '{}',
  languageMode: 'auto',
  direction: 'outbound',
  industry: 'other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const RUN = {
  runId: '99999999-0000-4000-8000-000000000001',
  agentId: AGENT.id,
  agentName: AGENT.name,
  passed: false,
  averageScore: 72,
  model: 'gemini-3.6-flash',
  createdAt: new Date().toISOString(),
  results: [
    {
      persona: 'angry', name: 'Upset caller', status: 'completed', passed: false, score: 55,
      dimensionScores: { objectionHandling: 70, accuracy: 80, compliance: 0, nextStep: 60, tone: 65 },
      issues: ['Compliance: did not clearly honour the request to stop calling (TRAI/DND).'],
      transcript: [
        { speaker: 'customer', text: 'Stop calling me. Remove my number right now.' },
        { speaker: 'agent', text: 'But you will love our classes!' },
      ],
    },
    {
      persona: 'rushed', name: 'Busy caller', status: 'completed', passed: true, score: 89,
      dimensionScores: { objectionHandling: 88, accuracy: 92, compliance: 95, nextStep: 85, tone: 85 },
      issues: [], transcript: [{ speaker: 'customer', text: 'I have one minute.' }, { speaker: 'agent', text: 'Classes are 500 rupees. Shall I book one?' }],
    },
    { persona: 'hinglish_speaker', name: 'Hinglish caller', status: 'error', passed: false, score: 0, dimensionScores: null, issues: [], transcript: [], error: 'This caller could not be simulated right now. Run the test again.' },
  ],
};

async function openTestLab(page: Page, testLab: (route: any) => unknown, history: unknown[] = []) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    [`/api/v2/agents/${AGENT.id}/test-lab/runs/${RUN.runId}`]: (route) => ok(route, RUN),
    [`/api/v2/agents/${AGENT.id}/test-lab/runs`]: (route) => ok(route, history),
    [`/api/v2/agents/${AGENT.id}/test-lab`]: testLab,
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Test Lab', exact: true }).click();
  await expect(page.getByTestId('test-lab-panel')).toBeVisible();
  return seen;
}

test('running Test Lab shows scores, failures, transcripts and an incomplete caller', async ({ page }) => {
  const seen = await openTestLab(page, (route) => ok(route, RUN));
  await page.getByRole('button', { name: 'Run Test Lab' }).click();

  await expect(page.getByTestId('test-lab-results')).toBeVisible();
  await expect(page.getByText('72 / 100')).toBeVisible();
  await expect(page.getByText('NEEDS WORK')).toBeVisible();
  await expect(page.getByTestId('test-lab-persona')).toHaveCount(3);
  await expect(page.getByText(/did not clearly honour the request to stop calling/)).toBeVisible();
  await expect(page.getByText('Not completed')).toBeVisible();

  const angry = page.getByTestId('test-lab-persona').filter({ hasText: 'Upset caller' });
  await angry.getByRole('button', { name: 'Show conversation' }).click();
  await expect(angry.getByTestId('test-lab-transcript')).toContainText('But you will love our classes!');

  const req = seen.find((r) => r.method === 'POST' && r.url.endsWith(`/api/v2/agents/${AGENT.id}/test-lab`))!;
  expect(req.body.personas.sort()).toEqual(['angry', 'hesitant', 'hinglish_speaker', 'price_sensitive', 'rushed']);
});

test('only the chosen callers are tested', async ({ page }) => {
  const seen = await openTestLab(page, (route) => ok(route, RUN));
  for (const label of ['Hesitant', 'Price-sensitive', 'Busy', 'Hinglish']) {
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Run Test Lab' }).click();
  await expect(page.getByTestId('test-lab-results')).toBeVisible();
  const req = seen.find((r) => r.method === 'POST' && r.url.endsWith('/test-lab'))!;
  expect(req.body.personas).toEqual(['angry']);
});

test('with no caller chosen the run button is disabled', async ({ page }) => {
  await openTestLab(page, (route) => ok(route, RUN));
  for (const label of ['Hesitant', 'Price-sensitive', 'Upset / opt-out', 'Busy', 'Hinglish']) {
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Run Test Lab' })).toBeDisabled();
});

test('a server error is shown clearly', async ({ page }) => {
  await openTestLab(page, (route) => json(route, 503, { success: false, error: 'Test Lab is temporarily unavailable. Please try again shortly.' }));
  await page.getByRole('button', { name: 'Run Test Lab' }).click();
  await expect(page.getByRole('alert')).toHaveText(/temporarily unavailable/);
});

test('previous runs are listed and can be reopened', async ({ page }) => {
  await openTestLab(page, (route) => ok(route, RUN), [{ runId: RUN.runId, passed: false, averageScore: 72, personaCount: 3, createdAt: RUN.createdAt }]);
  const history = page.getByTestId('test-lab-history');
  await expect(history).toContainText('72/100');
  await history.getByRole('button').first().click();
  await expect(page.getByTestId('test-lab-results')).toBeVisible();
  await expect(page.getByTestId('test-lab-persona')).toHaveCount(3);
});

test('the Knowledge Base badge counts attached knowledge bases without opening the section (A14)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/knowledge-base': (route) => ok(route, [
      { id: 'kb-1', name: 'Price list', agentIds: [AGENT.id], status: 'ready' },
      { id: 'kb-2', name: 'FAQ', agentIds: [AGENT.id], status: 'ready' },
      { id: 'kb-3', name: 'Other agent docs', agentIds: ['someone-else'], status: 'ready' },
    ]),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Knowledge Base \(2\)/ })).toBeVisible({ timeout: 15_000 });
});
