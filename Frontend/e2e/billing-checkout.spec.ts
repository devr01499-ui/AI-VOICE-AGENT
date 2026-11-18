import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Issue B13 — the plan checkout shows success ONLY after the server confirmed the payment with
 * the gateway. A browser-side "payment done" from the checkout widget alone never upgrades
 * anything; a pending confirmation says so; the browser never sends a price.
 */

async function openBilling(page: Page, verify: (route: any) => unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await page.addInitScript(() => {
    localStorage.setItem('token', 'test-session-token');
    // Fake checkout widget: "pays" immediately and hands back ids + signature like Razorpay does.
    (window as any).Razorpay = function (opts: any) {
      return {
        on() {},
        open() {
          (window as any).__checkoutOpened = { order_id: opts.order_id, amount: opts.amount, key: opts.key };
          setTimeout(() => opts.handler({ razorpay_order_id: opts.order_id, razorpay_payment_id: 'pay_test_1', razorpay_signature: 'sig_from_widget' }), 10);
        },
      };
    };
  });
  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  const seen = await stubBackend(page, {
    '/api/v2/billing/create-plan-order': (route) => ok(route, { id: 'order_test_1', orderId: 'order_test_1', amount: 379900, currency: 'INR', keyId: 'rzp_test_public' }),
    '/api/v2/billing/verify-plan': verify,
  });
  await page.goto('/dashboard/billing');
  await page.getByRole('button', { name: 'Purchase Startup Plan' }).click({ timeout: 30_000 });
  return { seen, dialogs };
}

test('success is shown only after the server confirms the payment; no price is sent', async ({ page }) => {
  const { seen, dialogs } = await openBilling(page, (route) => ok(route, { message: 'Plan purchased successfully.', plan: 'startup', planName: 'Startup', alreadyActive: false }));
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0]).toContain('upgraded to the Startup Plan');
  const create = seen.find((r) => r.url.includes('/create-plan-order'));
  expect(create?.body).toEqual({ planName: 'Startup' });
  const verify = seen.find((r) => r.url.includes('/verify-plan'));
  expect(verify?.body).toMatchObject({ orderId: 'order_test_1', paymentId: 'pay_test_1', signature: 'sig_from_widget' });
});

test('a rejected payment never shows success', async ({ page }) => {
  const { dialogs } = await openBilling(page, (route) => json(route, 400, { success: false, error: 'Invalid payment signature', code: 'PAYMENT_SIGNATURE_INVALID' }));
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0]).toContain('Payment verification failed: Invalid payment signature');
  expect(dialogs.join(' ')).not.toContain('upgraded');
});

test('a payment the server cannot confirm yet is shown as processing, not success or failure', async ({ page }) => {
  const { dialogs } = await openBilling(page, (route) => json(route, 503, {
    success: false, pending: true, code: 'PAYMENT_UNCONFIRMED',
    error: 'We could not confirm your payment yet. If money was deducted, your purchase will be activated automatically within a few minutes.',
  }));
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0]).toContain('activated automatically');
  expect(dialogs[0]).not.toContain('verification failed');
});
