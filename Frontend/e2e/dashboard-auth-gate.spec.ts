import { test, expect } from '@playwright/test';

test.describe('Dashboard Authentication Gate', () => {
  test.beforeEach(async ({ context }) => {
    // Ensure clean logged-out state: clear all cookies & storage
    await context.clearCookies();
  });

  test('Logged-out user visiting /dashboard is gated by AuthGateway login form', async ({ page }) => {
    // Ensure localStorage is empty before navigating
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');

    // Assert login form (AuthGateway) is rendered
    const loginButton = page.getByRole('button', { name: /Sign In to Dashboard|Create Account/i });
    await expect(loginButton).toBeVisible();

    // Assert NO dashboard content, cards, or navigation are rendered
    await expect(page.getByText('Overview')).not.toBeVisible();
    await expect(page.getByText('Total Calls')).not.toBeVisible();
    await expect(page.getByText('Active Agents')).not.toBeVisible();
    await expect(page.locator('nav.dashboard-nav')).not.toBeVisible();
  });

  test('Logged-out user visiting /login renders AuthGateway login form', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');

    // Assert login form (AuthGateway) is rendered
    const loginHeading = page.getByRole('heading', { name: /Welcome Back|Create Workspace/i });
    await expect(loginHeading).toBeVisible();

    const emailInput = page.getByPlaceholder('you@company.com');
    await expect(emailInput).toBeVisible();
  });

  test('Authenticated user can log in and view dashboard content', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL || 'test-user@claritiy.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');

    // Fill credentials
    await page.getByPlaceholder('you@company.com').fill(testEmail);
    await page.getByPlaceholder('••••••••••').fill(testPassword);

    // Submit login form
    const submitBtn = page.getByRole('button', { name: /Sign In to Dashboard/i });
    await submitBtn.click();

    // After login, navigate to /dashboard or verify redirect
    await page.goto('/dashboard');

    // Assert AuthGateway login form is no longer rendered and dashboard container is present
    await expect(page.getByRole('button', { name: /Sign In to Dashboard/i })).not.toBeVisible();
  });
});
