import { Page, Locator, expect } from '@playwright/test';

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
    await this.page.goto('/auth');
  }

  async gotoSignup() {
    await this.page.goto('/auth?tab=signup');
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
   * Mocks the OTP-verification network call so positive login/signup can be
   * asserted end-to-end without a real inbox/SMS. MUST be called BEFORE
   * submitOtp(). The dev team should confirm/adjust the URL glob to match
   * the real verify-otp endpoint (see README.md - "OTP mocking strategy").
   */
  async mockOtpVerifySuccess(urlPattern: string | RegExp = '**/*verify*otp*') {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, token: 'mocked-jwt-for-qa', user: { id: 'qa-mock-user' } }),
      });
    });
  }

  async mockOtpVerifyFailure(urlPattern: string | RegExp = '**/*verify*otp*') {
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid verification code.' }),
      });
    });
  }
}
