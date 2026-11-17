import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend } from './helpers/dashboard';

/**
 * Issue B4 — "Review QA" and the industry "Auto-detect" option were removed.
 * The language choice "Automatic / Multilingual" is a different feature and must stay.
 */

async function openNewPromptAgent(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Create an Agent/ }).click({ timeout: 30_000 });
  await page.getByText('Build from scratch').click();
  await expect(page.getByRole('button', { name: /Prompt Coach/ })).toBeVisible();
  return seen;
}

test('the prompt editor has no Review QA button, QA score badge or Auto-detect option', async ({ page }) => {
  await openNewPromptAgent(page);

  await expect(page.getByRole('button', { name: /Review QA/i })).toHaveCount(0);
  await expect(page.getByText(/QA: (PASS|WARN|FAIL)/)).toHaveCount(0);
  await expect(page.getByText(/Auto-detect/i)).toHaveCount(0);
  await expect(page.locator('option', { hasText: /Auto-detect/i })).toHaveCount(0);

  // Still there: Prompt Coach, and the language choice that also uses the word "Automatic".
  await expect(page.getByRole('button', { name: /Prompt Coach/ })).toBeVisible();
  await expect(page.locator('option', { hasText: 'Automatic / Multilingual' }).first()).toBeAttached();
});

test('a new agent starts on "Other" and offers exactly the selectable industries', async ({ page }) => {
  await openNewPromptAgent(page);
  const industry = page.locator('select[title="Industry Sector & Street-Smart Conversation Skills"]');
  await expect(industry).toHaveValue('other');
  const values = await industry.locator('option').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
  expect(values.sort()).toEqual(['bfsi', 'healthcare', 'other', 'real_estate', 'recruitment', 'sales', 'support']);
});

test('the Review QA request is never sent', async ({ page }) => {
  const seen = await openNewPromptAgent(page);
  await page.waitForTimeout(500);
  expect(seen.filter((r) => r.url.includes('prompt-coach/review'))).toHaveLength(0);
});
