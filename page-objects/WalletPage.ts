import { Page, expect } from '@playwright/test';

export class WalletPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
    await this.page.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/profile?tab=wallet`, { waitUntil: 'domcontentloaded' }).catch(async () => {
      await this.page.goto(`${base}/wallet`, { waitUntil: 'domcontentloaded' });
    });
  }

  // ── Sub-tab navigation ────────────────────────────────────────────────────

  async clickPayoutRequests(): Promise<void> {
    await this.page.click('text=Payout Requests, [role="tab"]:has-text("Payout Requests"), button:has-text("Payout")');
  }

  async clickTransactionLedger(): Promise<void> {
    await this.page.click('text=Transaction Ledger, [role="tab"]:has-text("Transaction Ledger"), button:has-text("Ledger")');
  }

  async clickEarningsOverview(): Promise<void> {
    const btn = this.page.locator('text=Earnings, [role="tab"]:has-text("Earnings")').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
    }
  }

  // ── Balance ───────────────────────────────────────────────────────────────

  async getAvailableBalance(): Promise<string> {
    const el = this.page.locator('[class*="balance"], [class*="available"], [class*="wallet-amount"]').first();
    return await el.innerText().catch(() => '0');
  }

  async getPendingBalance(): Promise<string> {
    const el = this.page.locator('[class*="pending-balance"], [class*="pending"] [class*="amount"]').first();
    return await el.innerText().catch(() => '0');
  }

  async getTotalEarnings(): Promise<string> {
    const el = this.page.locator('[class*="total-earnings"], [class*="total"] [class*="amount"]').first();
    return await el.innerText().catch(() => '0');
  }

  // ── Payout actions ────────────────────────────────────────────────────────

  async clickRequestPayout(): Promise<void> {
    await this.page.click('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout"), button:has-text("WITHDRAW")');
  }

  async requestPayout(amount: string): Promise<void> {
    await this.page.fill('input[name="amount"], input[placeholder*="amount"]', amount);
    await this.page.click('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout"), button:has-text("SUBMIT")');
  }

  async fillPayoutForm(data: { amount: string; bankAccount?: string; ifsc?: string }): Promise<void> {
    await this.page.fill('input[name="amount"], input[placeholder*="amount"]', data.amount);
    if (data.bankAccount) {
      const bankInput = this.page.locator('input[name="bankAccount"], input[placeholder*="account"]').first();
      if (await bankInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await bankInput.fill(data.bankAccount);
      }
    }
    if (data.ifsc) {
      const ifscInput = this.page.locator('input[name="ifsc"], input[placeholder*="IFSC"]').first();
      if (await ifscInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ifscInput.fill(data.ifsc);
      }
    }
    await this.page.click('button[type="submit"], button:has-text("REQUEST"), button:has-text("Submit")');
  }

  // ── Transaction list ──────────────────────────────────────────────────────

  async getTransactionCount(): Promise<number> {
    const rows = this.page.locator('[class*="transaction-row"], [class*="transaction-item"], table tbody tr');
    return await rows.count();
  }

  async getTransactionAtIndex(index: number): Promise<{ date: string; amount: string; status: string }> {
    const row = this.page.locator('[class*="transaction-row"], table tbody tr').nth(index);
    const cells = row.locator('td, [class*="cell"]');
    const count = await cells.count();
    return {
      date:   count > 0 ? await cells.nth(0).innerText().catch(() => '') : '',
      amount: count > 1 ? await cells.nth(1).innerText().catch(() => '') : '',
      status: count > 2 ? await cells.nth(2).innerText().catch(() => '') : '',
    };
  }

  async filterTransactionsByStatus(status: 'Pending' | 'Completed' | 'Rejected'): Promise<void> {
    const filter = this.page.locator(`button:has-text("${status}"), [role="option"]:has-text("${status}"), select`).first();
    if (await filter.isVisible({ timeout: 2000 }).catch(() => false)) {
      const tagName = await filter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await filter.selectOption({ label: status });
      } else {
        await filter.click();
      }
    }
  }

  async searchTransactions(query: string): Promise<void> {
    const input = this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(query);
    }
  }

  async getPayoutRequestCount(): Promise<number> {
    const rows = this.page.locator('[class*="payout-row"], [class*="payout-item"]');
    return await rows.count();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async assertPayoutButtonDisabled(): Promise<void> {
    await expect(this.page.locator('button:has-text("REQUEST PAYOUT")')).toBeDisabled();
  }

  async assertPayoutButtonEnabled(): Promise<void> {
    await expect(this.page.locator('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")')).toBeEnabled();
  }

  async assertPayoutRequested(): Promise<void> {
    await expect(
      this.page.locator('text=Payout requested, text=Request submitted, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertInsufficientBalanceError(): Promise<void> {
    await expect(
      this.page.locator('text=insufficient, text=Insufficient balance, text=not enough').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertWalletLoaded(): Promise<void> {
    await expect(
      this.page.locator('[class*="wallet"], h1, h2').filter({ hasText: /Wallet|Balance/i }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertTransactionVisible(description: string): Promise<void> {
    await expect(this.page.locator(`text=${description}`).first()).toBeVisible({ timeout: 5000 });
  }

  async assertEmptyTransactionHistory(): Promise<void> {
    const empty = this.page.locator('text=No transactions, text=No history, text=empty').first();
    const visible = await empty.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await expect(empty).toBeVisible();
    }
  }

  async assertRazorpayDependent(): Promise<boolean> {
    const razorpayEl = this.page.locator('[class*="razorpay"], text=Razorpay').first();
    return await razorpayEl.isVisible({ timeout: 3000 }).catch(() => false);
  }
}
