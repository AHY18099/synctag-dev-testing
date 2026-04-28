import { Page, expect } from '@playwright/test';

export class ProfilePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('[class*="user-card"], [class*="avatar"], [class*="profile-btn"]');
    await this.page.click('text=Profile Details, text=Profile, a[href*="profile"]');
    await this.page.waitForURL(/\/profile/, { timeout: 10000 });
  }

  async clickTab(tab: 'Profile Details' | 'Global Page' | 'Plan Details' | 'Payment History' | 'Wallet'): Promise<void> {
    await this.page.click(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`);
  }

  async fillFirstName(name: string): Promise<void> {
    await this.page.fill('input[name="firstName"], input[placeholder*="First Name"]', name);
  }

  async fillLastName(name: string): Promise<void> {
    await this.page.fill('input[name="lastName"], input[placeholder*="Last Name"]', name);
  }

  async saveChanges(): Promise<void> {
    await this.page.click('button:has-text("SAVE CHANGES"), button:has-text("Save Changes")');
  }

  async clickUpgradePlan(): Promise<void> {
    await this.page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  }

  async choosePlan(plan: 'Pro' | 'Team'): Promise<void> {
    await this.page.click(`button:has-text("CHOOSE ${plan.toUpperCase()}"), button:has-text("Choose ${plan}")`);
  }

  async assertCurrentPlan(planName: string): Promise<void> {
    await expect(this.page.locator(`text=${planName}`).first()).toBeVisible();
  }
}
