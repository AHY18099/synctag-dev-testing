import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/my-tags`);
  }

  async clickNewTag(): Promise<void> {
    await this.page.click('button:has-text("+ NEW TAG"), button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
  }

  async searchTags(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"], input[placeholder*="search"]', query);
  }

  async selectSortOption(option: string): Promise<void> {
    await this.page.click('[class*="sort"], button:has-text("Sort")');
    await this.page.click(`text=${option}`);
  }

  async selectTypeFilter(type: string): Promise<void> {
    await this.page.click('[class*="filter"], button:has-text("All Types")');
    await this.page.click(`text=${type}`);
  }

  async clickPrivateTagsTab(): Promise<void> {
    await this.page.click('text=Private Tags');
  }

  async clickSharedTagsTab(): Promise<void> {
    await this.page.click('text=Shared Tags');
  }

  async clickSidebarNav(item: string): Promise<void> {
    await this.page.click(`nav >> text=${item}, [class*="sidebar"] >> text=${item}`);
  }

  async logout(): Promise<void> {
    await this.page.click('[class*="user-card"], [class*="avatar"], [class*="profile"]');
    await this.page.click('text=Log Out, text=Logout, text=Sign Out');
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
  }

  async assertTagLibraryVisible(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Tag Library/i })).toBeVisible();
  }

  async assertSidebarVisible(): Promise<void> {
    await expect(this.page.locator('[class*="sidebar"], nav').first()).toBeVisible();
  }

  async getTagCardByTrigger(trigger: string): Promise<void> {
    await expect(this.page.locator(`text=$${trigger}`)).toBeVisible();
  }
}
