import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B7 / audit A9 — the conversational flow builder reopens exactly as it was saved and saves
 * every setting it shows:
 *  - the global prompt is only the user's text (the whole compiled prompt used to be loaded into it,
 *    so every save nested another copy);
 *  - direction, voice, language, flexibility, speech and transcription settings reload and save;
 *  - each branch of a Logic Split can be named, and unnamed branches block saving;
 *  - knowledge bases attach to the agent on the server (the toggle used to change nothing);
 *  - nodes that do nothing on a live call (Code, MCP, Subagent) are marked Soon.
 */

const GLOBAL = 'You work for Lotus Dental Clinic in Pune.';
const COMPILED = `${GLOBAL}\n\n# AGENT IDENTITY & ROLE\nYou are an autonomous AI voice agent (Lotus Flow) for Claritiy Voice operating under a visual multi-step conversational flow graph.\n\n[AGENT HANDBOOK INSTRUCTIONS]\n- Disclose AI.`;

const AGENT = {
  id: '22222222-3333-4444-8555-666666666666',
  name: 'Lotus Flow',
  description: null,
  agentType: 'conversational',
  type: 'conversational',
  status: 'active',
  version: 1,
  workspaceId: null,
  model: 'gemini-2.5-flash-native-audio-latest',
  voiceName: 'Kore',
  systemVoice: 'Kore',
  temperature: 0.7,
  systemPrompt: COMPILED,
  flowGraph: {
    schemaVersion: 1,
    nodes: [
      { id: 'n1', type: 'conversation', position: { x: 300, y: 80 }, data: { label: 'Welcome', text: 'Namaste!' } },
      { id: 'n2', type: 'logicSplit', position: { x: 300, y: 260 }, data: { label: 'Intent Split', variable: 'user_intent' } },
      { id: 'n3', type: 'askQuestion', position: { x: 120, y: 440 }, data: { label: 'Book', question: 'Which day suits you?' } },
      { id: 'n4', type: 'ending', position: { x: 480, y: 440 }, data: { label: 'Goodbye', text: 'Thank you!' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3', label: 'wants an appointment' },
      { id: 'e3', source: 'n2', target: 'n4' },
    ],
  },
  agentConfig: JSON.stringify({
    flexibilityMode: 'flex',
    handbookPresets: ['ai_disclosure'],
    speechSettings: { speed: 1.2, responsivenessMs: 800, interruptionSensitivity: 'LOW', backchanneling: true, volume: 1.0 },
    transcriptionSettings: { boostedKeywords: ['Lotus', 'Pune'] },
  }),
  languageMode: 'hi-IN',
  direction: 'inbound',
  industry: 'other',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const KBS = [
  { id: 'kb-1', name: 'Clinic FAQ', agentIds: [], createdAt: new Date().toISOString(), sizeChars: 1200, status: 'ready' },
  { id: 'kb-2', name: 'Price list', agentIds: [AGENT.id], createdAt: new Date().toISOString(), sizeChars: 800, status: 'ready' },
];

async function openFlowBuilder(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    '/api/v2/knowledge-base/kb-1/assign': (route) => ok(route, { assigned: true }),
    '/api/v2/knowledge-base': (route) => ok(route, KBS),
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await expect(page.getByPlaceholder('Enter your global prompt here. Type {{ to add dynamic variables.')).toBeVisible();
  return seen;
}

test('a saved flow reopens with its own settings, not defaults', async ({ page }) => {
  await openFlowBuilder(page);
  // Only the user's text, not the compiled flow (which nested a copy on every save).
  await expect(page.getByPlaceholder('Enter your global prompt here. Type {{ to add dynamic variables.')).toHaveValue(GLOBAL);
  await expect(page.getByTitle('Call Direction')).toHaveValue('inbound');
  await expect(page.getByRole('button', { name: /Knowledge Base \(1\)/ })).toBeVisible();
});

test('saving sends every setting and named branches; unnamed branches block saving', async ({ page }) => {
  const seen = await openFlowBuilder(page);

  await page.locator('.react-flow__node[data-id="n2"]').click();
  await page.getByTestId('branch-label-e3').fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Name every branch of "Intent Split"/)).toBeVisible();
  expect(seen.filter((r) => r.method === 'PUT')).toHaveLength(0);

  await page.getByTestId('branch-label-e3').fill('only has a billing question');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => seen.filter((r) => r.method === 'PUT').length).toBe(1);

  const body = seen.find((r) => r.method === 'PUT')!.body;
  expect(body.direction).toBe('inbound');
  expect(body.languageMode).toBe('hi-IN');
  expect(body.voiceName).toBe('Kore');
  expect(body.agentConfig.flowSettings).toEqual({ globalPrompt: GLOBAL, flexibilityMode: 'flex', handbookPresets: ['ai_disclosure'] });
  expect(body.agentConfig.speechSettings).toMatchObject({ speed: 1.2, responsivenessMs: 800, interruptionSensitivity: 'LOW', backchanneling: true });
  expect(body.agentConfig.transcriptionSettings).toEqual({ boostedKeywords: ['Lotus', 'Pune'] });
  // The prompt holds the global prompt exactly once.
  expect(body.systemPrompt.split(GLOBAL).length - 1).toBe(1);
  const edges = body.flowGraph.edges.map((e: any) => [e.id, e.label]);
  expect(edges).toEqual([['e1', undefined], ['e2', 'wants an appointment'], ['e3', 'only has a billing question']]);
  expect(body.systemPrompt).toContain('only has a billing question');
});

test('attaching a knowledge base saves the assignment on the server', async ({ page }) => {
  const seen = await openFlowBuilder(page);
  await page.getByRole('button', { name: /Knowledge Base \(1\)/ }).click();
  await page.getByTestId('flow-kb-kb-1').click();
  await expect(page.getByRole('button', { name: /Knowledge Base \(2\)/ })).toBeVisible();
  const assign = seen.find((r) => r.url.includes('/knowledge-base/kb-1/assign'));
  expect(assign?.method).toBe('POST');
  expect(assign?.body).toEqual({ agentId: AGENT.id });
});

test('nodes that do nothing on a live call are marked Soon and cannot be added', async ({ page }) => {
  await openFlowBuilder(page);
  for (const label of ['Code', 'MCP', 'Subagent']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()).toBeDisabled();
  }
});
