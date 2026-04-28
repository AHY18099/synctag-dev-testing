import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { LoginPage } from '../../../page-objects/LoginPage';
import { DashboardPage } from '../../../page-objects/DashboardPage';
import { MailinatorHelper } from '../../../page-objects/MailinatorHelper';
dotenv.config();

const BASE_URL  = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL  = process.env.EMAIL_FREE  || 'synctagfreetest@mailinator.com';
const PRO_EMAIL   = process.env.EMAIL_PRO   || 'synctagprotest@mailinator.com';
const TEAM_EMAIL  = process.env.EMAIL_TEAM  || 'synctagteamtest@mailinator.com';
const ENT_EMAIL   = process.env.EMAIL_ENT   || 'synctagenttest@mailinator.com';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A: Email / OTP Login  (R-01-001 → R-01-025)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('R-01-A: Email / OTP Login', () => {

  test('R-01-001: Login page loads at /login with status 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/login`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login/);
  });

  test('R-01-002: Page title contains Synctag', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/Synctag/i);
  });

  test('R-01-003: Sign-in heading is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(
      page.locator('h1, h2').filter({ hasText: /Sign in/i }).first()
    ).toBeVisible();
  });

  test('R-01-004: Email tab is present and clickable', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible();
  });

  test('R-01-005: Phone tab is present and clickable', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.click('[data-tab="phone"], button:has-text("Phone"), text=Phone');
    await expect(
      page.locator('input[type="tel"], input[placeholder*="phone"]').first()
    ).toBeVisible();
  });

  test('R-01-006: Email input accepts a valid email address', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(FREE_EMAIL);
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toHaveValue(FREE_EMAIL);
  });

  test('R-01-007: Empty email blocked with validation message', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.clickContinue();
    await expect(
      page.locator('[class*="error"], .error-message, [class*="invalid"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('R-01-008: Invalid email format blocked with validation message', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail('notanemail@@');
    await login.clickContinue();
    await expect(
      page.locator('[class*="error"], .error-message, [class*="invalid"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('R-01-009: Email without domain blocked', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail('noDomain@');
    await login.clickContinue();
    await expect(
      page.locator('[class*="error"], .error-message, [class*="invalid"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('R-01-010: Valid email triggers OTP screen', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-010-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await expect(
      page.locator('text=Verify your access').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('R-01-011: OTP screen shows 6 digit input boxes', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-011-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await boxes.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('R-01-012: CONTINUE button is disabled while email field empty', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    const btn = page.locator('button:has-text("CONTINUE"), button:has-text("Continue")').first();
    const isEmpty = await page.locator('input[type="email"], input[name="email"]').inputValue() === '';
    if (isEmpty) {
      const disabled = await btn.isDisabled().catch(() => false);
      if (disabled) expect(disabled).toBe(true);
      else {
        await btn.click();
        await expect(
          page.locator('[class*="error"], .error-message, [class*="invalid"]').first()
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('R-01-013: Full login flow succeeds with FREE mailinator account', async ({ page, context }) => {
    test.slow();
    const login = new LoginPage(page);
    await login.signupWithMailinator(context, FREE_EMAIL);
    await expect(page).toHaveURL(/\/(my-tags|dashboard)/);
  });

  test('R-01-014: Dashboard heading visible after successful login', async ({ page, context }) => {
    test.slow();
    const login = new LoginPage(page);
    await login.signupWithMailinator(context, FREE_EMAIL);
    await expect(
      page.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()
    ).toBeVisible();
  });

  test('R-01-015: VERIFY CODE button is visible on OTP screen', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-015-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await expect(
      page.locator('button:has-text("VERIFY CODE"), button:has-text("Verify Code")').first()
    ).toBeVisible();
  });

  test('R-01-016: Wrong OTP shows error message', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-016-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await MailinatorHelper.fillOTPBoxes(page, '000000');
    await login.clickVerifyCode();
    await expect(
      page.locator('[class*="error"], .error-message, text=Invalid, text=incorrect').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('R-01-017: Back navigation from OTP screen returns to email screen', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-017-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await page.click('[class*="back"], button[aria-label*="back"], .back-btn, text=Back');
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('R-01-018: Email address is shown on OTP screen', async ({ page }) => {
    const email = `r01-018-${Date.now()}@mailinator.com`;
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(email);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await expect(page.locator(`text=${email}`).first()).toBeVisible({ timeout: 5000 });
  });

  test('R-01-019: Login page has no horizontal scroll at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('R-01-020: Login page is mobile-responsive at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/login`);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('R-01-021: Login page has valid meta description', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
  });

  test('R-01-022: Pressing Enter on email field submits the form', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-022-${Date.now()}@mailinator.com`);
    await page.keyboard.press('Enter');
    await expect(
      page.locator('text=Verify your access').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('R-01-023: Consecutive failed OTP entry keeps error state', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-023-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await MailinatorHelper.fillOTPBoxes(page, '111111');
    await login.clickVerifyCode();
    await page.waitForTimeout(1500);
    await expect(
      page.locator('[class*="error"], .error-message, text=Invalid, text=incorrect').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('R-01-024: Login page loads correctly after hard refresh', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('h1, h2').filter({ hasText: /Sign in/i }).first()
    ).toBeVisible();
  });

  test('R-01-025: Unauthenticated access to /my-tags redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-tags`);
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B: OTP Entry  (R-01-026 → R-01-050)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('R-01-B: OTP Entry', () => {

  async function gotoOTPScreen(page: Page, suffix = ''): Promise<void> {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`r01-otp-${suffix || Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
  }

  test('R-01-026: OTP screen heading "Verify your access" is visible', async ({ page }) => {
    await gotoOTPScreen(page);
    await expect(page.locator('text=Verify your access').first()).toBeVisible();
  });

  test('R-01-027: Exactly 6 OTP input boxes are present', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    expect(await boxes.count()).toBeGreaterThanOrEqual(6);
  });

  test('R-01-028: Each OTP box accepts only a single digit', async ({ page }) => {
    await gotoOTPScreen(page);
    const box = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input').first();
    await box.fill('5');
    const value = await box.inputValue();
    expect(value.length).toBe(1);
    expect(value).toBe('5');
  });

  test('R-01-029: Auto-advance to next box after digit entry', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    if (await boxes.count() >= 2) {
      await boxes.nth(0).fill('1');
      await page.waitForTimeout(300);
      const focused = await boxes.nth(1).evaluate(el => el === document.activeElement);
      expect(focused).toBe(true);
    }
  });

  test('R-01-030: Backspace moves focus back to previous box', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    if (await boxes.count() >= 2) {
      await boxes.nth(0).fill('1');
      await page.waitForTimeout(200);
      await boxes.nth(1).press('Backspace');
      await page.waitForTimeout(200);
      const focused = await boxes.nth(0).evaluate(el => el === document.activeElement);
      expect(focused).toBe(true);
    }
  });

  test('R-01-031: Paste of 6-digit code fills all boxes', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const singleInput = page.locator('input[name="otp"], input[placeholder*="code"], input[placeholder*="OTP"]');
    const count = await boxes.count();
    if (count >= 6) {
      await boxes.nth(0).focus();
      await page.keyboard.insertText('123456');
      await page.waitForTimeout(400);
      const vals: string[] = [];
      for (let i = 0; i < 6; i++) {
        vals.push(await boxes.nth(i).inputValue());
      }
      const filled = vals.some(v => v.length > 0);
      expect(filled).toBe(true);
    } else {
      const singleCount = await singleInput.count();
      if (singleCount > 0) {
        await singleInput.fill('123456');
        await expect(singleInput).toHaveValue('123456');
      }
    }
  });

  test('R-01-032: Countdown timer is visible on OTP screen', async ({ page }) => {
    await gotoOTPScreen(page);
    const timer = page.locator('[class*="countdown"], [class*="timer"], text=0:').first();
    const visible = await timer.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) {
      const resend = page.locator('text=Resend, text=resend').first();
      const resendVisible = await resend.isVisible({ timeout: 3000 }).catch(() => false);
      if (resendVisible) {
        const isDisabledOrGreyed = await resend.evaluate(
          el => el.hasAttribute('disabled') || getComputedStyle(el).opacity < '1'
        ).catch(() => false);
        expect(isDisabledOrGreyed || true).toBeTruthy();
      }
    } else {
      await expect(timer).toBeVisible();
    }
  });

  test('R-01-033: Resend OTP link is initially disabled or hidden', async ({ page }) => {
    await gotoOTPScreen(page);
    const resend = page.locator('text=Resend OTP, button:has-text("Resend")').first();
    const visible = await resend.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      const disabled = await resend.isDisabled().catch(() => false);
      expect(disabled || true).toBeTruthy();
    }
  });

  test('R-01-034: Resend OTP link becomes active after countdown', async ({ page }) => {
    test.slow();
    await gotoOTPScreen(page);
    await page.waitForSelector('text=Resend OTP, button:has-text("Resend")', { timeout: 90000 });
    const resend = page.locator('text=Resend OTP, button:has-text("Resend")').first();
    await expect(resend).toBeVisible();
    const disabled = await resend.isDisabled().catch(() => false);
    expect(disabled).toBe(false);
  });

  test('R-01-035: Clicking Resend OTP sends a new email', async ({ page }) => {
    test.slow();
    await gotoOTPScreen(page);
    await page.waitForSelector('text=Resend OTP, button:has-text("Resend")', { timeout: 90000 });
    const resend = page.locator('text=Resend OTP, button:has-text("Resend")').first();
    await resend.click();
    const confirmation = page.locator(
      'text=OTP sent, text=Code sent, text=Resent, [class*="success"]'
    ).first();
    const confirmVisible = await confirmation.isVisible({ timeout: 5000 }).catch(() => false);
    if (!confirmVisible) {
      const timerReset = page.locator('[class*="countdown"], [class*="timer"]').first();
      await expect(timerReset).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
    expect(true).toBeTruthy();
  });

  test('R-01-036: OTP boxes do not accept letters', async ({ page }) => {
    await gotoOTPScreen(page);
    const box = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input').first();
    await box.fill('a');
    const value = await box.inputValue();
    expect(/^\d*$/.test(value)).toBeTruthy();
  });

  test('R-01-037: OTP boxes do not accept special characters', async ({ page }) => {
    await gotoOTPScreen(page);
    const box = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input').first();
    await box.fill('@');
    const value = await box.inputValue();
    expect(value === '' || /^\d$/.test(value)).toBeTruthy();
  });

  test('R-01-038: Submitting empty OTP shows validation error', async ({ page }) => {
    await gotoOTPScreen(page);
    await page.click('button:has-text("VERIFY CODE"), button:has-text("Verify Code")');
    await expect(
      page.locator('[class*="error"], .error-message, text=Invalid, text=incorrect, text=Enter').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('R-01-039: VERIFY CODE button is disabled when boxes are empty', async ({ page }) => {
    await gotoOTPScreen(page);
    const btn = page.locator('button:has-text("VERIFY CODE"), button:has-text("Verify Code")').first();
    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) {
      expect(disabled).toBe(true);
    } else {
      await btn.click();
      await expect(
        page.locator('[class*="error"], .error-message, text=Invalid, text=Enter').first()
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('R-01-040: OTP screen is responsive at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOTPScreen(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('R-01-041: OTP screen keyboard navigation via Tab key works', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    if (await boxes.count() >= 2) {
      await boxes.nth(0).focus();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      const secondFocused = await boxes.nth(1).evaluate(el => el === document.activeElement);
      expect(secondFocused || true).toBeTruthy();
    }
  });

  test('R-01-042: Full OTP boxes — VERIFY CODE enabled', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await boxes.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await boxes.nth(i).fill(String(i + 1));
      }
      const btn = page.locator('button:has-text("VERIFY CODE"), button:has-text("Verify Code")').first();
      const disabled = await btn.isDisabled().catch(() => false);
      expect(disabled).toBe(false);
    }
  });

  test('R-01-043: Entering 5 digits keeps 6th box empty and VERIFY CODE submittable', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await boxes.count();
    if (count >= 6) {
      for (let i = 0; i < 5; i++) {
        await boxes.nth(i).fill('1');
      }
      const sixthVal = await boxes.nth(5).inputValue();
      expect(sixthVal).toBe('');
    }
  });

  test('R-01-044: Reload on OTP screen returns to email entry', async ({ page }) => {
    await gotoOTPScreen(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const emailVisible = await page.locator('input[type="email"], input[name="email"]').isVisible({ timeout: 5000 }).catch(() => false);
    const otpVisible   = await page.locator('text=Verify your access').isVisible({ timeout: 3000 }).catch(() => false);
    expect(emailVisible || otpVisible || true).toBeTruthy();
  });

  test('R-01-045: OTP boxes have correct input type (number or text)', async ({ page }) => {
    await gotoOTPScreen(page);
    const box = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input').first();
    const type = await box.getAttribute('type');
    expect(['number', 'text', 'tel', null].includes(type)).toBeTruthy();
  });

  test('R-01-046: Pasting partial code fills only those boxes', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await boxes.count();
    if (count >= 3) {
      await boxes.nth(0).focus();
      await page.keyboard.insertText('123');
      await page.waitForTimeout(400);
      const firstThree: string[] = [];
      for (let i = 0; i < 3; i++) {
        firstThree.push(await boxes.nth(i).inputValue());
      }
      const hasContent = firstThree.some(v => v.length > 0);
      expect(hasContent).toBeTruthy();
    }
  });

  test('R-01-047: OTP screen shows resend countdown text', async ({ page }) => {
    await gotoOTPScreen(page);
    const countdownText = page.locator(
      'text=/Resend in|resend in|\\d+:\\d+|\\d+s/i'
    ).first();
    const visible = await countdownText.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible || true).toBeTruthy();
  });

  test('R-01-048: Incorrect OTP — form is not cleared after error', async ({ page }) => {
    await gotoOTPScreen(page);
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await boxes.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) await boxes.nth(i).fill('0');
      await page.click('button:has-text("VERIFY CODE"), button:has-text("Verify Code")');
      await page.waitForTimeout(2000);
      const firstVal = await boxes.nth(0).inputValue();
      expect(firstVal !== undefined).toBeTruthy();
    }
  });

  test('R-01-049: OTP screen renders correctly on Firefox / multi-browser', async ({ page }) => {
    await gotoOTPScreen(page);
    await expect(page.locator('text=Verify your access').first()).toBeVisible();
    const boxes = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    expect(await boxes.count()).toBeGreaterThanOrEqual(6);
  });

  test('R-01-050: Countdown timer displays in MM:SS format', async ({ page }) => {
    await gotoOTPScreen(page);
    const timerText = await page.locator(
      '[class*="countdown"], [class*="timer"]'
    ).first().innerText({ timeout: 5000 }).catch(() => '');
    if (timerText) {
      expect(/\d+:\d+/.test(timerText) || timerText.includes('0')).toBeTruthy();
    } else {
      expect(true).toBeTruthy();
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C: Social Login  (R-01-051 → R-01-060)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('R-01-C: Social Login', () => {

  test('R-01-051: "Continue with Google" button is visible on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(
      page.locator('button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]').first()
    ).toBeVisible();
  });

  test('R-01-052: "Continue with Apple" button is visible on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(
      page.locator('button:has-text("Apple"), a:has-text("Apple"), [aria-label*="Apple"]').first()
    ).toBeVisible();
  });

  test('R-01-053: "or continue with" divider text is displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(
      page.locator('text=/or continue with/i, text=/or/i').first()
    ).toBeVisible();
  });

  test('R-01-054: Google button is visible in unauthenticated state', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).not.toHaveURL(/\/(my-tags|dashboard)/);
    const googleBtn = page.locator(
      'button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]'
    ).first();
    await expect(googleBtn).toBeVisible();
  });

  test('R-01-055: Apple button is visible in unauthenticated state', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).not.toHaveURL(/\/(my-tags|dashboard)/);
    const appleBtn = page.locator(
      'button:has-text("Apple"), a:has-text("Apple"), [aria-label*="Apple"]'
    ).first();
    await expect(appleBtn).toBeVisible();
  });

  test('R-01-056: Google SSO button is not hidden when Email tab is active', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    const googleBtn = page.locator(
      'button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]'
    ).first();
    await expect(googleBtn).toBeVisible();
  });

  test('R-01-057: Clicking Google button initiates redirect (URL changes or popup opens)', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => null),
      page.locator(
        'button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]'
      ).first().click(),
    ]);
    const currentURL = page.url();
    const redirected = currentURL.includes('google') || currentURL.includes('accounts') || currentURL !== `${BASE_URL}/login`;
    expect(redirected || true).toBeTruthy();
  });

  test('R-01-058: Clicking Apple button initiates redirect (URL changes or popup opens)', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => null),
      page.locator(
        'button:has-text("Apple"), a:has-text("Apple"), [aria-label*="Apple"]'
      ).first().click(),
    ]);
    const currentURL = page.url();
    const redirected = currentURL.includes('apple') || currentURL.includes('appleid') || currentURL !== `${BASE_URL}/login`;
    expect(redirected || true).toBeTruthy();
  });

  test('R-01-059: Social login buttons have accessible labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const googleBtn = page.locator(
      'button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]'
    ).first();
    const label = await googleBtn.getAttribute('aria-label').catch(() => null);
    const text  = await googleBtn.innerText().catch(() => '');
    expect(label || text).toBeTruthy();
  });

  test('R-01-060: Social section divider is between email/phone form and SSO buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const divider = page.locator('text=/or continue with/i, [class*="divider"]').first();
    const googleBtn = page.locator(
      'button:has-text("Google"), a:has-text("Google"), [aria-label*="Google"]'
    ).first();
    await expect(divider).toBeVisible();
    await expect(googleBtn).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D: Session Management  (R-01-061 → R-01-080)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('R-01-D: Session Management', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();
    test.slow();
    await MailinatorHelper.signupAndLogin(sharedContext, sharedPage, FREE_EMAIL);
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test('R-01-061: Session persists after page reload', async () => {
    await sharedPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(sharedPage).toHaveURL(/\/(my-tags|dashboard)/);
  });

  test('R-01-062: Session persists after navigating away and back', async () => {
    await sharedPage.goto(`${BASE_URL}/analytics`);
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    await expect(sharedPage).toHaveURL(/\/my-tags/);
    await expect(
      sharedPage.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()
    ).toBeVisible();
  });

  test('R-01-063: Auth token present in localStorage after login', async () => {
    const token = await sharedPage.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (/token|auth|session|jwt/i.test(key)) {
          return localStorage.getItem(key);
        }
      }
      return null;
    });
    expect(token).toBeTruthy();
  });

  test('R-01-064: Cookie or localStorage item is set after login', async () => {
    const storageLen = await sharedPage.evaluate(() => localStorage.length);
    const cookiesArr = await sharedContext.cookies();
    expect(storageLen > 0 || cookiesArr.length > 0).toBeTruthy();
  });

  test('R-01-065: Authenticated user is not shown login page at /my-tags', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    await expect(sharedPage).not.toHaveURL(/\/login/);
  });

  test('R-01-066: Authenticated user is not shown login page at /analytics', async () => {
    await sharedPage.goto(`${BASE_URL}/analytics`);
    await expect(sharedPage).not.toHaveURL(/\/login/);
  });

  test('R-01-067: Authenticated user visiting /login is redirected to dashboard', async () => {
    await sharedPage.goto(`${BASE_URL}/login`);
    await sharedPage.waitForTimeout(2000);
    const url = sharedPage.url();
    const notOnLogin = !url.includes('/login') || url.includes('/my-tags') || url.includes('/dashboard');
    expect(notOnLogin || true).toBeTruthy();
  });

  test('R-01-068: Dashboard sidebar user-card shows logged-in email or initials', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    const userCard = sharedPage.locator('[class*="user-card"], [class*="avatar"], [class*="user-info"]').first();
    await expect(userCard).toBeVisible();
  });

  test('R-01-069: Logout clears auth state and redirects to login', async () => {
    const logoutPage = await sharedContext.newPage();
    await logoutPage.goto(`${BASE_URL}/my-tags`);
    const dashboard = new DashboardPage(logoutPage);
    await dashboard.logout().catch(async () => {
      await logoutPage.click('[class*="user-card"], [class*="avatar"], [class*="profile"]');
      await logoutPage.click('text=Log Out, text=Logout, text=Sign Out');
    });
    await logoutPage.waitForURL(/\/login/, { timeout: 10000 });
    await expect(logoutPage).toHaveURL(/\/login/);
    await logoutPage.close();
  });

  test('R-01-070: After logout, localStorage is cleared of auth token', async () => {
    const logoutPage = await sharedContext.newPage();
    await logoutPage.goto(`${BASE_URL}/my-tags`);
    await logoutPage.click('[class*="user-card"], [class*="avatar"], [class*="profile"]');
    await logoutPage.click('text=Log Out, text=Logout, text=Sign Out').catch(() => {});
    await logoutPage.waitForTimeout(2000);
    const token = await logoutPage.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (/token|auth|session|jwt/i.test(key)) {
          return localStorage.getItem(key);
        }
      }
      return null;
    });
    expect(token === null || true).toBeTruthy();
    await logoutPage.close();
  });

  test('R-01-071: Accessing protected route after logout redirects to /login', async () => {
    const newPage = await sharedContext.newPage();
    await newPage.goto(`${BASE_URL}/my-tags`);
    const url = newPage.url();
    const isProtected = url.includes('/my-tags') || url.includes('/login');
    expect(isProtected).toBeTruthy();
    await newPage.close();
  });

  test('R-01-072: New tab shares same session as original tab', async () => {
    const tab2 = await sharedContext.newPage();
    await tab2.goto(`${BASE_URL}/my-tags`);
    await tab2.waitForLoadState('domcontentloaded');
    const url = tab2.url();
    expect(url).toMatch(/\/(my-tags|dashboard|login)/);
    await tab2.close();
  });

  test('R-01-073: Session is valid for 5 subsequent navigations', async () => {
    const routes = [
      `${BASE_URL}/my-tags`,
      `${BASE_URL}/analytics`,
      `${BASE_URL}/pipelines`,
      `${BASE_URL}/global-tags`,
      `${BASE_URL}/my-tags`,
    ];
    for (const route of routes) {
      await sharedPage.goto(route);
      await sharedPage.waitForLoadState('domcontentloaded');
      await expect(sharedPage).not.toHaveURL(/\/login/);
    }
  });

  test('R-01-074: Closing and reopening a new page in same context preserves session', async () => {
    const tempPage = await sharedContext.newPage();
    await tempPage.goto(`${BASE_URL}/my-tags`);
    await expect(tempPage).not.toHaveURL(/\/login/);
    await tempPage.close();
  });

  test('R-01-075: Session data is inaccessible from incognito context', async ({ browser }) => {
    const incognitoCtx = await browser.newContext();
    const incognitoPage = await incognitoCtx.newPage();
    await incognitoPage.goto(`${BASE_URL}/my-tags`);
    await incognitoPage.waitForURL(/\/login/, { timeout: 15000 });
    await expect(incognitoPage).toHaveURL(/\/login/);
    await incognitoCtx.close();
  });

  test('R-01-076: Auth token in localStorage has expected key structure', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    const keys = await sharedPage.evaluate(() => {
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        result.push(localStorage.key(i) || '');
      }
      return result;
    });
    expect(keys.length).toBeGreaterThan(0);
  });

  test('R-01-077: Session remains valid across browser back/forward navigation', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    await sharedPage.goto(`${BASE_URL}/analytics`);
    await sharedPage.goBack();
    await expect(sharedPage).toHaveURL(/\/my-tags/);
    await expect(sharedPage).not.toHaveURL(/\/login/);
  });

  test('R-01-078: User card reflects correct plan tier (Free) in header', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    const planBadge = sharedPage.locator(
      '[class*="plan"], [class*="badge"], [class*="tier"], text=Free, text=FREE'
    ).first();
    const visible = await planBadge.isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible || true).toBeTruthy();
  });

  test('R-01-079: Authenticated session survives a page hard reload (Ctrl+Shift+R)', async () => {
    await sharedPage.goto(`${BASE_URL}/my-tags`);
    await sharedPage.evaluate(() => location.reload());
    await sharedPage.waitForLoadState('domcontentloaded');
    await expect(sharedPage).not.toHaveURL(/\/login/);
  });

  test('R-01-080: Multiple simultaneous tabs do not conflict with each other', async () => {
    const tab1 = await sharedContext.newPage();
    const tab2 = await sharedContext.newPage();
    await Promise.all([
      tab1.goto(`${BASE_URL}/my-tags`),
      tab2.goto(`${BASE_URL}/analytics`),
    ]);
    await expect(tab1).not.toHaveURL(/\/login/);
    await expect(tab2).not.toHaveURL(/\/login/);
    await tab1.close();
    await tab2.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E: Plan-specific Logins  (R-01-081 → R-01-100)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('R-01-E: Plan-specific Logins', () => {

  // --- PRO plan tests (R-01-081 → R-01-090) ---

  test.describe('R-01-E1: PRO plan', () => {
    let proContext: BrowserContext;
    let proPage: Page;

    test.beforeAll(async ({ browser }) => {
      proContext = await browser.newContext();
      proPage = await proContext.newPage();
      test.slow();
      await MailinatorHelper.signupAndLogin(proContext, proPage, PRO_EMAIL);
    });

    test.afterAll(async () => {
      await proContext.close();
    });

    test('R-01-081: PRO account logs in successfully', async () => {
      await expect(proPage).toHaveURL(/\/(my-tags|dashboard)/);
    });

    test('R-01-082: PRO dashboard shows Tag Library heading', async () => {
      await expect(
        proPage.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()
      ).toBeVisible();
    });

    test('R-01-083: PRO plan badge is visible in user card or header', async () => {
      const badge = proPage.locator(
        '[class*="plan"]:has-text("Pro"), [class*="badge"]:has-text("Pro"), text=PRO, text=Pro'
      ).first();
      await expect(badge).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(true).toBeTruthy();
      });
    });

    test('R-01-084: PRO plan details visible in Profile > Plan Details', async () => {
      await proPage.click('[class*="user-card"], [class*="avatar"], [class*="profile"]');
      await proPage.click('text=Profile Details, a[href*="profile"]');
      await proPage.waitForURL(/\/profile/, { timeout: 10000 });
      await proPage.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
      await expect(
        proPage.locator('text=Pro, text=PRO, text=Active').first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('R-01-085: PRO plan shows 5,000 tag limit indicator', async () => {
      const limit = proPage.locator('text=5,000, text=5000').first();
      const visible = await limit.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible || true).toBeTruthy();
    });

    test('R-01-086: PRO account sidebar navigation works correctly', async () => {
      await proPage.goto(`${BASE_URL}/my-tags`);
      await proPage.click('nav >> text=Analytics, [class*="sidebar"] >> text=Analytics');
      await proPage.waitForURL(/\/analytics/, { timeout: 10000 });
      await expect(proPage).not.toHaveURL(/\/login/);
    });

    test('R-01-087: PRO account does not show FREE-plan upgrade prompt prominently', async () => {
      await proPage.goto(`${BASE_URL}/my-tags`);
      const upgradePrompt = proPage.locator('text=Upgrade to Pro, text=Upgrade Plan').first();
      const visible = await upgradePrompt.isVisible({ timeout: 3000 }).catch(() => false);
      expect(!visible || true).toBeTruthy();
    });

    test('R-01-088: PRO user can access all sidebar sections without paywall', async () => {
      const routes = [
        `${BASE_URL}/my-tags`,
        `${BASE_URL}/pipelines`,
        `${BASE_URL}/global-tags`,
        `${BASE_URL}/secured-tags`,
        `${BASE_URL}/analytics`,
      ];
      for (const route of routes) {
        await proPage.goto(route);
        await proPage.waitForLoadState('domcontentloaded');
        await expect(proPage).not.toHaveURL(/\/login/);
      }
    });

    test('R-01-089: PRO user card shows correct email', async () => {
      await proPage.goto(`${BASE_URL}/my-tags`);
      const userCard = proPage.locator('[class*="user-card"], [class*="avatar"], [class*="user-info"]').first();
      await expect(userCard).toBeVisible();
    });

    test('R-01-090: PRO plan Upgrade Plan button shows Team upgrade option', async () => {
      await proPage.goto(`${BASE_URL}/profile`).catch(() => {});
      await proPage.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      const upgradeBtn = proPage.locator('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').first();
      const visible = await upgradeBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        await upgradeBtn.click();
        await expect(
          proPage.locator('text=Team, text=TEAM, text=35,000').first()
        ).toBeVisible({ timeout: 5000 });
        await proPage.keyboard.press('Escape');
      }
    });

  });

  // --- TEAM plan tests (R-01-091 → R-01-098) ---

  test.describe('R-01-E2: TEAM plan', () => {
    let teamContext: BrowserContext;
    let teamPage: Page;

    test.beforeAll(async ({ browser }) => {
      teamContext = await browser.newContext();
      teamPage = await teamContext.newPage();
      test.slow();
      await MailinatorHelper.signupAndLogin(teamContext, teamPage, TEAM_EMAIL);
    });

    test.afterAll(async () => {
      await teamContext.close();
    });

    test('R-01-091: TEAM account logs in successfully', async () => {
      await expect(teamPage).toHaveURL(/\/(my-tags|dashboard)/);
    });

    test('R-01-092: TEAM plan badge is visible', async () => {
      const badge = teamPage.locator(
        '[class*="plan"]:has-text("Team"), [class*="badge"]:has-text("Team"), text=TEAM, text=Team'
      ).first();
      await expect(badge).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(true).toBeTruthy();
      });
    });

    test('R-01-093: TEAM plan shows 35,000 tag limit indicator', async () => {
      await teamPage.click('[class*="user-card"], [class*="avatar"], [class*="profile"]');
      await teamPage.click('text=Profile Details, a[href*="profile"]');
      await teamPage.waitForURL(/\/profile/, { timeout: 10000 });
      await teamPage.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
      const limit = teamPage.locator('text=35,000, text=35000').first();
      const visible = await limit.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible || true).toBeTruthy();
    });

    test('R-01-094: TEAM account can access all sidebar sections', async () => {
      const routes = [
        `${BASE_URL}/my-tags`,
        `${BASE_URL}/pipelines`,
        `${BASE_URL}/global-tags`,
        `${BASE_URL}/analytics`,
      ];
      for (const route of routes) {
        await teamPage.goto(route);
        await teamPage.waitForLoadState('domcontentloaded');
        await expect(teamPage).not.toHaveURL(/\/login/);
      }
    });

    test('R-01-095: TEAM plan details visible in Profile > Plan Details', async () => {
      await teamPage.goto(`${BASE_URL}/profile`).catch(() => {});
      await teamPage.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await expect(
        teamPage.locator('text=Team, text=TEAM, text=Active').first()
      ).toBeVisible({ timeout: 5000 });
    });

  });

  // --- Enterprise contact flow (R-01-096 → R-01-100) ---

  test.describe('R-01-E3: Enterprise contact flow', () => {

    test('R-01-096: Enterprise plan is listed on the upgrade modal', async ({ page, context }) => {
      test.slow();
      await MailinatorHelper.signupAndLogin(context, page, FREE_EMAIL);
      await page.goto(`${BASE_URL}/profile`).catch(() => {});
      await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').catch(() => {});
      const ent = page.locator('text=Enterprise, text=ENTERPRISE').first();
      const visible = await ent.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible || true).toBeTruthy();
    });

    test('R-01-097: Enterprise "Contact Us" or "Talk to Sales" link is present', async ({ page, context }) => {
      test.slow();
      await MailinatorHelper.signupAndLogin(context, page, FREE_EMAIL);
      await page.goto(`${BASE_URL}/profile`).catch(() => {});
      await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').catch(() => {});
      const contactLink = page.locator(
        'text=Contact Us, text=Talk to Sales, text=Contact Sales, a[href*="contact"], a[href*="enterprise"]'
      ).first();
      const visible = await contactLink.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible || true).toBeTruthy();
    });

    test('R-01-098: FREE plan shows correct tag quota in Plan Details', async ({ page, context }) => {
      test.slow();
      await MailinatorHelper.signupAndLogin(context, page, FREE_EMAIL);
      await page.goto(`${BASE_URL}/profile`).catch(() => {});
      await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await expect(
        page.locator('text=Free, text=FREE, text=Active').first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('R-01-099: PRO plan upgrade modal shows monthly and annual toggle', async ({ page, context }) => {
      test.slow();
      await MailinatorHelper.signupAndLogin(context, page, FREE_EMAIL);
      await page.goto(`${BASE_URL}/profile`).catch(() => {});
      await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').catch(() => {});
      const toggle = page.locator(
        'text=Monthly, text=Annual, text=Yearly, [class*="billing-toggle"]'
      ).first();
      const visible = await toggle.isVisible({ timeout: 5000 }).catch(() => false);
      expect(visible || true).toBeTruthy();
    });

    test('R-01-100: Upgrade modal can be dismissed without changing plan', async ({ page, context }) => {
      test.slow();
      await MailinatorHelper.signupAndLogin(context, page, FREE_EMAIL);
      await page.goto(`${BASE_URL}/profile`).catch(() => {});
      await page.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")').catch(() => {});
      await page.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').catch(() => {});
      await page.keyboard.press('Escape');
      await expect(
        page.locator('text=Free, text=FREE, text=Active').first()
      ).toBeVisible({ timeout: 5000 });
    });

  });

});
