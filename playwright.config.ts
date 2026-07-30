import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Synctag (devextension.synctag.com) QA suite.
 *
 * Run with:  BASE_URL=https://devextension.synctag.com npx playwright test
 *
 * NOTE: This environment's sandbox could not reach devextension.synctag.com
 * directly (outbound network is allow-listed), so this suite was authored
 * from live manual exploration via a connected browser rather than executed
 * headlessly here. Hand this to the dev/QA environment that has network
 * access to the dev site to run for real. See README.md for details and
 * for the one config value (OTP_VERIFY_URL_PATTERN) that must be confirmed
 * against the real backend before the mocked-OTP login tests will pass.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // plan/checkout tests mutate account state - keep serial per file
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://devextension.synctag.com',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
