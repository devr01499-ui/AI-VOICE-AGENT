import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B12 — Analytics shows minutes actually taken from the plan, not an invented ₹/min spend.
 */
test('analytics shows billed minutes and no made-up spend', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/analytics/summary': (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        summary: {
          totalCalls: 4, completionRatePct: 50, averageDurationSeconds: 46, totalDurationMinutes: 2, billedMinutes: 3, timeZone: 'Asia/Kolkata',
          statusBreakdown: { completed: 2, failed: 1, noAnswer: 1, busy: 0, inProgress: 0 },
          sentimentBreakdown: { positive: 1, neutral: 2, negative: 1, positivePct: 25, neutralPct: 50, negativePct: 25 },
          directionSplit: { inbound: 1, outbound: 3, inboundPct: 25, outboundPct: 75 },
          volumeTrend: [{ date: '2026-11-17', total: 1, completed: 0, failed: 1 }, { date: '2026-11-18', total: 3, completed: 2, failed: 1 }],
        },
      }),
    }),
    '/api/v2/agents': (route) => ok(route, []),
  });
  await page.goto('/dashboard/analytics');
  await expect(page.getByTestId('billed-minutes')).toHaveText('3', { timeout: 30_000 });
  await expect(page.getByText('Estimated Spend')).toHaveCount(0);
  await expect(page.getByText(/₹4\.00\/min/)).toHaveCount(0);
});
