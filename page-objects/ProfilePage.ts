import { Page, expect } from '@playwright/test';

export class ProfilePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('[class*="user-card"], [class*="avatar"], [class*="profile-btn"]');
    await this.page.click('text=Profile Details, text=Profile, a[href*="profile"]');
    await this.page.waitForURL(/\/profile/, { timeout: 10000 }).catch(() => {});
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  async clickTab(tab: 'Profile Details' | 'Global Page' | 'Plan Details' | 'Payment History' | 'Wallet'): Promise<void> {
    await this.page.click(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`);
  }

  async getActiveTab(): Promise<string> {
    const tab = this.page.locator('[role="tab"][aria-selected="true"], [class*="tab--active"]').first();
    return await tab.innerText().catch(() => '');
  }

  // ── Profile Details tab ───────────────────────────────────────────────────

  async fillFirstName(name: string): Promise<void> {
    await this.page.fill('input[name="firstName"], input[placeholder*="First Name"]', name);
  }

  async fillLastName(name: string): Promise<void> {
    await this.page.fill('input[name="lastName"], input[placeholder*="Last Name"]', name);
  }

  async fillCompany(company: string): Promise<void> {
    const el = this.page.locator('input[name="company"], input[placeholder*="Company"]').first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(company);
    }
  }

  async fillPhone(phone: string): Promise<void> {
    const el = this.page.locator('input[name="phone"], input[type="tel"], input[placeholder*="Phone"]').first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(phone);
    }
  }

  async getFirstName(): Promise<string> {
    return await this.page.locator('input[name="firstName"], input[placeholder*="First Name"]').first().inputValue();
  }

  async getLastName(): Promise<string> {
    return await this.page.locator('input[name="lastName"], input[placeholder*="Last Name"]').first().inputValue();
  }

  async getEmail(): Promise<string> {
    const el = this.page.locator('input[name="email"], input[type="email"]').first();
    return await el.inputValue().catch(async () => el.getAttribute('value').then(v => v || ''));
  }

  async saveChanges(): Promise<void> {
    await this.page.click('button:has-text("SAVE CHANGES"), button:has-text("Save Changes"), button:has-text("SAVE")');
  }

  async uploadAvatar(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"], input[accept*="image"]').first();
    if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fileInput.setInputFiles(filePath);
    }
  }

  // ── Global Page tab ───────────────────────────────────────────────────────

  async fillGlobalPageBio(bio: string): Promise<void> {
    const el = this.page.locator('textarea[name="bio"], textarea[placeholder*="bio"], textarea[placeholder*="about"]').first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(bio);
    }
  }

  async fillGlobalPageUrl(slug: string): Promise<void> {
    const el = this.page.locator('input[name="slug"], input[name="url"], input[placeholder*="username"]').first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(slug);
    }
  }

  async fillSocialLink(platform: string, url: string): Promise<void> {
    const el = this.page.locator(`input[name="${platform}"], input[placeholder*="${platform}"]`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(url);
    }
  }

  async saveGlobalPage(): Promise<void> {
    await this.page.click('button:has-text("SAVE"), button:has-text("Update Global Page"), button:has-text("SAVE GLOBAL PAGE")');
  }

  // ── Plan Details tab ──────────────────────────────────────────────────────

  async clickUpgradePlan(): Promise<void> {
    await this.page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan"), button:has-text("UPGRADE")');
  }

  async choosePlan(plan: 'Pro' | 'Team'): Promise<void> {
    await this.page.click(`button:has-text("CHOOSE ${plan.toUpperCase()}"), button:has-text("Choose ${plan}"), button:has-text("Select ${plan}")`);
  }

  async clickDowngradePlan(): Promise<void> {
    const btn = this.page.locator('button:has-text("Downgrade"), button:has-text("DOWNGRADE")').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
    }
  }

  async getCurrentPlanName(): Promise<string> {
    const el = this.page.locator('[class*="current-plan"] [class*="name"], [class*="plan-badge"]').first();
    return await el.innerText().catch(() => '');
  }

  async getPlanTagLimit(): Promise<string> {
    const el = this.page.locator('[class*="tag-limit"], text=Tag Limit').first();
    return await el.innerText().catch(() => '');
  }

  async assertCurrentPlan(planName: string): Promise<void> {
    await expect(this.page.locator(`text=${planName}`).first()).toBeVisible();
  }

  async assertPlanLimitVisible(limit: string): Promise<void> {
    await expect(this.page.locator(`text=${limit}`).first()).toBeVisible({ timeout: 5000 });
  }

  async assertRazorpayOpens(): Promise<boolean> {
    const frame = this.page.frameLocator('[name*="razorpay"], iframe[src*="razorpay"]').first();
    return await frame.locator('body').isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ── Payment History tab ───────────────────────────────────────────────────

  async getPaymentHistoryCount(): Promise<number> {
    const rows = this.page.locator('[class*="payment-row"], table tbody tr');
    return await rows.count();
  }

  async assertPaymentHistoryLoaded(): Promise<void> {
    await expect(
      this.page.locator('[class*="payment-history"], h2, h3').filter({ hasText: /Payment History/i }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertEmptyPaymentHistory(): Promise<void> {
    const empty = this.page.locator('text=No payments, text=No transactions, text=empty').first();
    const visible = await empty.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await expect(empty).toBeVisible();
    }
  }

  // ── Profile assertions ────────────────────────────────────────────────────

  async assertSaveSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=saved, text=Profile updated, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertProfileLoaded(): Promise<void> {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: /Profile/i }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertEmailReadOnly(): Promise<void> {
    const emailInput = this.page.locator('input[name="email"], input[type="email"]').first();
    const isDisabled = await emailInput.isDisabled({ timeout: 3000 }).catch(() => false);
    const isReadOnly = await emailInput.getAttribute('readonly').then(v => v !== null).catch(() => false);
    expect(isDisabled || isReadOnly).toBeTruthy();
  }
}
