import { Page, expect } from '@playwright/test';

export class GlobalTagsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Global Tags, [class*="sidebar"] >> text=Global Tags');
    await this.page.waitForURL(/\/global-tags/, { timeout: 10000 });
  }

  async clickMarketplaceTab(): Promise<void> {
    await this.page.click('button:has-text("Marketplace"), [role="tab"]:has-text("Marketplace")');
  }

  async clickMyGlobalTagsTab(): Promise<void> {
    await this.page.click('button:has-text("My Global Tags"), [role="tab"]:has-text("My Global Tags")');
  }

  async clickCreateGlobalTag(): Promise<void> {
    await this.page.click('button:has-text("+ CREATE GLOBAL TAG"), button:has-text("CREATE GLOBAL TAG")');
  }

  async checkTriggerAvailability(trigger: string): Promise<string> {
    await this.page.fill('[class*="trigger"] input, input[name="trigger"]', trigger);
    await this.page.waitForTimeout(1500);
    const banner = this.page.locator('[class*="availability"], [class*="trigger-status"]');
    return await banner.innerText();
  }

  async enableMonetize(): Promise<void> {
    await this.page.click('input[value="monetize"], label:has-text("Monetize"), [class*="monetize"] input[type="radio"]');
  }

  async assertMarketplaceVisible(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Global Tags/i })).toBeVisible();
  }
}
