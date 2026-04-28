import { Page, expect } from '@playwright/test';

export class SecuredTagsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Secured Tags, [class*="sidebar"] >> text=Secured Tags');
    await this.page.waitForURL(/\/secured-tags/, { timeout: 10000 });
  }

  async clickInitializeVault(): Promise<void> {
    await this.page.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
  }

  async fillVaultForm(masterPassword: string, confirmPassword: string, hint?: string): Promise<void> {
    await this.page.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', masterPassword);
    await this.page.fill('input[name="confirmPassword"], input[placeholder*="Confirm Password"]', confirmPassword);
    if (hint) {
      await this.page.fill('input[name="hint"], input[placeholder*="Hint"]', hint);
    }
  }

  async submitVaultCreation(): Promise<void> {
    await this.page.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
  }

  async unlockVault(masterPassword: string): Promise<void> {
    await this.page.fill('input[type="password"], input[name="masterPassword"]', masterPassword);
    await this.page.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
  }

  async assertVaultInitState(): Promise<void> {
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Initialize Your Vault/i })).toBeVisible();
  }
}
