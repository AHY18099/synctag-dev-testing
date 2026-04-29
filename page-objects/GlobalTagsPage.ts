import { Page, expect } from '@playwright/test';

export class GlobalTagsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Global Tags, [class*="sidebar"] >> text=Global Tags');
    await this.page.waitForURL(/\/global-tags/, { timeout: 10000 }).catch(() => {});
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/global-tags`, { waitUntil: 'domcontentloaded' });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  async clickMarketplaceTab(): Promise<void> {
    await this.page.click('button:has-text("Marketplace"), [role="tab"]:has-text("Marketplace")');
  }

  async clickMyGlobalTagsTab(): Promise<void> {
    await this.page.click('button:has-text("My Global Tags"), [role="tab"]:has-text("My Global Tags")');
  }

  // ── Creation ───────────────────────────────────────────────────────────────

  async clickCreateGlobalTag(): Promise<void> {
    await this.page.click('button:has-text("+ CREATE GLOBAL TAG"), button:has-text("CREATE GLOBAL TAG"), button:has-text("Create Global Tag")');
  }

  async checkTriggerAvailability(trigger: string): Promise<string> {
    await this.page.fill('[class*="trigger"] input, input[name="trigger"]', trigger);
    await this.page.waitForTimeout(1500);
    const banner = this.page.locator('[class*="availability"], [class*="trigger-status"]').first();
    return await banner.innerText().catch(() => '');
  }

  async isTriggerAvailable(): Promise<boolean> {
    const el = this.page.locator('[class*="available"]:not([class*="unavailable"]), text=Available').first();
    return await el.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async isTriggerTaken(): Promise<boolean> {
    const el = this.page.locator('[class*="unavailable"], text=Taken, text=Already taken, text=not available').first();
    return await el.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async enableMonetize(): Promise<void> {
    await this.page.click('input[value="monetize"], label:has-text("Monetize"), [class*="monetize"] input[type="radio"]');
  }

  async enableFreeGlobal(): Promise<void> {
    await this.page.click('input[value="free"], label:has-text("Free"), [class*="free"] input[type="radio"]');
  }

  async fillSellPrice(price: string): Promise<void> {
    const priceInput = this.page.locator('input[name="sellPrice"], input[name="price"], input[placeholder*="price"]').first();
    if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await priceInput.fill(price);
    }
  }

  async fillGlobalTagForm(data: {
    trigger: string;
    description?: string;
    monetize?: boolean;
    sellPrice?: string;
  }): Promise<void> {
    await this.page.fill('[class*="trigger"] input, input[name="trigger"]', data.trigger);
    if (data.description) {
      const descEl = this.page.locator('input[name="description"], textarea[name="description"]').first();
      if (await descEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descEl.fill(data.description);
      }
    }
    if (data.monetize) {
      await this.enableMonetize();
    } else {
      await this.enableFreeGlobal().catch(() => {});
    }
    if (data.sellPrice) {
      await this.fillSellPrice(data.sellPrice);
    }
  }

  async submitGlobalTag(): Promise<void> {
    await this.page.click('button:has-text("SAVE"), button:has-text("Create"), button:has-text("PUBLISH"), button[type="submit"]');
  }

  // ── Marketplace browsing ───────────────────────────────────────────────────

  async searchMarketplace(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"], input[type="search"]', query);
  }

  async filterMarketplaceByType(type: string): Promise<void> {
    await this.page.click(`button:has-text("${type}"), [class*="filter"]:has-text("${type}")`);
  }

  async getMarketplaceTagCount(): Promise<number> {
    const cards = this.page.locator('[class*="tag-card"], [class*="global-tag-card"]');
    return await cards.count();
  }

  async clickGlobalTagCard(trigger: string): Promise<void> {
    await this.page.click(`[class*="tag-card"]:has-text("${trigger}"), text=${trigger}`);
  }

  async subscribeToTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Subscribe"), button:has-text("USE"), button:has-text("Add")').first().click();
  }

  async unsubscribeFromTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Unsubscribe"), button:has-text("Remove")').first().click();
  }

  async purchaseTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Buy"), button:has-text("Purchase")').first().click();
  }

  // ── My Global Tags management ──────────────────────────────────────────────

  async editGlobalTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Edit"), button[aria-label*="edit"]').first().click();
  }

  async deleteGlobalTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Delete"), button[aria-label*="delete"]').first().click();
    const confirm = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
  }

  async unpublishGlobalTag(trigger: string): Promise<void> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    await card.locator('button:has-text("Unpublish"), button:has-text("Deactivate")').first().click();
  }

  async getGlobalTagStats(trigger: string): Promise<{ subscribers: string; scans: string }> {
    const card = this.page.locator(`[class*="tag-card"]:has-text("${trigger}")`).first();
    const subscribers = await card.locator('[class*="subscriber"], text=Subscribers').first().innerText().catch(() => '0');
    const scans = await card.locator('[class*="scan"], text=Scans').first().innerText().catch(() => '0');
    return { subscribers, scans };
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  async assertMarketplaceVisible(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Global Tags/i }).first()).toBeVisible();
  }

  async assertGlobalTagInList(trigger: string): Promise<void> {
    await expect(this.page.locator(`text=${trigger}`).first()).toBeVisible({ timeout: 10000 });
  }

  async assertGlobalTagNotInList(trigger: string): Promise<void> {
    await expect(this.page.locator(`text=${trigger}`).first()).not.toBeVisible({ timeout: 5000 });
  }

  async assertCreateSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=created, text=published, text=Global tag saved').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertSubscribeSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=subscribed, text=Added to your tags, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertMonetizedTagRequiresPayment(): Promise<void> {
    await expect(
      this.page.locator('text=Purchase required, text=Buy to use, text=Paid tag').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertDuplicateTriggerError(): Promise<void> {
    await expect(
      this.page.locator('text=already exists, text=trigger taken, text=unavailable').first()
    ).toBeVisible({ timeout: 5000 });
  }
}
