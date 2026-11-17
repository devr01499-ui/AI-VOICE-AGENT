import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Issue B3 — Prompt Coach enhances the agent's own prompt with the AI model and lets the
 * customer review the changes before applying them.
 */

const ENHANCED = {
  improvedPrompt: 'You are Priya, the appointment assistant for [CLINIC NAME].\n\nGOAL\nConfirm tomorrow\'s appointment politely.\n\nGUARDRAILS\nNever invent prices.',
  summary: 'Added a role, a goal and guardrails.',
  changes: [{ area: 'Role', change: 'Gave the agent a name and identity', reason: 'Callers trust a clear identity' }],
  placeholders: ['[CLINIC NAME]'],
  diff: [
    { type: 'removed', text: 'You are an energetic and friendly outbound sales agent for a dental clinic.' },
    { type: 'added', text: 'You are Priya, the appointment assistant for [CLINIC NAME].' },
  ],
  scoreBefore: 41,
  scoreAfter: 88,
  model: 'gemini-2.5-flash',
};

async function openCoach(page: Page, enhance: (route: any, req: any) => unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, { '/api/v2/agents/prompt-coach/enhance': enhance });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Create an Agent/ }).click({ timeout: 30_000 });
  await page.getByText('Build from scratch').click();
  await page.getByRole('button', { name: /Prompt Coach/ }).click();
  await expect(page.getByTestId('coach-enhance')).toBeVisible();
  return seen;
}

test('Enhance sends the current prompt to the server and shows the result for review', async ({ page }) => {
  const seen = await openCoach(page, (route) => ok(route, ENHANCED));
  await page.getByLabel(/What should the agent achieve/).fill('Confirm tomorrow\'s appointment');
  await page.getByRole('button', { name: 'Enhance my prompt' }).click();

  await expect(page.getByTestId('coach-preview')).toContainText('You are Priya');
  await expect(page.getByText('Quality before: 41/100')).toBeVisible();
  await expect(page.getByText('After: 88/100')).toBeVisible();
  await expect(page.getByText('Fill these in before going live')).toBeVisible();
  await expect(page.getByText('[CLINIC NAME]').first()).toBeVisible();

  const req = seen.find((r) => r.url.includes('/prompt-coach/enhance'))!;
  expect(req.method).toBe('POST');
  expect(req.body.prompt.length).toBeGreaterThan(20);
  expect(req.body.goal).toBe('Confirm tomorrow\'s appointment');
  expect(req.body).not.toHaveProperty('geminiApiKey');
});

test('Compare changes shows added and removed lines', async ({ page }) => {
  await openCoach(page, (route) => ok(route, ENHANCED));
  await page.getByRole('button', { name: 'Enhance my prompt' }).click();
  await page.getByRole('button', { name: 'Compare changes' }).click();
  await expect(page.getByTestId('coach-preview')).toContainText('+You are Priya');
  await expect(page.getByTestId('coach-preview')).toContainText('−You are an energetic');
});

test('Use enhanced prompt replaces the prompt in the editor and closes the coach', async ({ page }) => {
  await openCoach(page, (route) => ok(route, ENHANCED));
  await page.getByRole('button', { name: 'Enhance my prompt' }).click();
  await page.getByRole('button', { name: 'Use enhanced prompt' }).click();
  await expect(page.getByTestId('coach-enhance')).toHaveCount(0);
  await expect(page.getByText('You are Priya, the appointment assistant for [CLINIC NAME].').first()).toBeVisible();
});

test('Discard keeps the original prompt', async ({ page }) => {
  await openCoach(page, (route) => ok(route, ENHANCED));
  await page.getByRole('button', { name: 'Enhance my prompt' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByTestId('coach-preview')).not.toContainText('You are Priya');
  await expect(page.getByText('Your current prompt', { exact: true })).toBeVisible();
});

test('a server error is shown clearly and nothing is replaced', async ({ page }) => {
  await openCoach(page, (route) => json(route, 503, { success: false, error: 'Prompt Coach is temporarily unavailable. Please try again shortly.', code: 'AI_UNAVAILABLE' }));
  await page.getByRole('button', { name: 'Enhance my prompt' }).click();
  await expect(page.getByRole('alert')).toHaveText(/temporarily unavailable/);
  await expect(page.getByRole('button', { name: 'Use enhanced prompt' })).toHaveCount(0);
});

test('the playbook tab is still available', async ({ page }) => {
  await openCoach(page, (route) => ok(route, ENHANCED));
  await page.getByRole('tab', { name: 'Start from a playbook' }).click();
  await expect(page.getByTestId('coach-enhance')).toHaveCount(0);
});
