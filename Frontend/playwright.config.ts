import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Locally the default (half the CPU cores) starts more browsers than a 6–8 GB machine can hold next
  // to the Vite dev server; under memory pressure the dev server resets connections and tests flake.
  // Two workers is stable; override with PW_WORKERS=<n> on bigger machines.
  workers: process.env.CI ? 1 : Number(process.env.PW_WORKERS) || 2,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
