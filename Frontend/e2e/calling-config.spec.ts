import { test, expect, type Route } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Issue B11 — Calling Configuration: a change shows at once (no full-page "Loading" while
 * saving), and goes back if the server refuses it.
 */
const AGENTS = [
  { id: 'a1', name: 'Front Desk', agentType: 'prompt', status: 'active' },
  { id: 'a2', name: 'Sales', agentType: 'prompt', status: 'active' },
];
const NUMBER = {
  id: 'n1', phoneNumber: '+918045671234', status: 'active', kycStatus: 'verified',
  assignedAgentId: 'a1', outboundAgentName: 'Front Desk', inboundEnabled: true,
  inboundAgentId: 'a1', inboundAgentName: 'Front Desk', businessHours: '{}', outsideHoursAction: 'agent',
};

async function open(page: any, save: (route: Route) => unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  page.on('dialog', (d: any) => d.dismiss().catch(() => {}));
  await stubBackend(page, {
    '/api/v2/numbers/n1/calling-config': save,
    '/api/v2/numbers/calling-config': (route) => ok(route, [NUMBER]),
    '/api/v2/agents': (route) => ok(route, AGENTS),
  });
  await page.goto('/dashboard/calling');
  const outbound = page.locator('select').first();
  await expect(outbound).toHaveValue('a1', { timeout: 30_000 });
  return outbound;
}

test('a change shows immediately while the save is in flight, without blanking the page', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const outbound = await open(page, async (route) => { await gate; return ok(route, { id: 'n1' }); });
  await outbound.selectOption('a2');
  await expect(outbound).toHaveValue('a2');
  await expect(page.getByText('Loading Calling Configuration...')).toHaveCount(0);
  release();
  await expect(page.getByText('Calling configuration updated successfully!')).toBeVisible();
});

test('a refused change goes back to the saved value', async ({ page }) => {
  const outbound = await open(page, (route) => json(route, 400, { success: false, error: 'Agent not found' }));
  await outbound.selectOption('a2');
  await expect(outbound).toHaveValue('a1');
});
