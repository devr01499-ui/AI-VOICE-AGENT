import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B14 — the agent editor has a "Record calls" switch (there was none, so recording could
 * never be turned on). It saves with the agent and reloads.
 */
const AGENT = {
  id: '55555555-6666-4777-8888-999999999999', name: 'Recorded Agent', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You answer questions for Lotus Dental.', flowGraph: null, languageMode: 'auto', direction: 'inbound', industry: 'other',
  agentConfig: JSON.stringify({ callSettings: { recordingEnabled: false } }),
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

test('Record calls can be switched on and is saved with the agent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: /Call Settings/ }).click();
  const toggle = page.getByTestId('recording-enabled');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => seen.filter((r) => r.method === 'PUT').length).toBeGreaterThan(0);
  const body = seen.filter((r) => r.method === 'PUT').pop()!.body;
  const cfg = typeof body.agentConfig === 'string' ? JSON.parse(body.agentConfig) : body.agentConfig;
  expect(cfg.callSettings.recordingEnabled).toBe(true);
});
