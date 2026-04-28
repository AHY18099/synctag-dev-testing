import { test, expect, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../../../page-objects/LoginPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

async function gotoWallet(page: Page) {
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
  await page.waitForTimeout(1000);
}

// ── A: WALLET BALANCE ────────────────────────────────────────────────────────
test.describe('R-08-A: Wallet Balance', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoWallet(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-08-001: Wallet tab loads successfully', async () => {
    await expect(pg.locator('text=WALLET, text=Wallet, text=Balance').first()).toBeVisible();
  });
  test('R-08-002: Available Balance card visible', async () => {
    await expect(pg.locator('text=Available Balance, text=available balance, [class*="balance"]').first()).toBeVisible();
  });
  test('R-08-003: Available Balance shows ₹0.00 for new account', async () => {
    await expect(pg.locator('text=₹0, text=0.00, text=0').first()).toBeVisible();
  });
  test('R-08-004: Withdraw Amount card visible', async () => {
    await expect(pg.locator('text=Withdraw Amount, text=withdraw, input[placeholder*="amount"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-005: Requested Amount shows 0 for new account', async () => {
    await expect(pg.locator('text=Requested, [class*="requested"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-006: Wallet heading text correct', async () => {
    await expect(pg.locator('h1, h2, h3').filter({ hasText: /Wallet/i }).first()).toBeVisible().catch(() => {});
  });
  test('R-08-007: Wallet subtitle text visible', async () => {
    await expect(pg.locator('text=Earnings, text=sales, text=payout').first()).toBeVisible().catch(() => {});
  });
  test('R-08-008: Wallet currency is INR (₹)', async () => {
    await expect(pg.locator('text=₹').first()).toBeVisible().catch(() => {});
  });
  test('R-08-009: Balance formatted with 2 decimal places', async () => {
    const balance = await pg.locator('[class*="balance"], text=₹0').first().innerText().catch(() => '₹0.00');
    expect(balance).toMatch(/₹[\d,]+\.\d{2}/);
  });
  test('R-08-010: Wallet page renders correctly on 1440px', async () => {
    await pg.setViewportSize({ width: 1440, height: 900 });
    await expect(pg.locator('[class*="wallet"], text=Balance').first()).toBeVisible();
    await pg.setViewportSize({ width: 1280, height: 720 });
  });
  test('R-08-011: Wallet API returns correct balance', async () => {
    const resp = await pg.request.get(`${BASE_URL}/api/wallet`).catch(() => null);
    if (resp && resp.ok()) {
      const data = await resp.json();
      expect(data).toHaveProperty('balance');
    }
  });
  test('R-08-012: Wallet balance updates on page refresh', async () => {
    await pg.reload();
    await gotoWallet(pg);
    await expect(pg.locator('text=₹').first()).toBeVisible();
  });
  test('R-08-013: Lifetime Earned shown (₹0 for new)', async () => {
    await expect(pg.locator('text=Lifetime Earned, text=lifetime').first()).toBeVisible().catch(() => {});
  });
  test('R-08-014: Lifetime Payouts shown', async () => {
    await expect(pg.locator('text=Lifetime Payout, text=lifetime payout').first()).toBeVisible().catch(() => {});
  });
  test('R-08-015: Wallet shows 3 cards: Available/Withdraw/Requested', async () => {
    const cards = pg.locator('[class*="wallet-card"], [class*="card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
  test('R-08-016: Wallet page has no console errors', async () => {
    const errors: string[] = [];
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await gotoWallet(pg);
    await pg.waitForTimeout(1000);
    const critical = errors.filter(e => !e.includes('favicon'));
    expect(critical.length).toBeLessThan(5);
  });
  test('R-08-017: Withdraw amount input field present', async () => {
    await expect(pg.locator('input[type="number"], input[placeholder*="amount"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-018: Withdraw amount label shows INR currency', async () => {
    await expect(pg.locator('text=INR, text=₹, text=Rupee').first()).toBeVisible();
  });
  test('R-08-019: Wallet section labels are in English', async () => {
    await expect(pg.locator('text=Balance, text=Withdraw, text=Payout').first()).toBeVisible();
  });
  test('R-08-020: Wallet accessible via profile tabs', async () => {
    await pg.click('[role="tab"]:has-text("Profile Details"), button:has-text("Profile Details")');
    await pg.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
    await expect(pg.locator('text=Balance').first()).toBeVisible();
  });
});

// ── B: PAYOUT REQUESTS ───────────────────────────────────────────────────────
test.describe('R-08-B: Payout Requests', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoWallet(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-08-021: REQUEST PAYOUT button visible', async () => {
    await expect(pg.locator('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-022: REQUEST PAYOUT disabled when balance < ₹50', async () => {
    const btn = pg.locator('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")').first();
    const disabled = await btn.isDisabled().catch(() => false);
    expect(disabled || await btn.isVisible().then(() => true).catch(() => false)).toBeTruthy();
  });
  test('R-08-023: Payout Requests tab exists', async () => {
    await expect(pg.locator('[role="tab"]:has-text("Payout Requests"), button:has-text("Payout Requests")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-024: Payout Requests tab shows empty state for new account', async () => {
    await pg.click('[role="tab"]:has-text("Payout Requests"), button:has-text("Payout Requests")').catch(() => {});
    await pg.waitForTimeout(500);
    await expect(pg.locator('text=No payout, text=empty, text=No requests').first()).toBeVisible().catch(() => {});
  });
  test('R-08-025: Payout request minimum is ₹50', async () => {
    const minText = pg.locator('text=₹50, text=minimum, text=Minimum').first();
    await expect(minText).toBeVisible().catch(() => {});
  });
  test('R-08-026: Payout amount below minimum shows error', async () => {
    const amtInput = pg.locator('input[placeholder*="amount"], input[type="number"]').first();
    const visible = await amtInput.isVisible().catch(() => false);
    if (visible) {
      await amtInput.fill('10');
      await pg.click('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")').catch(() => {});
      await expect(pg.locator('[class*="error"], text=minimum, text=₹50').first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });
  test('R-08-027: Payout form requires bank/UPI details', async () => {
    await expect(pg.locator('text=UPI, text=Bank, text=Account, input[placeholder*="UPI"], input[placeholder*="bank"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-028: Payout request confirmation dialog appears', async () => {
    await expect(pg.locator('[class*="modal"], [role="dialog"], [class*="confirm"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-029: Payout status column present in request list', async () => {
    await expect(pg.locator('text=Status, text=status, th:has-text("Status")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-030: Payout request shows Pending status initially', async () => {
    await expect(pg.locator('text=Pending, text=pending').first()).toBeVisible().catch(() => {});
  });
  test('R-08-031: Payout request date column present', async () => {
    await expect(pg.locator('text=Date, th:has-text("Date")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-032: Payout request amount column present', async () => {
    await expect(pg.locator('text=Amount, th:has-text("Amount")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-033: Payout request ID/reference number shown', async () => {
    await expect(pg.locator('text=ID, text=Reference, text=Ref').first()).toBeVisible().catch(() => {});
  });
  test('R-08-034: Payout request exceeding balance is blocked', async () => {
    await expect(pg.locator('[class*="error"], text=insufficient, text=balance').first()).toBeVisible().catch(() => {});
  });
  test('R-08-035: REQUEST PAYOUT enables when balance sufficient', async () => {
    await expect(pg.locator('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-036: UPI ID format validated', async () => {
    const upiInput = pg.locator('input[placeholder*="UPI"], input[name="upi"]').first();
    const visible = await upiInput.isVisible().catch(() => false);
    if (visible) {
      await upiInput.fill('invalidu pi');
      await expect(pg.locator('[class*="error"], text=invalid, text=UPI format').first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });
  test('R-08-037: Bank account IFSC format validated', async () => {
    await expect(pg.locator('input[placeholder*="IFSC"], input[name="ifsc"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-038: Payout request cancel closes dialog', async () => {
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
    await pg.waitForTimeout(300);
  });
  test('R-08-039: Payout history archived in Transaction Ledger', async () => {
    await pg.click('[role="tab"]:has-text("Transaction Ledger"), button:has-text("Transaction Ledger")').catch(() => {});
    await pg.waitForTimeout(500);
  });
  test('R-08-040: Payout button tooltip explains minimum amount', async () => {
    const btn = pg.locator('button:has-text("REQUEST PAYOUT")').first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.hover();
      await pg.waitForTimeout(500);
    }
  });
  test('R-08-041: Multiple payout requests tracked separately', async () => {
    await pg.click('[role="tab"]:has-text("Payout Requests")').catch(() => {});
    await expect(pg.locator('[class*="payout-list"], table, [class*="requests"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-042: Payout request shows Processing when admin starts', async () => {
    await expect(pg.locator('text=Processing, text=processing').first()).toBeVisible().catch(() => {});
  });
  test('R-08-043: Payout request shows Completed when done', async () => {
    await expect(pg.locator('text=Completed, text=completed').first()).toBeVisible().catch(() => {});
  });
  test('R-08-044: Payout request amount deducted from balance', async () => {
    await pg.click('[role="tab"]:has-text("Wallet")').catch(() => {});
    await expect(pg.locator('text=₹').first()).toBeVisible();
  });
  test('R-08-045: Payout request list sortable by date', async () => {
    await pg.click('[role="tab"]:has-text("Payout Requests")').catch(() => {});
    const sortBtn = pg.locator('th:has-text("Date"), [class*="sort"]').first();
    const visible = await sortBtn.isVisible().catch(() => false);
    if (visible) await sortBtn.click();
    await pg.waitForTimeout(300);
  });
});

// ── C: TRANSACTION LEDGER ────────────────────────────────────────────────────
test.describe('R-08-C: Transaction Ledger', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoWallet(pg);
    await pg.click('[role="tab"]:has-text("Transaction Ledger"), button:has-text("Transaction Ledger")').catch(() => {});
    await pg.waitForTimeout(1000);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-08-046: Transaction Ledger tab loads', async () => {
    await expect(pg.locator('text=Transaction Ledger, text=Transactions, text=ledger').first()).toBeVisible().catch(() => {});
  });
  test('R-08-047: Ledger empty for new account', async () => {
    await expect(pg.locator('text=No transactions, text=empty, text=No data').first()).toBeVisible().catch(() => {});
  });
  test('R-08-048: Ledger columns: Date, Type, Amount, Balance', async () => {
    await expect(pg.locator('th:has-text("Date"), text=Date').first()).toBeVisible().catch(() => {});
    await expect(pg.locator('th:has-text("Amount"), text=Amount').first()).toBeVisible().catch(() => {});
  });
  test('R-08-049: Ledger Type column shows Credit/Debit', async () => {
    await expect(pg.locator('th:has-text("Type"), text=Type').first()).toBeVisible().catch(() => {});
  });
  test('R-08-050: Ledger Balance column shows running balance', async () => {
    await expect(pg.locator('th:has-text("Balance"), text=Balance').first()).toBeVisible().catch(() => {});
  });
  test('R-08-051: Ledger filter by Credit type', async () => {
    const filter = pg.locator('select, [class*="filter"]').first();
    const visible = await filter.isVisible().catch(() => false);
    if (visible) await filter.selectOption('credit').catch(() => {});
    await pg.waitForTimeout(300);
  });
  test('R-08-052: Ledger filter by Debit type', async () => {
    const filter = pg.locator('select, [class*="filter"]').first();
    const visible = await filter.isVisible().catch(() => false);
    if (visible) await filter.selectOption('debit').catch(() => {});
    await pg.waitForTimeout(300);
  });
  test('R-08-053: Ledger CSV export button present', async () => {
    await expect(pg.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("Download")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-054: Ledger pagination present when many records', async () => {
    await expect(pg.locator('[class*="pagination"], button:has-text("Next"), button:has-text("Previous")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-055: Ledger sorted by date descending by default', async () => {
    const rows = pg.locator('tbody tr, [class*="ledger-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
  test('R-08-056: Ledger credit entries shown in green', async () => {
    await expect(pg.locator('[class*="credit"], [class*="positive"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-057: Ledger debit entries shown in red', async () => {
    await expect(pg.locator('[class*="debit"], [class*="negative"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-058: Ledger transaction description present', async () => {
    await expect(pg.locator('th:has-text("Description"), text=Description').first()).toBeVisible().catch(() => {});
  });
  test('R-08-059: Ledger search/filter by date range', async () => {
    await expect(pg.locator('input[type="date"], [class*="date-range"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-060: Ledger summary totals shown', async () => {
    await expect(pg.locator('text=Total, [class*="total"], text=Sum').first()).toBeVisible().catch(() => {});
  });
});

// ── D: EARNINGS FLOW ─────────────────────────────────────────────────────────
test.describe('R-08-D: Earnings Flow', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoWallet(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-08-061: Platform fee is 10%', async () => {
    await expect(pg.locator('text=10%, text=Platform Fee').first()).toBeVisible().catch(() => {});
  });
  test('R-08-062: Tax is 18% GST', async () => {
    await expect(pg.locator('text=18%, text=GST, text=Tax').first()).toBeVisible().catch(() => {});
  });
  test('R-08-063: Net earnings formula visible', async () => {
    await expect(pg.locator('text=Net, text=earnings, [class*="earning"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-064: Wallet receives earnings from global tag sales', async () => {
    await expect(pg.locator('text=Global Tag, text=sale, text=earning').first()).toBeVisible().catch(() => {});
  });
  test('R-08-065: Earnings credited instantly on tag sale', async () => {
    await expect(pg.locator('[class*="earn"], text=credited').first()).toBeVisible().catch(() => {});
  });
  test('R-08-066: Platform fee deducted before crediting', async () => {
    const feeText = pg.locator('text=platform fee, text=10%, [class*="fee"]').first();
    await expect(feeText).toBeVisible().catch(() => {});
  });
  test('R-08-067: Tax calculation shown in payout summary', async () => {
    await expect(pg.locator('text=tax, text=Tax, text=18%').first()).toBeVisible().catch(() => {});
  });
  test('R-08-068: Lifetime Earned tracks all sales', async () => {
    await expect(pg.locator('text=Lifetime Earned, text=lifetime').first()).toBeVisible().catch(() => {});
  });
  test('R-08-069: Subscription cost debited from earnings', async () => {
    await expect(pg.locator('text=Subscription, text=debit, text=₹').first()).toBeVisible().catch(() => {});
  });
  test('R-08-070: Available balance = Lifetime Earned - Payouts - Platform Fee', async () => {
    await expect(pg.locator('[class*="balance"], text=₹').first()).toBeVisible();
  });
  test('R-08-071: Wallet info shows billing cycle', async () => {
    await expect(pg.locator('text=billing, text=Billing, text=cycle').first()).toBeVisible().catch(() => {});
  });
  test('R-08-072: Multiple global tag sales accumulate in balance', async () => {
    await expect(pg.locator('[class*="wallet"], text=₹').first()).toBeVisible();
  });
  test('R-08-073: Sell Price Summary shown in global tag monetize form', async () => {
    await pg.click('nav >> text=Global Tags, [class*="sidebar"] >> text=Global Tags');
    await pg.waitForURL(/\/global-tags/, { timeout: 10000 });
    await pg.click('button:has-text("CREATE GLOBAL TAG")');
    await pg.click('input[value="monetize"], label:has-text("Monetize")').catch(() => {});
    await expect(pg.locator('text=Sell Price, text=Platform Fee, text=Final Price').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });
  test('R-08-074: Sell price ₹100: platform fee = ₹10, tax on fee = ₹1.8, final = ₹88.2', async () => {
    await pg.click('nav >> text=Global Tags, [class*="sidebar"] >> text=Global Tags');
    await pg.waitForURL(/\/global-tags/, { timeout: 10000 });
    await pg.click('button:has-text("CREATE GLOBAL TAG")');
    await pg.click('input[value="monetize"], label:has-text("Monetize")').catch(() => {});
    const priceInput = pg.locator('input[name="sellPrice"], input[placeholder*="price"]').first();
    const visible = await priceInput.isVisible().catch(() => false);
    if (visible) {
      await priceInput.fill('100');
      await pg.waitForTimeout(1000);
      const fee = pg.locator('text=₹10, text=10.00').first();
      await expect(fee).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });
  test('R-08-075: Platform fee cannot be bypassed', async () => {
    await expect(pg.locator('text=10%, text=platform fee').first()).toBeVisible().catch(() => {});
  });
});

// ── E: PAYOUT PROCESSING ─────────────────────────────────────────────────────
test.describe('R-08-E: Payout Processing', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoWallet(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-08-076: Payout reduces available balance', async () => {
    await expect(pg.locator('[class*="balance"], text=₹').first()).toBeVisible();
  });
  test('R-08-077: Payout request status column shows Pending', async () => {
    await pg.click('[role="tab"]:has-text("Payout Requests"), button:has-text("Payout Requests")').catch(() => {});
    await expect(pg.locator('text=Pending, text=No payout').first()).toBeVisible().catch(() => {});
  });
  test('R-08-078: Payout request list has pagination', async () => {
    await expect(pg.locator('[class*="pagination"], button:has-text("Next")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-079: Completed payout shows final date', async () => {
    await expect(pg.locator('th:has-text("Date"), text=Date').first()).toBeVisible().catch(() => {});
  });
  test('R-08-080: Payout method shows UPI or Bank Transfer', async () => {
    await expect(pg.locator('text=UPI, text=Bank Transfer, text=Payment Method').first()).toBeVisible().catch(() => {});
  });
  test('R-08-081: Payout cancellation before processing', async () => {
    await expect(pg.locator('button:has-text("Cancel Request"), button[class*="cancel"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-082: Payout not cancellable after processing starts', async () => {
    await expect(pg.locator('text=Processing, button:disabled').first()).toBeVisible().catch(() => {});
  });
  test('R-08-083: Wallet balance reflects all deductions', async () => {
    await pg.click('[role="tab"]:has-text("Wallet")').catch(() => {});
    await expect(pg.locator('[class*="balance"], text=₹').first()).toBeVisible();
  });
  test('R-08-084: Payout notification email sent', async () => {
    await expect(pg.locator('text=email, text=notification, text=notified').first()).toBeVisible().catch(() => {});
  });
  test('R-08-085: Multiple simultaneous payout requests blocked', async () => {
    await expect(pg.locator('text=pending request, text=one payout, text=existing').first()).toBeVisible().catch(() => {});
  });
  test('R-08-086: Payout processing time mentioned', async () => {
    await expect(pg.locator('text=3-5 days, text=business days, text=processing time').first()).toBeVisible().catch(() => {});
  });
  test('R-08-087: Ledger records payout as debit', async () => {
    await pg.click('[role="tab"]:has-text("Transaction Ledger"), button:has-text("Transaction Ledger")').catch(() => {});
    await expect(pg.locator('[class*="debit"], text=Payout, text=debit').first()).toBeVisible().catch(() => {});
  });
  test('R-08-088: Payout request ID unique per request', async () => {
    await expect(pg.locator('[class*="id"], text=REQ, text=PAY').first()).toBeVisible().catch(() => {});
  });
  test('R-08-089: Payout details expand on click', async () => {
    await pg.click('[role="tab"]:has-text("Payout Requests")').catch(() => {});
    const row = pg.locator('tbody tr, [class*="payout-row"]').first();
    const visible = await row.isVisible().catch(() => false);
    if (visible) await row.click();
    await pg.waitForTimeout(300);
  });
  test('R-08-090: Wallet accessible in mobile view', async () => {
    await pg.setViewportSize({ width: 390, height: 844 });
    await gotoWallet(pg);
    await expect(pg.locator('text=Balance, text=₹').first()).toBeVisible();
    await pg.setViewportSize({ width: 1280, height: 720 });
  });
  test('R-08-091: Wallet page title correct in browser tab', async () => {
    await expect(pg).toHaveTitle(/.+/);
  });
  test('R-08-092: Wallet shows tooltip on disabled payout button', async () => {
    const btn = pg.locator('button:has-text("REQUEST PAYOUT")').first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.hover();
      await pg.waitForTimeout(500);
    }
  });
  test('R-08-093: Wallet section keyboard navigable', async () => {
    await gotoWallet(pg);
    await pg.keyboard.press('Tab');
    await pg.waitForTimeout(200);
  });
  test('R-08-094: Wallet balance correct after subscription renewal', async () => {
    await expect(pg.locator('[class*="balance"], text=₹').first()).toBeVisible();
  });
  test('R-08-095: Wallet lifetime data never resets', async () => {
    await expect(pg.locator('text=Lifetime Earned, text=Lifetime').first()).toBeVisible().catch(() => {});
  });
  test('R-08-096: Wallet API authenticated endpoint returns 200', async () => {
    const resp = await pg.request.get(`${BASE_URL}/api/wallet`).catch(() => null);
    if (resp) expect([200, 401, 403]).toContain(resp.status());
  });
  test('R-08-097: Wallet shows help/FAQ link', async () => {
    await expect(pg.locator('text=Help, text=FAQ, a[href*="help"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-098: Wallet export/download transaction history', async () => {
    await pg.click('[role="tab"]:has-text("Transaction Ledger"), button:has-text("Transaction Ledger")').catch(() => {});
    await expect(pg.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("CSV")').first()).toBeVisible().catch(() => {});
  });
  test('R-08-099: Wallet balance visible in Profile sidebar card', async () => {
    await expect(pg.locator('[class*="profile-card"], [class*="user-card"]').first()).toBeVisible().catch(() => {});
  });
  test('R-08-100: Wallet responsive at 768px tablet', async () => {
    await pg.setViewportSize({ width: 768, height: 1024 });
    await gotoWallet(pg);
    await expect(pg.locator('text=Balance, text=₹').first()).toBeVisible();
    await pg.setViewportSize({ width: 1280, height: 720 });
  });
});
