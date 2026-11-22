import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Owner report 2026-11-22: "users can't open agents through the Edit Studio button".
 * The agent list can come from the browser cache while the server fails; Edit Studio then loads
 * the full agent, and a failed load was swallowed: the click did nothing. Now the page says what
 * went wrong, and a working load still opens the editor.
 */
const AGENT = {
  id: '77777777-1111-4222-8333-444444444444', name: 'Clinic Receptionist', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You are the receptionist of a dental clinic.', flowGraph: null, agentConfig: '{}', languageMode: 'auto',
  direction: 'inbound', industry: 'other', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const SESSION_ERROR = 'We could not verify your session. Please refresh the page; if this keeps happening, contact support with reference AUTH-TRACE-1795370858084.';

test('Edit Studio: a failed agent load shows a clear message instead of doing nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    [`/api/v2/agents/${AGENT.id}`]: (route) => json(route, 500, { success: false, error: SESSION_ERROR }),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  const alert = page.getByTestId('studio-open-error');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('We could not open "Clinic Receptionist"');
  await expect(alert).toContainText('AUTH-TRACE-1795370858084');
  await expect(page.getByRole('button', { name: 'Edit Studio' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/edit-studio-open-error-1440.png' });
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(alert).toBeHidden();
});

test('Edit Studio: a working load still opens the editor (and the error does not linger)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsTestUser(page);
  let fail = true;
  await stubBackend(page, {
    [`/api/v2/agents/${AGENT.id}`]: (route) => (fail ? json(route, 404, { success: false, error: 'Agent not found' }) : ok(route, AGENT)),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await expect(page.getByTestId('studio-open-error')).toContainText('Agent not found');
  await page.screenshot({ path: 'test-results/edit-studio-open-error-390.png' });
  fail = false;
  await page.getByRole('button', { name: 'Edit Studio' }).click();
  await expect(page.locator('textarea').first()).toHaveValue('You are the receptionist of a dental clinic.');
});
