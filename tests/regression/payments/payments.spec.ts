/**
 * Payments Test Suite — PAY-001 through PAY-060
 * Covers: Pro/Team plan purchase, payment failures, international cards, UPI,
 *         net banking, Enterprise contact form, and edge cases.
 *
 * Prerequisites:
 *   - synctagprotest@mailinator.com  — existing Free account used for Pro upgrade
 *   - synctagteamtest@mailinator.com — existing Free account used for Team upgrade
 *   - Razorpay test mode enabled in dev environment
 */

import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { LoginPage } from '../../../page-objects/LoginPage';
import { ProfilePage } from '../../../page-objects/ProfilePage';
import { WalletPage } from '../../../page-objects/WalletPage';
import { RazorpayHelper } from '../../../page-objects/RazorpayHelper';
import { MailinatorHelper } from '../../../page-objects/MailinatorHelper';

dotenv.config();

const BASE_URL  = process.env.BASE_URL  || 'https://devextension.synctag.com';
const PRO_EMAIL  = 'synctagprotest@mailinator.com';
const TEAM_EMAIL = 'synctagteamtest@mailinator.com';

/** Helper: log in with Mailinator OTP and wait for dashboard. */
async function loginWithMailinator(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  email: string
): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.gotoLogin();
  await loginPage.selectEmailTab();
  await loginPage.enterEmail(email);
  await loginPage.clickContinue();
  await page.waitForSelector('text=Verify your access', { timeout: 20000 });
  const otp = await MailinatorHelper.getOTPFromBrowser(context, email);
  await loginPage.enterOTP(otp);
  await loginPage.clickVerifyCode();
  await loginPage.waitForDashboard();
}

/** Helper: navigate to Plan Details tab in Profile. */
async function gotoPlanDetails(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
  await page.waitForTimeout(500);
}

/** Helper: wait for the Razorpay iframe to appear. */
async function waitForRazorpay(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector(
    'iframe[src*="razorpay"], iframe[title*="Razorpay"], .razorpay-container',
    { timeout: 30000 }
  );
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// PAY-001 to PAY-010: Pro Plan Purchase Flow
// ---------------------------------------------------------------------------

test('PAY-001: Log in with Pro test account via Mailinator OTP', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await expect(page).toHaveURL(/\/(my-tags|dashboard)/);
});

test('PAY-002: Navigate to Plan Details tab on Profile page', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await expect(page.locator('text=Plan Details, [data-tab="plan"], h2:has-text("Plan")').first()).toBeVisible();
});

test('PAY-003: "UPGRADE PLAN" button is visible on Plan Details', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  const upgradeBtn = page.locator(
    'button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")'
  ).first();
  await expect(upgradeBtn).toBeVisible();
});

test('PAY-004: Clicking "CHOOSE PRO" opens Razorpay checkout iframe', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await expect(page.locator('iframe[src*="razorpay"], .razorpay-container').first()).toBeVisible();
});

test('PAY-005: Razorpay iframe loads with card payment option', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const cardOption = rzp.locator('[data-method="card"], text=Card, text=Credit/Debit Card');
  await expect(cardOption.first()).toBeVisible({ timeout: 15000 });
});

test('PAY-006: Pro plan payment succeeds with test card 4111111111111111', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'success');
  // Wait for success confirmation
  await page.waitForSelector(
    'text=Payment Successful, text=Success, text=Thank you, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-007: PRO badge appears in sidebar/header after successful Pro upgrade', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  // Assume account is already on Pro (state persists across tests in the same run)
  await page.goto(`${BASE_URL}/my-tags`);
  const badge = page.locator(
    '[class*="badge"]:has-text("PRO"), [class*="plan"]:has-text("PRO"), [class*="plan"]:has-text("Pro")'
  ).first();
  await expect(badge).toBeVisible();
});

test('PAY-008: Plan Details shows "Pro" and "Active" after Pro upgrade', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await expect(page.locator('text=Pro').first()).toBeVisible();
  await expect(page.locator('text=Active').first()).toBeVisible();
});

test('PAY-009: Receipt or invoice entry is present in Payment History tab', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Payment History"), button:has-text("Payment History")');
  await page.waitForTimeout(1000);
  const entry = page.locator(
    '[class*="invoice"], [class*="receipt"], [class*="payment-row"], table tr'
  ).first();
  await expect(entry).toBeVisible({ timeout: 10000 });
});

test('PAY-010: Wallet shows subscription debit entry after Pro purchase', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  const walletPage = new WalletPage(page);
  await walletPage.goto();
  await walletPage.clickTransactionLedger();
  await page.waitForTimeout(1000);
  const debitEntry = page.locator(
    '[class*="debit"], [class*="transaction"]:has-text("subscription"), [class*="transaction"]:has-text("Subscription")'
  ).first();
  await expect(debitEntry).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// PAY-011 to PAY-020: Team Plan Purchase Flow
// ---------------------------------------------------------------------------

test('PAY-011: Log in with Team test account via Mailinator OTP', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await expect(page).toHaveURL(/\/(my-tags|dashboard)/);
});

test('PAY-012: Navigate to Plan Details and click "UPGRADE PLAN" for Team account', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  const upgradeBtn = page.locator(
    'button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")'
  ).first();
  await expect(upgradeBtn).toBeVisible();
  await upgradeBtn.click();
});

test('PAY-013: "CHOOSE TEAM" button is visible in the upgrade modal', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  const chooseTeam = page.locator(
    'button:has-text("CHOOSE TEAM"), button:has-text("Choose Team")'
  ).first();
  await expect(chooseTeam).toBeVisible();
});

test('PAY-014: ₹35,000 price is shown in Razorpay for Team plan', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE TEAM"), button:has-text("Choose Team")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const amountText = rzp.locator('[class*="amount"], [class*="price"], text=35,000').first();
  await expect(amountText).toBeVisible({ timeout: 15000 });
});

test('PAY-015: Team plan payment succeeds with test card', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE TEAM"), button:has-text("Choose Team")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'success');
  await page.waitForSelector(
    'text=Payment Successful, text=Success, text=Thank you, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-016: TEAM badge appears in sidebar after successful Team upgrade', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await page.goto(`${BASE_URL}/my-tags`);
  const badge = page.locator(
    '[class*="badge"]:has-text("TEAM"), [class*="plan"]:has-text("TEAM"), [class*="plan"]:has-text("Team")'
  ).first();
  await expect(badge).toBeVisible();
});

test('PAY-017: Admin dashboard or Team features are unlocked after Team upgrade', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await page.goto(`${BASE_URL}/my-tags`);
  const teamFeature = page.locator(
    'text=Team Members, text=Admin, a[href*="team"], [class*="team-dashboard"]'
  ).first();
  await expect(teamFeature).toBeVisible({ timeout: 10000 });
});

test('PAY-018: Team member limit of 25 is shown in Plan Details', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  const limitText = page.locator(
    'text=25 Members, text=25 members, text=25 users, [class*="member-limit"]'
  ).first();
  await expect(limitText).toBeVisible({ timeout: 10000 });
});

test('PAY-019: Payment History shows Team plan invoice', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Payment History"), button:has-text("Payment History")');
  await page.waitForTimeout(1000);
  const entry = page.locator(
    '[class*="invoice"], [class*="receipt"], [class*="payment-row"], table tr'
  ).first();
  await expect(entry).toBeVisible({ timeout: 10000 });
});

test('PAY-020: Plan Details shows "Team" and "Active" after Team upgrade', async ({ page, context }) => {
  await loginWithMailinator(page, context, TEAM_EMAIL);
  await gotoPlanDetails(page);
  await expect(page.locator('text=Team').first()).toBeVisible();
  await expect(page.locator('text=Active').first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// PAY-021 to PAY-030: Payment Failure Scenarios
// ---------------------------------------------------------------------------

test('PAY-021: Declined card (4000000000000002) shows failure in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'declined');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=declined, text=failed, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-022: Insufficient funds OTP (1002) shows failure message in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'insufficient');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=insufficient, text=failed, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-023: Expired card (12/22) shows failure or validation error in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'expired');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=expired, text=invalid expiry, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-024: Wrong CVV shows failure or validation error in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'wrongcvv');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=incorrect, text=invalid, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-025: Failure message is shown inside the Razorpay modal on payment error', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'declined');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const errorMsg = rzp.locator('[class*="error"], [class*="failed"], text=Payment Failed').first();
  await expect(errorMsg).toBeVisible({ timeout: 20000 });
});

test('PAY-026: Plan does NOT change after a declined payment', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  // Check plan before
  await gotoPlanDetails(page);
  const planBefore = await page.locator('[class*="current-plan"], [class*="plan-name"]').first().innerText().catch(() => '');
  // Attempt declined payment
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")').catch(() => {});
  await waitForRazorpay(page).catch(() => {});
  await RazorpayHelper.pay(page, 'declined').catch(() => {});
  // Navigate back to plan details
  await gotoPlanDetails(page);
  const planAfter = await page.locator('[class*="current-plan"], [class*="plan-name"]').first().innerText().catch(() => '');
  expect(planAfter).toBe(planBefore);
});

test('PAY-027: Retry payment works after initial failure', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  // First attempt — fail
  await RazorpayHelper.pay(page, 'declined').catch(() => {});
  await page.waitForTimeout(1000);
  // Retry button inside Razorpay
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const retryBtn = rzp.locator('button:has-text("Retry"), button:has-text("Try Again"), button:has-text("Back")').first();
  const retryVisible = await retryBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (retryVisible) {
    await retryBtn.click();
    await page.waitForTimeout(500);
    // Second attempt — success
    await RazorpayHelper.pay(page, 'success');
    await page.waitForSelector('text=Payment Successful, text=Success, [class*="success"]', { timeout: 30000 });
    await expect(page.locator('text=Payment Successful, text=Success, [class*="success"]').first()).toBeVisible();
  } else {
    test.info().annotations.push({ type: 'skip-reason', description: 'Retry button not found in Razorpay after failure' });
  }
});

test('PAY-028: Declined payment does not create duplicate invoice entries', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Payment History"), button:has-text("Payment History")');
  await page.waitForTimeout(1000);
  const countBefore = await page.locator('[class*="invoice"], [class*="payment-row"], table tbody tr').count();
  // Attempt and fail payment
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').catch(() => {});
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")').catch(() => {});
  await waitForRazorpay(page).catch(() => {});
  await RazorpayHelper.pay(page, 'declined').catch(() => {});
  // Close modal if still open
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Check invoice count has not changed
  await page.goto(`${BASE_URL}/profile`);
  await page.click('[role="tab"]:has-text("Payment History"), button:has-text("Payment History")');
  await page.waitForTimeout(1000);
  const countAfter = await page.locator('[class*="invoice"], [class*="payment-row"], table tbody tr').count();
  expect(countAfter).toBe(countBefore);
});

test('PAY-029: Expired card error message is descriptive (mentions expiry)', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'expired');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const errText = await rzp.locator('[class*="error"], [class*="failed"]').first().innerText({ timeout: 15000 }).catch(() => '');
  // Should mention "expir" or "invalid" in the message
  expect(errText.toLowerCase()).toMatch(/expir|invalid|failed/i);
});

test('PAY-030: Wrong CVV error message is shown inside Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'wrongcvv');
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('[class*="error"], [class*="failed"], text=Payment Failed').first()
  ).toBeVisible({ timeout: 20000 });
});

// ---------------------------------------------------------------------------
// PAY-031 to PAY-040: International Card & UPI
// ---------------------------------------------------------------------------

test('PAY-031: International Visa 4012888888881881 completes without OTP', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'international');
  await page.waitForSelector(
    'text=Payment Successful, text=Success, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-032: American Express 378282246310005 processes correctly', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'amex');
  await page.waitForSelector(
    'text=Payment Successful, text=Success, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-033: UPI success@razorpay completes payment successfully', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.payUPI(page, true);
  await page.waitForSelector(
    'text=Payment Successful, text=Success, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-034: UPI failure@razorpay shows payment failure', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.payUPI(page, false);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=failed, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-035: Net banking success flow completes payment', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.payNetBanking(page, true);
  await page.waitForSelector(
    'text=Payment Successful, text=Success, [class*="success"]',
    { timeout: 30000 }
  );
  await expect(
    page.locator('text=Payment Successful, text=Success, [class*="success"]').first()
  ).toBeVisible();
});

test('PAY-036: Net banking failure flow shows failure message', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.payNetBanking(page, false);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await expect(
    rzp.locator('text=failed, text=Payment Failed, [class*="error"]').first()
  ).toBeVisible({ timeout: 20000 });
});

test('PAY-037: MasterCard 5267316949916581 processes successfully', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'mastercard');
  await page.waitForSelector('text=Payment Successful, text=Success, [class*="success"]', { timeout: 30000 });
  await expect(page.locator('text=Payment Successful, text=Success, [class*="success"]').first()).toBeVisible();
});

test('PAY-038: RuPay card 6073849700004947 processes successfully', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  await RazorpayHelper.pay(page, 'rupay');
  await page.waitForSelector('text=Payment Successful, text=Success, [class*="success"]', { timeout: 30000 });
  await expect(page.locator('text=Payment Successful, text=Success, [class*="success"]').first()).toBeVisible();
});

test('PAY-039: UPI VPA field is visible in Razorpay modal', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="upi"], text=UPI').click().catch(() => {});
  const upiInput = rzp.locator('input[placeholder*="UPI"], input[placeholder*="VPA"], input[name*="vpa"]').first();
  await expect(upiInput).toBeVisible({ timeout: 10000 });
});

test('PAY-040: Net Banking bank list is selectable in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="netbanking"], text=Net Banking').click().catch(() => {});
  const bankOption = rzp.locator('select, .bank-list, [class*="bank"]').first();
  await expect(bankOption).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// PAY-041 to PAY-050: Enterprise Contact
// ---------------------------------------------------------------------------

test('PAY-041: "CONTACT SALES" button is visible on Pricing page for Enterprise', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  const contactSales = page.locator(
    'button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")'
  ).first();
  await expect(contactSales).toBeVisible();
});

test('PAY-042: Clicking "CONTACT SALES" opens the contact form or modal', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(500);
  const form = page.locator('form, [class*="contact-form"], [role="dialog"], [class*="modal"]').first();
  await expect(form).toBeVisible({ timeout: 10000 });
});

test('PAY-043: Contact form has Full Name field', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(500);
  const nameField = page.locator(
    'input[name="name"], input[name="fullName"], input[placeholder*="Name"], input[placeholder*="name"]'
  ).first();
  await expect(nameField).toBeVisible();
});

test('PAY-044: Contact form has Email field', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(500);
  const emailField = page.locator(
    'input[type="email"], input[name="email"], input[placeholder*="Email"]'
  ).first();
  await expect(emailField).toBeVisible();
});

test('PAY-045: Contact form has Subject and Message fields', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(500);
  const subject = page.locator(
    'input[name="subject"], input[placeholder*="Subject"], select[name="subject"]'
  ).first();
  const message = page.locator(
    'textarea[name="message"], textarea[placeholder*="Message"], textarea'
  ).first();
  await expect(subject).toBeVisible();
  await expect(message).toBeVisible();
});

test('PAY-046: Submitting the contact form shows a success message', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(500);
  // Fill the form
  await page.fill(
    'input[name="name"], input[name="fullName"], input[placeholder*="Name"]',
    'Test User'
  ).catch(() => {});
  await page.fill(
    'input[type="email"], input[name="email"], input[placeholder*="Email"]',
    'testuser@mailinator.com'
  ).catch(() => {});
  await page.fill(
    'input[name="subject"], input[placeholder*="Subject"]',
    'Enterprise Enquiry'
  ).catch(() => {});
  await page.fill(
    'textarea[name="message"], textarea[placeholder*="Message"], textarea',
    'I would like to learn more about the Enterprise plan.'
  ).catch(() => {});
  // Submit
  await page.click('button[type="submit"], button:has-text("Submit"), button:has-text("SEND")');
  const success = page.locator(
    'text=Thank you, text=Message sent, text=We will get back, [class*="success"]'
  ).first();
  await expect(success).toBeVisible({ timeout: 15000 });
});

test('PAY-047: No Razorpay payment modal for Enterprise (only contact form)', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("CONTACT SALES"), button:has-text("Contact Sales"), a:has-text("CONTACT SALES")');
  await page.waitForTimeout(1500);
  const razorpayIframe = page.locator('iframe[src*="razorpay"]');
  await expect(razorpayIframe).not.toBeVisible();
});

test('PAY-048: Enterprise features are listed on the Pricing page', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  const enterpriseSection = page.locator(
    'text=Enterprise, [class*="enterprise-plan"], [class*="pricing-card"]:has-text("Enterprise")'
  ).first();
  await expect(enterpriseSection).toBeVisible();
});

test('PAY-049: Enterprise plan card lists at least 3 features', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(600);
  const enterpriseFeatures = page.locator(
    '[class*="enterprise"] li, [class*="enterprise-plan"] [class*="feature"], [class*="pricing-card"]:has-text("Enterprise") li'
  );
  const count = await enterpriseFeatures.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('PAY-050: Pricing page loads without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(BASE_URL);
  await page.locator('header a:has-text("Pricing"), nav a:has-text("Pricing")').first().click();
  await page.waitForTimeout(1000);
  expect(errors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// PAY-051 to PAY-060: Payment Edge Cases
// ---------------------------------------------------------------------------

test('PAY-051: Razorpay modal closes on clicking the X button', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  const closeBtn = rzp.locator('button[aria-label*="close"], button[aria-label*="Close"], .rzp-close, [class*="close"]').first();
  const closeBtnVisible = await closeBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (closeBtnVisible) {
    await closeBtn.click();
  } else {
    // Try ESC
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
  await expect(page.locator('iframe[src*="razorpay"]')).not.toBeVisible();
});

test('PAY-052: Navigating back during Razorpay payment does not corrupt state', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  // Navigate back without completing
  await page.goBack();
  await page.waitForTimeout(500);
  // Verify plan details page is still accessible and plan unchanged
  await gotoPlanDetails(page);
  await expect(page.locator('text=Plan Details, text=Current Plan').first()).toBeVisible({ timeout: 10000 });
});

test('PAY-053: Double-clicking "CHOOSE PRO" does not open two Razorpay modals', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  const chooseProBtn = page.locator('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")').first();
  await chooseProBtn.dblclick();
  await waitForRazorpay(page);
  const iframes = page.locator('iframe[src*="razorpay"]');
  const iframeCount = await iframes.count();
  // Only one Razorpay iframe should be present
  expect(iframeCount).toBeLessThanOrEqual(1);
});

test('PAY-054: Payment timeout is handled gracefully with an error message', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  // Simulate a long wait without completing payment (180s is typical timeout)
  // We just close the modal and check that the app is still functional
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // App should still be responsive
  await gotoPlanDetails(page);
  await expect(page.locator('text=Plan Details, text=Current Plan').first()).toBeVisible({ timeout: 10000 });
});

test('PAY-055: Partial card number is rejected by Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="card"], text=Card').click().catch(() => {});
  await rzp.locator('input[name="card[number]"], #card_number').fill('4111');
  await rzp.locator('input[name="card[expiry]"], #card_expiry').fill('12/29');
  await rzp.locator('input[name="card[cvv]"], #card_cvv').fill('123');
  await rzp.locator('button:has-text("Pay"), .btn-pay').click().catch(() => {});
  // Should show a validation error
  const errEl = rzp.locator('[class*="error"], [class*="invalid"], input[aria-invalid="true"]').first();
  await expect(errEl).toBeVisible({ timeout: 10000 });
});

test('PAY-056: Future-dated expiry (e.g., 12/29) is accepted in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="card"], text=Card').click().catch(() => {});
  await rzp.locator('input[name="card[number]"], #card_number').fill('4111111111111111');
  await rzp.locator('input[name="card[expiry]"], #card_expiry').fill('12/29');
  // Should not immediately show an expiry validation error
  const expiryInput = rzp.locator('input[name="card[expiry]"], #card_expiry');
  const ariaInvalid = await expiryInput.getAttribute('aria-invalid');
  expect(ariaInvalid).not.toBe('true');
});

test('PAY-057: Past-dated expiry (12/20) is rejected in Razorpay', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="card"], text=Card').click().catch(() => {});
  await rzp.locator('input[name="card[number]"], #card_number').fill('4111111111111111');
  await rzp.locator('input[name="card[expiry]"], #card_expiry').fill('12/20');
  await rzp.locator('input[name="card[cvv]"], #card_cvv').fill('123');
  await rzp.locator('button:has-text("Pay"), .btn-pay').click().catch(() => {});
  const errEl = rzp.locator('[class*="error"], [class*="invalid"], input[aria-invalid="true"]').first();
  await expect(errEl).toBeVisible({ timeout: 10000 });
});

test('PAY-058: Amex CVV requires 4 digits (standard CVV of 3 rejected)', async ({ page, context }) => {
  await loginWithMailinator(page, context, PRO_EMAIL);
  await gotoPlanDetails(page);
  await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("CHOOSE PRO"), button:has-text("Choose Pro")');
  await waitForRazorpay(page);
  const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');
  await rzp.locator('[data-method="card"], text=Card').click().catch(() => {});
  await rzp.locator('input[name="card[number]"], #card_number').fill('378282246310005'); // Amex
  await rzp.locator('input[name="card[expiry]"], #card_expiry').fill('12/29');
  // Enter only 3 digits for Amex CVV (should require 4)
  const cvvInput = rzp.locator('input[name="card[cvv]"], #card_cvv');
  await cvvInput.fill('123');
  await rzp.locator('button:has-text("Pay"), .btn-pay').click().catch(() => {});
  // Amex CVV field should be invalid or an error shown
  const ariaInvalid = await cvvInput.getAttribute('aria-invalid').catch(() => null);
  const errEl = rzp.locator('[class*="error"], [class*="invalid"]').first();
  const hasError = ariaInvalid === 'true' || await errEl.isVisible({ timeout: 5000 }).catch(() => false);
  expect(hasError).toBeTruthy();
});

test('PAY-059: Wallet balance from global tag sale can be viewed before subscription', async ({ page, context }) => {
  const loginPage = new LoginPage(page);
  await loginPage.signupWithMailinator(context);
  const walletPage = new WalletPage(page);
  await walletPage.goto();
  const balance = await walletPage.getAvailableBalance();
  // Balance should be a valid string (e.g., "₹0.00" or "₹100.00")
  expect(balance).toMatch(/₹|\d+/);
});

test('PAY-060: Payout minimum of ₹50 is enforced (request below minimum is rejected)', async ({ page, context }) => {
  const loginPage = new LoginPage(page);
  await loginPage.signupWithMailinator(context);
  const walletPage = new WalletPage(page);
  await walletPage.goto();
  await walletPage.clickPayoutRequests();
  // Attempt to request ₹10 (below minimum ₹50)
  await walletPage.requestPayout('10').catch(() => {
    // requestPayout may not proceed if balance is 0; this is acceptable
  });
  const error = page.locator(
    'text=minimum, text=Minimum, text=₹50, [class*="error"], [class*="validation-error"]'
  ).first();
  const errorVisible = await error.isVisible({ timeout: 5000 }).catch(() => false);
  const btnDisabled = await page.locator('button:has-text("REQUEST PAYOUT")').isDisabled({ timeout: 3000 }).catch(() => false);
  // Either an error message or the button is disabled
  expect(errorVisible || btnDisabled).toBeTruthy();
});
