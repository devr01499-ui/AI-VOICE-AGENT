import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * The Integrations page must show the real Google Calendar state. The server reply uses the
 * standard { success, data } envelope (it used to omit it, so the page always said "disconnected").
 */
test('a connected Google Calendar shows as connected with its account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/calendar/status': (route) => ok(route, { connected: true, status: 'healthy', googleEmail: 'owner.calendar@example.org', lastCheckedAt: new Date().toISOString() }),
  });
  await page.goto('/dashboard/integrations');
  await expect(page.getByText('owner.calendar@example.org')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Google Calendar is not connected/i)).toHaveCount(0);
});

test('a disconnected Google Calendar shows as not connected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/calendar/status': (route) => ok(route, { connected: false, status: 'disconnected', message: 'Google Calendar is not connected.' }),
  });
  await page.goto('/dashboard/integrations');
  await expect(page.getByText('owner.calendar@example.org')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Connect/i }).first()).toBeVisible({ timeout: 30_000 });
});
