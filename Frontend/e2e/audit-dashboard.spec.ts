import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Audit fixes on dashboard screens (docs/AUDIT_FINDINGS.md):
 *  #81/#82/#97 Settings no longer shows browser-only controls that did nothing (workspace webhooks tab,
 *              recording/transcription/sentiment/summary switches, default number, billing email).
 *  #83/#84     Campaign KPIs read the server's `failed` and `connected` counts (Connected no longer
 *              falls back to the attempted count).
 */

test('settings shows only real settings: no fake webhooks tab or pipeline switches', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page);
  await page.goto('/dashboard/settings');
  await expect(page.getByRole('button', { name: /General & Voice/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /^Webhooks$/ })).toHaveCount(0);
  await expect(page.getByText('Live Call Processing & Speech Intelligence')).toHaveCount(0);
  await expect(page.getByText('Default outbound number')).toHaveCount(0);
  await expect(page.getByText('Billing email')).toHaveCount(0);
  await expect(page.getByTestId('per-agent-settings-note')).toBeVisible();
  await expect(page.getByText('Display timezone (this browser)')).toBeVisible();
});

test('campaign KPIs use the server counts: failed and answered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/calendar/batches': (route) => ok(route, [{
      id: 'b1', name: 'Diwali offers', status: 'completed', total: 50, totalRecipients: 50,
      attempted: 50, called: 50, completedCount: 50, completed: 50, answered: 0, connected: 0, failed: 7,
      created: '2026-11-18', createdAt: new Date().toISOString(),
    }]),
  });
  await page.goto('/dashboard/batch');
  await expect(page.getByText('Diwali offers').first()).toBeVisible({ timeout: 30_000 });
  // KPI tiles: Connected = 0 (not the 50 attempted), Failed = 7 (from `failed`).
  const tile = (label: string) => page.locator('.nm-card').filter({ has: page.getByText(label, { exact: true }) }).first();
  await expect(tile('FAILED')).toContainText('7');
  await expect(tile('CONNECTED')).toContainText('0');
  await expect(tile('CONNECTED')).not.toContainText('50');
});
