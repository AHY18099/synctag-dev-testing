import { Page, expect } from '@playwright/test';

export class WalletPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/profile`);
    await this.page.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
  }

  async clickPayoutRequests(): Promise<void> {
    await this.page.click('text=Payout Requests, [role="tab"]:has-text("Payout Requests")');
  }

  async clickTransactionLedger(): Promise<void> {
    await this.page.click('text=Transaction Ledger, [role="tab"]:has-text("Transaction Ledger")');
  }

  async requestPayout(amount: string): Promise<void> {
    await this.page.fill('input[name="amount"], input[placeholder*="amount"]', amount);
    await this.page.click('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")');
  }

  async getAvailableBalance(): Promise<string> {
    const el = this.page.locator('[class*="balance"], [class*="available"]').first();
    return await el.innerText();
  }

  async assertPayoutButtonDisabled(): Promise<void> {
    await expect(this.page.locator('button:has-text("REQUEST PAYOUT")')).toBeDisabled();
  }
}
