/**
 * Extended Playwright fixtures
 *
 * Provides:
 *   - `autoScreenshot` — automatically takes an annotated screenshot on test
 *     failure and attaches it to the test result (picked up by both reporters)
 *   - `marker` — the ScreenshotMarker helper, available in every test
 *
 * Usage:
 *   import { test, expect } from '../../utils/test-fixtures';
 *
 *   test('my test', async ({ page, marker }) => {
 *     // ... test logic ...
 *     // On failure, a full-page annotated screenshot is auto-attached
 *
 *     // Or manually mark a specific element:
 *     await marker.markLocator(page, page.locator('button.submit'), 'FAIL: Button');
 *   });
 */

import { test as base, expect } from '@playwright/test';
import * as path from 'path';
import * as fs   from 'fs';
import { ScreenshotMarker } from './screenshot-marker';

export { expect };

type Fixtures = {
  marker:         typeof ScreenshotMarker;
  autoScreenshot: void;              // auto-use — no explicit parameter needed
};

export const test = base.extend<Fixtures>({

  // Make ScreenshotMarker available as a fixture
  marker: async ({}, use) => {
    await use(ScreenshotMarker);
  },

  // Automatically captures an annotated full-page screenshot on failure
  // and attaches it to the test result for both reporters to pick up.
  autoScreenshot: [async ({ page }, use, testInfo) => {
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshotDir = path.join('reports', 'screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });

      // Safe file name from test title
      const safeName = testInfo.title
        .replace(/[^a-zA-Z0-9\-_]/g, '_')
        .substring(0, 80);
      const outputPath = path.join(screenshotDir, `${safeName}-${Date.now()}.png`);

      // Take annotated screenshot (error label in top-left area)
      const errorMsg = testInfo.error?.message?.substring(0, 80) || 'Test Failed';
      try {
        await ScreenshotMarker.annotate(page, [{
          bbox:  { x: 0, y: 0, width: Math.min(500, 500), height: 28 },
          label: `❌ ${errorMsg}`,
          color: '#DC2626',
        }], outputPath);
      } catch {
        // Fallback: plain screenshot if page is already closed / navigated away
        await page.screenshot({ path: outputPath, fullPage: true }).catch(() => {});
      }

      await testInfo.attach('screenshot', { path: outputPath, contentType: 'image/png' });
    }
  }, { auto: true }],
});
