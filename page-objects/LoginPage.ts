import { Page, BrowserContext, expect } from '@playwright/test';
import { MailinatorHelper } from './MailinatorHelper';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async gotoLogin(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  }

  async selectPhoneTab(): Promise<void> {
    await this.page.click('button:has-text("Phone")');
  }

  async selectEmailTab(): Promise<void> {
    await this.page.click('button:has-text("Email")');
  }

  async enterPhone(countryCode: string, number: string): Promise<void> {
    await this.page.click('.country-selector, [class*="country"], .phone-flag');
    await this.page.fill('input[placeholder*="Search"], input[placeholder*="country"]', countryCode);
    await this.page.click(`text=${countryCode}`, { timeout: 5000 });
    await this.page.fill('input[type="tel"], input[placeholder*="phone"], input[name="phone"]', number);
  }

  async enterEmail(email: string): Promise<void> {
    await this.page.fill('input[type="email"]', email);
  }

  async clickContinue(): Promise<void> {
    await this.page.click(
      'button:has-text("SEND VERIFICATION CODE"), button:has-text("CONTINUE"), button:has-text("Continue")'
    );
  }

  async enterOTP(code: string): Promise<void> {
    await MailinatorHelper.fillOTPBoxes(this.page, code);
  }

  async clickVerifyCode(): Promise<void> {
    await this.page.click('button:has-text("VERIFY CODE")');
  }

  /**
   * Waits for post-login navigation. First-time users land on a workspace
   * registration page before being redirected to the dashboard.
   */
  async waitForDashboard(): Promise<void> {
    // Wait for any navigation away from login / OTP screens
    await this.page.waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      { timeout: 30000 }
    );

    // If the app redirected to workspace/registration setup, complete it
    const onSetup = await this.page.locator(
      'button:has-text("COMPLETE REGISTRATION"), text=Complete your workspace'
    ).first().isVisible({ timeout: 4000 }).catch(() => false);

    if (onSetup) {
      await this.completeWorkspaceSetup();
    }

    // Final guard — ensure we are on the dashboard
    await this.page.waitForURL(/\/(my-tags|dashboard)/, { timeout: 30000 });
  }

  /**
   * Fills and submits the first-time workspace registration form.
   * Appears after a brand-new email completes OTP verification.
   */
  private async completeWorkspaceSetup(): Promise<void> {
    // First Name
    const fn = this.page.locator('input[name="firstName"], input[placeholder*="First Name"]').first();
    if (await fn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fn.fill('QA');
    }

    // Last Name
    const ln = this.page.locator('input[name="lastName"], input[placeholder*="Last Name"]').first();
    if (await ln.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ln.fill('Tester');
    }

    // Terms & Conditions checkbox
    const terms = this.page.locator('input[type="checkbox"]').first();
    if (await terms.isVisible({ timeout: 2000 }).catch(() => false)) {
      const checked = await terms.isChecked().catch(() => false);
      if (!checked) await terms.check();
    }

    // Submit
    await this.page.click('button:has-text("COMPLETE REGISTRATION")');
    await this.page.waitForURL(/\/(my-tags|dashboard)/, { timeout: 30000 });
  }

  async signupWithMailinator(context: BrowserContext, email?: string): Promise<string> {
    const testEmail = email || MailinatorHelper.generateEmail();
    await this.gotoLogin();
    await this.selectEmailTab();
    await this.enterEmail(testEmail);
    await this.clickContinue();
    await this.page.waitForSelector('text=Verify your access', { timeout: 20000 });
    const otp = await MailinatorHelper.getOTPFromBrowser(context, testEmail);
    await this.enterOTP(otp);
    await this.clickVerifyCode();
    await this.waitForDashboard();
    return testEmail;
  }

  async assertLoginPageLoaded(): Promise<void> {
    await expect(this.page.locator('text=Sign in to Synctag').first()).toBeVisible();
  }
}
