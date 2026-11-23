import { test, expect } from '@playwright/test';
import { signInAsStaff } from './helpers';

/**
 * The sidebar search shows a "Ctrl+K" hint. Before fix/admin-ctrl-k the shortcut only closed an
 * already open palette and could never open it.
 */
const SEARCH = 'input[placeholder^="Search customers"]';

test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
  await page.goto('/overview');
  await expect(page.getByText('ADMIN CONSOLE').first()).toBeVisible();
  await expect(page.locator(SEARCH)).toHaveCount(0);
});

test('Ctrl+K opens the search palette and Ctrl+K closes it again', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.locator(SEARCH)).toBeVisible();
  await expect(page.locator(SEARCH)).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.locator(SEARCH)).toHaveCount(0);
});

test('Cmd+K (Mac) opens it and Escape closes it', async ({ page }) => {
  await page.keyboard.press('Meta+k');
  await expect(page.locator(SEARCH)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(SEARCH)).toHaveCount(0);
});

test('the sidebar search button still opens it', async ({ page }) => {
  await page.getByRole('button', { name: /Ctrl\+K/ }).first().click();
  await expect(page.locator(SEARCH)).toBeVisible();
});
