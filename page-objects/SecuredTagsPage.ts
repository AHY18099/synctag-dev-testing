import { Page, expect } from '@playwright/test';

export class SecuredTagsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Secured Tags, [class*="sidebar"] >> text=Secured Tags');
    await this.page.waitForURL(/\/secured-tags/, { timeout: 10000 }).catch(() => {});
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/secured-tags`, { waitUntil: 'domcontentloaded' });
  }

  // ── Vault initialization ───────────────────────────────────────────────────

  async clickInitializeVault(): Promise<void> {
    await this.page.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault"), button:has-text("Create Vault")');
  }

  async fillVaultForm(masterPassword: string, confirmPassword: string, hint?: string): Promise<void> {
    await this.page.fill('input[name="masterPassword"], input[placeholder*="Master Password"], input[type="password"]:first-of-type', masterPassword);
    const confirmInput = this.page.locator('input[name="confirmPassword"], input[placeholder*="Confirm"], input[type="password"]:last-of-type').first();
    if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmInput.fill(confirmPassword);
    }
    if (hint) {
      const hintInput = this.page.locator('input[name="hint"], input[placeholder*="Hint"]').first();
      if (await hintInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hintInput.fill(hint);
      }
    }
  }

  async submitVaultCreation(): Promise<void> {
    await this.page.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault"), button:has-text("SUBMIT")');
  }

  // ── Vault unlock/lock ─────────────────────────────────────────────────────

  async unlockVault(masterPassword: string): Promise<void> {
    await this.page.fill('input[type="password"], input[name="masterPassword"], input[placeholder*="Master Password"]', masterPassword);
    await this.page.click('button:has-text("UNLOCK"), button:has-text("Unlock"), button:has-text("OPEN VAULT")');
  }

  async lockVault(): Promise<void> {
    const lockBtn = this.page.locator('button:has-text("LOCK"), button:has-text("Lock Vault"), button[aria-label*="lock"]').first();
    if (await lockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lockBtn.click();
    }
  }

  async isVaultLocked(): Promise<boolean> {
    return this.page.locator('input[type="password"][placeholder*="Master"], button:has-text("UNLOCK")').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
  }

  // ── Credential management ─────────────────────────────────────────────────

  async clickAddCredential(): Promise<void> {
    await this.page.click('button:has-text("ADD"), button:has-text("+ Add"), button:has-text("New Credential"), button:has-text("ADD CREDENTIAL")');
  }

  async fillCredentialForm(data: {
    name: string;
    username: string;
    website: string;
    password: string;
    notes?: string;
  }): Promise<void> {
    await this.page.fill('input[name="name"], input[placeholder*="Name"], input[placeholder*="site name"]', data.name);
    await this.page.fill('input[name="username"], input[placeholder*="Username"], input[type="email"]', data.username);
    await this.page.fill('input[name="website"], input[placeholder*="Website"], input[placeholder*="URL"]', data.website);
    await this.page.fill('input[name="password"], input[placeholder*="Password"], input[type="password"]', data.password);
    if (data.notes) {
      const notesEl = this.page.locator('textarea[name="notes"], input[name="notes"], textarea[placeholder*="Notes"]').first();
      if (await notesEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesEl.fill(data.notes);
      }
    }
  }

  async submitCredential(): Promise<void> {
    await this.page.click('button:has-text("SAVE"), button:has-text("Save"), button:has-text("ADD"), button[type="submit"]');
  }

  async editCredential(name: string): Promise<void> {
    const card = this.page.locator(`[class*="credential"]:has-text("${name}")`).first();
    await card.locator('button:has-text("Edit"), button[aria-label*="edit"]').first().click();
  }

  async deleteCredential(name: string): Promise<void> {
    const card = this.page.locator(`[class*="credential"]:has-text("${name}")`).first();
    await card.locator('button:has-text("Delete"), button[aria-label*="delete"]').first().click();
    const confirm = this.page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
  }

  async viewCredentialPassword(name: string): Promise<void> {
    const card = this.page.locator(`[class*="credential"]:has-text("${name}")`).first();
    await card.locator('button[aria-label*="show"], button[aria-label*="view"], button:has-text("Show")').first().click();
  }

  async copyCredential(name: string, field: 'username' | 'password' | 'website'): Promise<void> {
    const card = this.page.locator(`[class*="credential"]:has-text("${name}")`).first();
    await card.locator(`button[aria-label*="copy ${field}"], button[title*="${field}"]`).first().click();
  }

  async searchCredential(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"], input[type="search"]', query);
  }

  // ── Generator ────────────────────────────────────────────────────────────

  async openPasswordGenerator(): Promise<void> {
    const genBtn = this.page.locator('button:has-text("Generate"), button[aria-label*="generate"], [class*="generator"]').first();
    if (await genBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await genBtn.click();
    }
  }

  async getGeneratedPassword(): Promise<string> {
    const el = this.page.locator('[class*="generated"], input[readonly][type="text"], [class*="password-output"]').first();
    return await el.inputValue().catch(() => el.innerText());
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async assertVaultInitState(): Promise<void> {
    await expect(this.page.locator('h1, h2, h3').filter({ hasText: /Initialize Your Vault/i }).first()).toBeVisible();
  }

  async assertVaultUnlocked(): Promise<void> {
    await expect(
      this.page.locator('[class*="vault-content"], [class*="credentials"], button:has-text("ADD")').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertCredentialInList(name: string): Promise<void> {
    await expect(this.page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
  }

  async assertCredentialNotInList(name: string): Promise<void> {
    await expect(this.page.locator(`text=${name}`).first()).not.toBeVisible({ timeout: 5000 });
  }

  async assertWrongPasswordError(): Promise<void> {
    await expect(
      this.page.locator('text=incorrect, text=wrong password, text=invalid password, [class*="error"]').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertCredentialSaved(): Promise<void> {
    await expect(
      this.page.locator('text=saved, text=Credential added, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertEmptyVault(): Promise<void> {
    await expect(
      this.page.locator('text=No credentials, text=Add your first, text=empty').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertAccessDeniedWithoutUnlock(): Promise<void> {
    const locked = await this.isVaultLocked();
    expect(locked).toBeTruthy();
  }

  // ── Composite helpers ─────────────────────────────────────────────────────

  async addCredential(data: {
    name: string;
    username: string;
    website: string;
    password: string;
    notes?: string;
  }): Promise<void> {
    await this.clickAddCredential();
    await this.fillCredentialForm(data);
    await this.submitCredential();
  }
}
