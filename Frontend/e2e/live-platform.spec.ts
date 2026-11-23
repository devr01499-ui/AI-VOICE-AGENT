import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Admin Control Panel → customer site (fix/admin-panel 2026-11-23). Prices, "on sale", the banner
 * and the pause switches set in the panel come from GET /api/v2/public/platform.
 */
const livePlatform = {
  plans: [
    { key: 'startup', name: 'Startup', price: 3799, minutes: 750, maxConcurrentCalls: 5, kbDocuments: 25, calendars: 3, bookingsPerMonth: 500, purchasable: true },
    { key: 'growth', name: 'Growth', price: 11999, minutes: 3000, maxConcurrentCalls: 7, kbDocuments: 150, calendars: 5, bookingsPerMonth: 2500, purchasable: true },
    { key: 'enterprise', name: 'Enterprise', price: 30799, minutes: 10000, maxConcurrentCalls: 15, kbDocuments: 1000, calendars: 20, bookingsPerMonth: 10000, purchasable: false },
  ],
  banner: { message: 'Planned maintenance tonight 2-3 AM IST', level: 'warning' },
  signupsPaused: true,
  signupsPausedMessage: 'Sign-ups reopen on Monday.',
  callingPaused: true,
  callingPausedMessage: 'Outgoing calls are paused for carrier maintenance.',
};

test('pricing shows live prices and hides a plan taken off sale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBackend(page, { '/api/v2/public/platform': (route) => ok(route, livePlatform) });
  await page.goto('/pricing');
  await expect(page.getByText('₹11,999').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('3,000 calling minutes', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Enterprise/ })).toHaveCount(0);
  await expect(page.getByText('₹10,799')).toHaveCount(0);
  await expect(page.getByText('₹30,799')).toHaveCount(0);
});

test('when the platform state cannot be loaded, the built-in prices stay', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBackend(page, { '/api/v2/public/platform': (route) => json(route, 503, { success: false }) });
  await page.goto('/pricing');
  await expect(page.getByText('₹10,799').first()).toBeVisible({ timeout: 30_000 });
});

test('dashboard shows the banner and the calling-paused notice; sign-up shows the paused message', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsTestUser(page);
  await stubBackend(page, { '/api/v2/public/platform': (route) => ok(route, livePlatform) });
  await page.goto('/dashboard');
  await expect(page.getByText('Planned maintenance tonight 2-3 AM IST')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Outgoing calls are paused for carrier maintenance.')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '../docs/proof/admin-panel/customer-dashboard-banner-390.png' });
});

test('sign-up page explains that new sign-ups are paused', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBackend(page, { '/api/v2/public/platform': (route) => ok(route, livePlatform) });
  await page.goto('/signup');
  await expect(page.getByText('Sign-ups reopen on Monday.')).toBeVisible({ timeout: 30_000 });
});
