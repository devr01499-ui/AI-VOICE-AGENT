import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the admin console (Admin/). Runs Admin's own Vite dev server on 5185 and stubs
 * the Supabase session and the admin API, so no real sign-in, backend or database is used.
 * Run: cd Frontend && npx playwright test -c playwright.admin.config.ts
 */
export default defineConfig({
  testDir: './e2e-admin',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : Number(process.env.PW_WORKERS) || 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5185',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5185 --strictPort',
    cwd: '../Admin',
    url: 'http://localhost:5185',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
