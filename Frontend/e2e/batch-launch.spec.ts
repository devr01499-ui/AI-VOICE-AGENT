import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B10 — after launching a campaign the screen shows how many contacts the SERVER accepted
 * and why the rest were skipped (invalid / duplicate / opted out), not the raw CSV row count.
 */
test('the launch banner shows accepted contacts and the skipped breakdown', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const agent = { id: '33333333-4444-4555-8666-777777777777', name: 'Sales Agent', agentType: 'prompt', type: 'prompt', status: 'active', systemPrompt: 'x', agentConfig: '{}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const seen = await stubBackend(page, {
    '/api/v2/calendar/batches': (route) => route.request().method() === 'POST'
      ? ok(route, { id: 'batch-1', name: 'Diwali offer', status: 'running', total: 2, totalContacts: 2, skipped: { invalid: 1, duplicates: 1, optedOut: 0 } })
      : ok(route, []),
    '/api/v2/numbers': (route) => ok(route, [{ id: 'num-1', phoneNumber: '+918045671234', status: 'active' }]),
    '/api/v2/agents': (route) => ok(route, [agent]),
  });
  await page.goto('/dashboard/batch');
  await page.getByRole('button', { name: 'New campaign' }).click({ timeout: 30_000 });
  const csv = 'phone,name\n9812345678,Asha\n+919812345678,Asha again\n12345,Bad\n7012345678,Ravi\n';
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({ name: 'contacts.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: /Review & Launch/ }).click();
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: /Confirm & Start Batch/ }).click();
  const banner = page.getByTestId('batch-launched');
  await expect(banner).toContainText('Batch started: 2 contacts');
  await expect(banner).toContainText('Skipped: 1 invalid (Indian mobiles only), 1 duplicates, 0 opted out.');
  expect(seen.some((r) => r.method === 'POST' && r.url.includes('/calendar/batches'))).toBe(true);
});
