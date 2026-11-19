import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json, TEST_USER } from './helpers/dashboard';

/**
 * Audit #114 — a plan chosen while signed out opens checkout right after signing in, and never
 * later by surprise (a token refresh or an old leftover choice used to open it).
 * Every request leaving the dev server is stubbed: no backend, Supabase or payment gateway is reached.
 */

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: TEST_USER.id, exp, role: 'authenticated', email: TEST_USER.email, aud: 'authenticated' })}.e2e-signature`;
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: TEST_USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: TEST_USER.email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: TEST_USER.fullName, has_consented_terms: true },
      app_metadata: { provider: 'email' },
      created_at: new Date().toISOString(),
    },
  };
}

async function fakeCheckout(page: Page) {
  await page.addInitScript(() => {
    (window as any).Razorpay = function (opts: any) {
      return { on() {}, open() { (window as any).__checkoutOpened = { order_id: opts.order_id }; } };
    };
  });
}

test('a plan picked while signed out opens checkout right after sign-in', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeCheckout(page);
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const seen = await stubBackend(page, {
    '/auth/v1/token': (route) => json(route, 200, fakeSession()),
    '/api/v2/billing/create-plan-order': (route) => ok(route, { id: 'order_e2e_1', orderId: 'order_e2e_1', amount: 379900, currency: 'INR', keyId: 'rzp_test_public' }),
  });

  await page.goto('/pricing');
  await page.getByRole('button', { name: 'Purchase Startup Plan' }).click({ timeout: 30_000 });

  // Sent to sign in; the choice is remembered with a time stamp.
  await expect(page.getByRole('heading', { name: /Welcome Back/ })).toBeVisible({ timeout: 30_000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pending_plan_purchase') || 'null'));
  expect(stored?.planName).toBe('Startup');
  expect(typeof stored?.at).toBe('number');

  await page.getByPlaceholder('you@company.com').fill(TEST_USER.email);
  await page.getByPlaceholder('••••••••••').fill('Str0ngPass99');
  await page.getByRole('button', { name: /Sign In to Dashboard/ }).click();

  await expect.poll(() => seen.filter((r) => r.url.includes('/api/v2/billing/create-plan-order')).length, { timeout: 20_000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).__checkoutOpened?.order_id || null)).toBe('order_e2e_1');
  expect(await page.evaluate(() => localStorage.getItem('pending_plan_purchase'))).toBeNull();
});

test('an old leftover plan choice never opens checkout on a later visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeCheckout(page);
  await loginAsTestUser(page);
  await page.addInitScript(() => {
    // Old format (no time stamp) left behind by an earlier visit.
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem('pending_plan_purchase', JSON.stringify({ planName: 'Startup', price: 3799 }));
      sessionStorage.setItem('__seeded', '1');
    }
  });
  const seen = await stubBackend(page, {
    '/api/v2/billing/create-plan-order': (route) => ok(route, { id: 'order_e2e_2', orderId: 'order_e2e_2', amount: 379900, currency: 'INR', keyId: 'rzp_test_public' }),
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome Back/ })).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  expect(seen.filter((r) => r.url.includes('/api/v2/billing/create-plan-order'))).toHaveLength(0);
  expect(await page.evaluate(() => (window as any).__checkoutOpened || null)).toBeNull();
  expect(new URL(page.url()).pathname).not.toBe('/pricing');
  expect(await page.evaluate(() => localStorage.getItem('pending_plan_purchase'))).toBeNull();
});
