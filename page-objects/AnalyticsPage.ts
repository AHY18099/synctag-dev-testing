import { Page, expect } from '@playwright/test';

export class AnalyticsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Analytics, [class*="sidebar"] >> text=Analytics');
    await this.page.waitForURL(/\/analytics/, { timeout: 10000 });
  }

  async clickTimePeriod(period: 'Today' | '1W' | '1M' | 'Custom'): Promise<void> {
    await this.page.click(`button:has-text("${period}")`);
  }

  async clickRefresh(): Promise<void> {
    await this.page.click('button:has-text("REFRESH"), button:has-text("Refresh")');
  }

  async assertStatTileVisible(label: string): Promise<void> {
    await expect(this.page.locator(`text=${label}`).first()).toBeVisible();
  }

  async assertAnalyticsLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Analytics/i })).toBeVisible();
  }
}
