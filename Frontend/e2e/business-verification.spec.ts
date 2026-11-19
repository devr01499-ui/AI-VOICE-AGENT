import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Business numbers (carrier for GST-registered businesses): the customer must upload business
 * documents and the carrier must accept them before a business number can be claimed.
 * Every request leaving the dev server is stubbed.
 */

async function openBusinessTab(page: Page, statusSeq: string[], viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await loginAsTestUser(page);
  let i = 0;
  const seen = await stubBackend(page, {
    '/api/v2/numbers/plivo/compliance': (route, req) => {
      if (req.method === 'POST') return json(route, 201, { success: true, data: { status: 'submitted', businessName: req.body?.businessName } });
      const status = statusSeq[Math.min(i++, statusSeq.length - 1)];
      return ok(route, { status, rejectionReason: status === 'rejected' ? 'Name mismatch' : null });
    },
    '/api/v2/numbers/plivo/search': (route) => ok(route, { results: [], total: 0, hasMore: false }),
    '/api/v2/numbers/status': (route) => ok(route, { numberLocked: false, number: null }),
    '/api/v2/kyc/status': (route) => ok(route, { isVerified: false, kycStatus: 'pending' }),
  });
  await page.goto('/dashboard/numbers');
  await page.getByRole('button', { name: 'Buy number' }).first().click({ timeout: 30_000 });
  await page.locator('#provider-plivo-btn').click({ timeout: 30_000 });
  return seen;
}

test('a business submits GST + incorporation documents and sees the review state', async ({ page }) => {
  const seen = await openBusinessTab(page, ['not_started', 'submitted']);
  const form = page.getByTestId('business-verification-form');
  await expect(form).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Account KYC Verification Required')).toHaveCount(0);
  await form.screenshot({ path: '../docs/proof/business-verification-1440.png' });

  await page.getByTestId('bv-businessName').fill('Acme Traders Pvt Ltd');
  await page.getByTestId('bv-addressLine1').fill('1 MG Road');
  await page.getByTestId('bv-city').fill('Bengaluru');
  await page.getByTestId('bv-state').fill('Karnataka');
  await page.getByTestId('bv-postalCode').fill('560001');
  await page.getByTestId('bv-registration-file').setInputFiles({ name: 'coi.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 coi') });
  await page.getByTestId('bv-gst-file').setInputFiles({ name: 'gst.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 gst') });
  await page.getByTestId('bv-submit').click();

  await expect(page.getByTestId('business-verification-review')).toBeVisible();
  const post = seen.find((r) => r.method === 'POST' && r.url.includes('/api/v2/numbers/plivo/compliance'))!;
  expect(post.body.businessName).toBe('Acme Traders Pvt Ltd');
  expect(Buffer.from(post.body.gstCertificate.contentBase64, 'base64').toString()).toBe('%PDF-1.4 gst');
  expect(Buffer.from(post.body.registrationCertificate.contentBase64, 'base64').toString()).toBe('%PDF-1.4 coi');
});

test('an accepted business sees it is verified', async ({ page }) => {
  await openBusinessTab(page, ['accepted']);
  await expect(page.getByTestId('business-verification-accepted')).toBeVisible({ timeout: 30_000 });
});

test('a rejected business sees the carrier reason and can resubmit', async ({ page }) => {
  await openBusinessTab(page, ['rejected']);
  await expect(page.getByTestId('business-verification-rejected')).toContainText('Name mismatch', { timeout: 30_000 });
  await expect(page.getByTestId('bv-submit')).toBeVisible();
});

test('the business verification form fits a phone screen', async ({ page }) => {
  await openBusinessTab(page, ['not_started'], { width: 390, height: 844 });
  const form = page.getByTestId('business-verification-form');
  await expect(form).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await form.screenshot({ path: '../docs/proof/business-verification-390.png' });
});
