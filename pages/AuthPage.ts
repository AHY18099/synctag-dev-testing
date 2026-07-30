import { Page, Locator, BrowserContext, expect } from '@playwright/test';

/**
 * Page object for /auth (unified passwordless login + signup screen).
 *
 * The app uses a single OTP-based flow for both "Sign in to Synctag" and
 * "Create your Synctag account" (selected via ?tab=signup), with three
 * entry methods: Phone + OTP, Email + OTP, and Google OAuth.
 */
export class AuthPage {
  readonly page: Page;
  readonly phoneTab: Locator;
  readonly emailTab: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;
  readonly continueButton: Locator; // phone flow
  readonly sendCodeButton: Locator; // email flow
  readonly googleButton: Locator;
  readonly backButton: Locator;
  readonly otpInput: Locator; // combined 6-digit code input
  readonly verifyButton: Locator;
  readonly resendOtpLink: Locator;
  readonly inlineErrorBanner: Locator;
  readonly fieldValidationMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.phoneTab = page.getByRole('button', { name: 'Phone' });
    this.emailTab = page.getByRole('button', { name: 'Email' });
    this.phoneInput = page.getByPlaceholder('Enter the phone number');
    this.emailInput = page.getByPlaceholder('Enter email address');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.sendCodeButton = page.getByRole('button', { name: 'Send Verification Code' });
    this.googleButton = page.getByRole('button', { name: 'Continue with Google' });
    this.backButton = page.locator('button:has(svg)').first();
    this.otpInput = page.getByRole('textbox', { name: 'Verification Code' });
    this.verifyButton = page.getByRole('button', { name: 'Verify Code' });
    this.resendOtpLink = page.getByText(/Resend OTP/);
    this.inlineErrorBanner = page.locator('text=/Invalid verification code|Maximum verification attempts exceeded/');
    this.fieldValidationMessage = page.locator('text=/Phone number must be exactly 10 digits|Please enter the 6-digit verification code/');
  }

  async gotoLogin() {
    // waitUntil: 'domcontentloaded' - this site's third-party trackers
    // (ads/analytics pixels) can keep the network idle/load event from
    // firing for a long time; the app itself is interactive well before that.
    await this.page.goto('/auth', { waitUntil: 'domcontentloaded' });
  }

  async gotoSignup() {
    await this.page.goto('/auth?tab=signup', { waitUntil: 'domcontentloaded' });
  }

  async requestEmailOtp(email: string) {
    await this.emailTab.click();
    await this.emailInput.fill(email);
    await this.sendCodeButton.click();
  }

  async requestPhoneOtp(phone: string) {
    await this.phoneTab.click();
    await this.phoneInput.fill(phone);
    await this.continueButton.click();
  }

  async enterOtp(code: string) {
    await this.otpInput.click();
    await this.page.keyboard.type(code);
  }

  async submitOtp() {
    await this.verifyButton.click();
  }

  /** Reads the header text ("Sign in to Synctag" / "Create your Synctag account"). */
  async heading(): Promise<string> {
    return (await this.page.locator('h1, h2').filter({ hasText: /Sign in|Create your/ }).first().textContent()) ?? '';
  }

  /**
   * Retrieves the real 6-digit OTP for `email` from its public Mailinator
   * inbox (requestEmailOtp must already have been called for this address).
   * Polls the inbox for up to ~60s since delivery isn't instant. Opens a
   * scratch tab on `context` and closes it before returning.
   */
  async getRealOtpFromMailinator(context: BrowserContext, email: string): Promise<string> {
    const inboxName = email.split('@')[0];
    const inbox = await context.newPage();
    let otp = '';
    try {
      for (let attempt = 0; attempt < 30 && !otp; attempt++) {
        await inbox.goto(`https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await inbox.waitForTimeout(2000);
        const row = inbox.locator('tr.ng-scope, [class*="inbox-row"], table tbody tr').first();
        if (!(await row.isVisible({ timeout: 1500 }).catch(() => false))) continue;
        await row.click();
        await inbox.waitForTimeout(1500);
        const bodyText = await (async () => {
          try {
            return await inbox.frameLocator('#html_msg_body, iframe').locator('body').innerText({ timeout: 5000 });
          } catch {
            return inbox.locator('body').innerText();
          }
        })();
        const match = /\b(\d{6})\b/.exec(bodyText);
        if (match) otp = match[1];
      }
    } finally {
      await inbox.close();
    }
    if (!otp) throw new Error(`Real OTP not found in Mailinator inbox for ${email} after 60s`);
    return otp;
  }
}
