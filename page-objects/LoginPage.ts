import { Page, BrowserContext, expect } from '@playwright/test';
import { MailinatorHelper } from './MailinatorHelper';

export class LoginPage {
  constructor(private page: Page) {}

  async gotoLogin(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/login`);
  }

  async selectPhoneTab(): Promise<void> {
    await this.page.click('[data-tab="phone"], button:has-text("Phone"), text=Phone');
  }

  async selectEmailTab(): Promise<void> {
    await this.page.click('[data-tab="email"], button:has-text("Email"), text=Email');
  }

  async enterPhone(countryCode: string, number: string): Promise<void> {
    await this.page.click('.country-selector, [class*="country"], .phone-flag');
    await this.page.fill('input[placeholder*="Search"], input[placeholder*="country"]', countryCode);
    await this.page.click(`text=${countryCode}`, { timeout: 5000 });
    await this.page.fill('input[type="tel"], input[placeholder*="phone"], input[name="phone"]', number);
  }

  async enterEmail(email: string): Promise<void> {
    await this.page.fill('input[type="email"], input[name="email"], input[placeholder*="email"]', email);
  }

  async clickContinue(): Promise<void> {
    await this.page.click('button:has-text("CONTINUE"), button:has-text("Continue")');
  }

  async enterOTP(code: string): Promise<void> {
    await MailinatorHelper.fillOTPBoxes(this.page, code);
  }

  async clickVerifyCode(): Promise<void> {
    await this.page.click('button:has-text("VERIFY CODE"), button:has-text("Verify Code")');
  }

  async waitForDashboard(): Promise<void> {
    await this.page.waitForURL(/\/(my-tags|dashboard)/, { timeout: 20000 });
  }

  async signupWithMailinator(context: BrowserContext, email?: string): Promise<string> {
    const testEmail = email || MailinatorHelper.generateEmail();
    await this.gotoLogin();
    await this.selectEmailTab();
    await this.enterEmail(testEmail);
    await this.clickContinue();
    await this.page.waitForSelector('text=Verify your access', { timeout: 15000 });
    const otp = await MailinatorHelper.getOTPFromBrowser(context, testEmail);
    await this.enterOTP(otp);
    await this.clickVerifyCode();
    await this.waitForDashboard();
    return testEmail;
  }

  async assertLoginPageLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Sign in to Synctag/i })).toBeVisible();
  }
}
