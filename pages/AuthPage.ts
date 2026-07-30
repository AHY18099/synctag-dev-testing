import { Page, Locator, BrowserContext } from '@playwright/test';

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
    // .fill('') first: a prior wrong attempt leaves the field populated, and
    // this single maxlength=6 input doesn't auto-clear on refocus - typing
    // into it a second time without clearing would overflow past the limit.
    await this.otpInput.click();
    await this.otpInput.fill('');
    await this.page.keyboard.type(code);
  }

  async submitOtp() {
    await this.verifyButton.click();
  }

  /**
   * A brand-new email/phone that has never signed up before lands on a
   * "Complete your workspace" registration form immediately after OTP
   * verification succeeds (still under the /auth path) - the app only
   * reaches the dashboard once this is filled in. Existing accounts skip
   * straight past this. Call after submitOtp(); no-ops if the form never
   * appears within `timeout`.
   */
  async completeRegistrationIfShown(timeout = 15_000): Promise<boolean> {
    // NOTE: Locator.isVisible({ timeout }) does NOT poll/retry the way
    // expect(locator).toBeVisible() does - it's a single immediate check
    // that merely respects actionability timeouts for the query itself,
    // so it can return false if called the instant after submitOtp() while
    // the client is still transitioning off the OTP screen. waitFor()
    // actually polls until the deadline, which is what's needed here.
    const heading = this.page.getByRole('heading', { name: 'Complete your workspace' });
    const shown = await heading
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
    if (!shown) return false;

    await this.page.getByPlaceholder('Enter your first name').fill('QA');
    await this.page.getByPlaceholder('Enter your last name').fill('Automation');
    // Phone Number is also required on this form, even for an email signup.
    // Must be unique per registration - a hardcoded number here causes a
    // real 409 from POST /api/auth/register once it's been used before,
    // even for a brand-new email (confirmed live).
    const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);
    await this.page.getByPlaceholder('Enter the phone number').fill(phone);
    const terms = this.page.locator('input[type="checkbox"]').first();
    if (!(await terms.isChecked().catch(() => false))) {
      await terms.check({ force: true });
    }
    await this.page.getByRole('button', { name: 'Complete Registration' }).click();
    return true;
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
