import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Found 2026-11-22 (FIX_LOG "AUTH-TRACE again + Edit Studio"): at phone width the Agents page kept
 * its 224 px folder column, so the table got half the screen and, because the table area clips,
 * Export and Delete were cut off: customers on a phone could not reach them.
 */
const AGENT = {
  id: '88888888-1111-4222-8333-444444444444', name: 'Clinic Receptionist', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You are the receptionist of a dental clinic.', flowGraph: null, agentConfig: '{}', languageMode: 'auto',
  direction: 'inbound', industry: 'other', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

async function openAgents(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAsTestUser(page);
  await stubBackend(page, { '/api/v2/agents': (route) => ok(route, [AGENT]) });
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Edit Studio' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(600); // entry animations settle before measuring
}

/** Every action button of the row lies fully inside the viewport and inside the table box. */
async function expectActionsReachable(page: Page, width: number) {
  for (const name of ['Call', 'Edit Studio', 'Export', `Delete agent ${AGENT.name}`]) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${name} right edge`).toBeLessThanOrEqual(width);
  }
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflow, 'no sideways page scroll').toBeLessThanOrEqual(0);
  const tableOverflow = await page.getByTestId('agents-table-scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(tableOverflow, 'table fits its box').toBeLessThanOrEqual(0);
}

test('phone (390 px): no folder column; every agent action is fully reachable', async ({ page }) => {
  await openAgents(page, 390, 844);
  await expect(page.getByTestId('agents-folders')).toBeHidden();
  await expectActionsReachable(page, 390);
  await expect(page.getByRole('button', { name: /Create an Agent/ })).toBeVisible();
  await page.screenshot({ path: '../docs/proof/agents-mobile-390.png' });
});

test('tablet (768 px): no folder column yet (main sidebar is shown), actions still reachable', async ({ page }) => {
  await openAgents(page, 768, 1024);
  await expect(page.getByTestId('agents-folders')).toBeHidden();
  await page.screenshot({ path: '../docs/proof/agents-tablet-768.png' });
  await expectActionsReachable(page, 768);
});

test('desktop (1440 px): unchanged — folders and every column shown', async ({ page }) => {
  await openAgents(page, 1440, 900);
  await expect(page.getByTestId('agents-folders')).toBeVisible();
  for (const col of ['Agent Name', 'Agent Type', 'Voice', 'Phone', 'Last edited', 'Actions']) {
    await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
  }
  await expectActionsReachable(page, 1440);
  await page.screenshot({ path: '../docs/proof/agents-desktop-1440.png' });
});
