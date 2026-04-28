import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60000,
  expect: { timeout: 10000 },

  reporter: [
    // ── Built-in reporters ────────────────────────────────────────────────
    ['list'],
    ['json', { outputFile: 'reports/results.json' }],
    ['html', { outputFolder: 'reports/html', open: 'never' }],

    // ── Custom professional HTML report ───────────────────────────────────
    ['./reporters/custom-html-reporter.ts', { outputDir: 'reports/custom' }],

    // ── JIRA bug report (failures only) ───────────────────────────────────
    ['./reporters/jira-bug-reporter.ts',    { outputDir: 'reports/jira'   }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://devextension.synctag.com',

    // ── Screenshots: always capture, even on pass (annotated on failure by fixture) ──
    screenshot: 'on',

    // ── Video: record for every test; keep only on failure ────────────────
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
    },

    // ── Trace: full trace on retry; keep on failure ───────────────────────
    trace: 'retain-on-failure',

    actionTimeout:    15000,
    navigationTimeout: 30000,
    locale:     'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  // ── Output directories ──────────────────────────────────────────────────
  outputDir: 'reports/test-results',

  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome']  } },
    { name: 'firefox',       use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',        use: { ...devices['Desktop Safari']  } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7']         } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14']       } },
    { name: 'tablet',        use: { ...devices['iPad Pro 11']     } },
  ],
});
