import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Audit batch 13 — remaining dashboard low findings (docs/AUDIT_FINDINGS.md):
 *  #75/#103 contacts: the real total, "Load more", search on the server
 *  #104 dates in the workspace timezone (IST), not the browser's
 *  #105 changing the carrier or region searches once, not twice
 *  #106 no carrier rental price on a plan-included number
 *  #108 the low-balance message states the real rule
 *  #110 Call History shows the real total and loads older calls
 */
const json200 = (route: any, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('#110 Call History shows the real total and loads older calls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const mk = (i: number) => ({ id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`, recipientPhoneNumber: `+91980${String(i).padStart(7, '0')}`, status: 'completed', durationSeconds: 30, createdAt: new Date(Date.now() - i * 60000).toISOString() });
  const offsets: number[] = [];
  await stubBackend(page, {
    '/api/v2/calls': (route) => {
      const u = new URL(route.request().url());
      if (u.pathname !== '/api/v2/calls') return ok(route, []);
      const offset = Number(u.searchParams.get('offset') || 0);
      offsets.push(offset);
      const items = Array.from({ length: offset === 0 ? 100 : 50 }, (_, i) => mk(offset + i));
      return json200(route, { success: true, data: items, pagination: { total: 150, limit: 100, offset, hasMore: offset === 0 } });
    },
  });
  await page.goto('/dashboard/calls');
  await expect(page.getByTestId('calls-paging')).toContainText('100 loaded of 150 calls', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Load older calls' }).click();
  await expect(page.getByTestId('calls-paging')).toContainText('150 loaded of 150 calls');
  expect(offsets).toContain(100);
  await expect(page.getByRole('button', { name: 'Load older calls' })).toHaveCount(0);
});

test('#75 #103 contacts: real total, Load more, server-side search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen: string[] = [];
  await stubBackend(page, {
    '/api/v2/contacts': (route) => {
      const u = new URL(route.request().url());
      if (u.pathname !== '/api/v2/contacts') return ok(route, []);
      seen.push(u.search);
      const search = u.searchParams.get('search');
      if (search) return json200(route, { success: true, data: [{ id: 'c-asha', userId: 'u', phoneNumber: '+919811100000', name: 'Asha Verma', createdAt: new Date().toISOString() }], pagination: { page: 1, limit: 100, total: 1 } });
      const pageNo = Number(u.searchParams.get('page') || 1);
      const items = Array.from({ length: pageNo === 1 ? 100 : 30 }, (_, i) => ({ id: `c-${pageNo}-${i}`, userId: 'u', phoneNumber: `+9198111${String(pageNo * 1000 + i).padStart(5, '0')}`, name: `Customer ${pageNo}-${i}`, createdAt: new Date().toISOString() }));
      return json200(route, { success: true, data: items, pagination: { page: pageNo, limit: 100, total: 130 } });
    },
  });
  await page.goto('/dashboard/contacts');
  await expect(page.getByTestId('contacts-paging')).toContainText('Showing 100 of 130 contacts', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByTestId('contacts-paging')).toContainText('Showing 130 of 130 contacts');
  await page.getByPlaceholder('Search contacts by name, number, or notes...').fill('asha');
  await expect(page.getByText('Asha Verma')).toBeVisible({ timeout: 10_000 });
  expect(seen.some((q) => /search=asha/.test(q))).toBe(true);
});

test.describe('#104 dates in the workspace timezone', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('an alert incident shows IST, not the browser\'s New York time', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsTestUser(page);
    await stubBackend(page, {
      '/api/v2/alerting/rules': (route) => ok(route, [{ id: 'r1', name: 'Errors', metric: 'error_rate', comparator: 'greater_than', thresholdValue: 10, evaluationWindowMins: 60, checkFrequencyMins: 5, enabled: true, incidents: [] }]),
      // 03:30 UTC = 09:00 IST = 22:30 the previous day in New York
      '/api/v2/alerting/incidents': (route) => ok(route, [{ id: 'i1', ruleId: 'r1', ruleName: 'Errors', status: 'triggered', metricValue: 25, summary: 'Error rate 25%', triggeredAt: '2026-11-20T03:30:00.000Z', resolvedAt: null, rule: { name: 'Errors', metric: 'error_rate' } }]),
    });
    await page.goto('/dashboard/alerting');
    await page.getByRole('button', { name: /Incident History/ }).click({ timeout: 30_000 });
    await expect(page.getByRole('cell', { name: /Nov 20, 2026, 9:00 AM/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/10:30 PM/)).toHaveCount(0);
  });
});

test('#105 switching carrier searches once; #106 no carrier rental price on an included number', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  let standard = 0;
  let business = 0;
  await stubBackend(page, {
    '/api/v2/numbers/search': (route) => { standard++; return ok(route, { results: [{ id: 'inv-1', e164: '+918045670001', region: 'Bengaluru', country: 'IN', capabilities: { voice: true, sms: false }, aadhaar_verification_required: false }], total: 1, hasMore: false }); },
    '/api/v2/numbers/plivo/search': (route) => { business++; return ok(route, { results: [{ id: 'pl-1', number: '+912240000001', region: 'Mumbai', monthlyRental: 450, taxes: 81 }], total: 1, page: 1, per_page: 15, hasMore: false }); },
    '/api/v2/numbers/plivo/onboard': (route) => ok(route, { subaccountMapped: true }),
    '/api/v2/numbers/plivo/compliance': (route) => ok(route, { status: 'accepted' }),
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', accountType: 'professional', callingBalanceMinutes: 500 }),
    '/api/v2/numbers': (route) => ok(route, []),
  });
  await page.goto('/dashboard/numbers');
  await page.getByRole('button', { name: 'Buy number' }).first().click({ timeout: 30_000 });
  await expect.poll(() => standard, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Business Carrier/ }).click();
  await expect.poll(() => business, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  expect(business).toBe(1);
  await expect(page.getByText(/₹450\/mo|81 GST/)).toHaveCount(0);
});

test('#108 the low-balance message states the real rule', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', email: 'owner@example.org', accountType: 'developer', callingBalanceMinutes: 42 }),
  });
  await page.goto('/dashboard/settings');
  await expect(page.getByText('fewer than 100 calling minutes left')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/below 10%/)).toHaveCount(0);
});
