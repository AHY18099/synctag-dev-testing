import { defineConfig, devices } from '@playwright/test';
import * as path   from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config();

export const AUTH_FILE = path.resolve('auth-state.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 120000,
  expect: { timeout: 10000 },

  reporter: [
    ['list'],
    ['json',  { outputFile: 'reports/results.json' }],
    ['html',  { outputFolder: 'reports/html', open: 'never' }],
    ['./reporters/custom-html-reporter.ts', { outputDir: 'reports/custom' }],
    ['./reporters/jira-bug-reporter.ts',    { outputDir: 'reports/jira'   }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://devextension.synctag.com',

    screenshot: 'on',
    video: { mode: 'retain-on-failure', size: { width: 1280, height: 720 } },
    trace: 'retain-on-failure',

    actionTimeout:     15000,
    navigationTimeout: 60000,
    locale:     'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  outputDir: 'reports/test-results',

  projects: [
    // ── Step 1: Login once, save session to auth-state.json ───────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Smoke suite (SM-001 → SM-130) — fast gating run ──────────────────
    {
      name: 'smoke-chromium',
      dependencies: ['setup'],
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
    },

    // ── Regression suite — full parallel run ─────────────────────────────
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'],  storageState: AUTH_FILE },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], storageState: AUTH_FILE },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'],  storageState: AUTH_FILE },
    },
    {
      name: 'mobile-chrome',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['Pixel 7'],         storageState: AUTH_FILE },
    },
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['iPhone 14'],       storageState: AUTH_FILE },
    },
    {
      name: 'tablet',
      dependencies: ['setup'],
      testIgnore: /smoke\.spec\.ts/,
      use: { ...devices['iPad Pro 11'],     storageState: AUTH_FILE },
    },
  ],
});
