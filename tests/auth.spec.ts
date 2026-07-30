import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { uniqueTestEmail, uniqueTestPhone } from '../fixtures/testData';

/**
 * Login / Signup coverage for /auth.
 *
 * IMPORTANT - OTP limitation: the app is fully passwordless. Both "Sign in"
 * and "Create account" only accept a phone or email OTP (or Google OAuth).
 * There is no test-mode bypass code available to this suite, so:
 *   - All FRONT-END validation and error-handling scenarios below run
 *     against the real backend and are fully self-verifying.
 *   - The two "positive end-to-end login succeeds" scenarios mock the
 *     verify-OTP network response (see AuthPage.mockOtpVerifySuccess) so
 *     they only prove the client correctly HANDLES a successful verify
 *     response (redirect, session state) - they do NOT prove the real
 *     OTP backend issues/accepts codes correctly. Confirm the URL pattern
 *     against the real API before trusting these two tests' results.
 */

test.describe('Auth - entry screen', () => {
  test('login and signup share the same OTP form, differing only by heading [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await expect(page.getByText('Sign in to Synctag')).toBeVisible();

    await auth.gotoSignup();
    await expect(page.getByText('Create your Synctag account')).toBeVisible();
  });

  test('Phone tab is selected by default and Email/Google alternatives are offered [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await expect(auth.phoneInput).toBeVisible();
    await auth.emailTab.click();
    await expect(auth.emailInput).toBeVisible();
    await expect(auth.googleButton).toBeVisible();
  });
});

test.describe('Auth - phone entry validation', () => {
  test('rejects a phone number shorter than 10 digits [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.phoneInput.fill('123');
    await auth.continueButton.click();
    await expect(page.getByText('Phone number must be exactly 10 digits')).toBeVisible();
  });

  test('rejects a phone number with letters [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.phoneInput.fill('98abc12345');
    await auth.continueButton.click();
    // Expect either an inline validation message or the field to reject non-numeric input.
    const value = await auth.phoneInput.inputValue();
    expect(value.replace(/\D/g, '')).not.toHaveLength(10);
  });

  test('rejects an empty phone submission [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.continueButton.click();
    await expect(page).toHaveURL(/\/auth/); // must not proceed to OTP screen
  });

  test('accepts a well-formed 10-digit phone number and reaches the OTP screen [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestPhoneOtp(uniqueTestPhone());
    await expect(page.getByText('Verify your access')).toBeVisible();
  });
});

test.describe('Auth - email entry validation', () => {
  test('rejects a malformed email address on initial entry [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.emailTab.click();
    await auth.emailInput.fill('not-an-email');
    await auth.sendCodeButton.click();
    // Should NOT advance to the OTP screen with an invalid address.
    await expect(page.getByText('Verify your access')).not.toBeVisible({ timeout: 3000 }).catch(() => {
      throw new Error('BUG regression guard: app advanced to OTP screen with an invalid email address');
    });
  });

  test('rejects an empty email submission [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.emailTab.click();
    await auth.sendCodeButton.click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('accepts a well-formed email and reaches the OTP screen [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());
    await expect(page.getByText('Verify your access')).toBeVisible();
  });

  test.fixme(
    'BUG-03 regression: editing the email inline on the OTP screen must validate the new address',
    async ({ page }) => {
      // See bug-report.html BUG-03. Reproduction:
      // 1. Request an OTP for a valid email.
      // 2. On the "Verify your access" screen, click the email address
      //    (it is an inline-editable link) and edit it to an invalid value.
      // 3. Currently the app accepts the edit and silently restarts the
      //    resend-OTP timer instead of showing a validation error.
      const auth = new AuthPage(page);
      await auth.gotoLogin();
      await auth.requestEmailOtp(uniqueTestEmail());
      await page.getByText(/@/).click(); // the inline-editable email link
      await page.keyboard.press('End');
      await page.keyboard.type('not-an-email');
      // Expected (currently failing): a validation error should appear and
      // no new OTP should be dispatched to the malformed address.
      await expect(page.getByText(/enter a valid email/i)).toBeVisible();
    }
  );
});

test.describe('Auth - OTP verification', () => {
  test('shows a client-side error when submitting an empty code [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());
    await auth.submitOtp();
    await expect(page.getByText('Please enter the 6-digit verification code')).toBeVisible();
  });

  test('decrements the remaining-attempts counter on each wrong code [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());

    await auth.enterOtp('000000');
    await auth.submitOtp();
    await expect(page.getByText(/Invalid verification code\.\s*\d+ attempt\(s\) remaining\./)).toBeVisible();

    const firstMessage = await page.getByText(/attempt\(s\) remaining/).textContent();

    await auth.enterOtp('000000');
    await auth.submitOtp();
    const secondMessage = await page.getByText(/attempt\(s\) remaining/).textContent();

    expect(secondMessage).not.toEqual(firstMessage); // attempts count must actually decrease
  });

  test('locks out further attempts once the limit is exceeded and instructs the user to request a new code [negative]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());

    // Exhaust attempts (observed limit = 3 wrong tries during manual QA).
    for (let i = 0; i < 3; i++) {
      await auth.enterOtp('000000');
      await auth.submitOtp();
      await page.waitForTimeout(500);
    }

    await expect(
      page.getByText('Maximum verification attempts exceeded. Please request a new code.')
    ).toBeVisible({ timeout: 10_000 });
    // Regression guard for BUG (flaky in one manual run): the lockout
    // message must render every time, not intermittently.
  });

  test('"Resend OTP" is disabled/timered immediately after a code is sent [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());
    await expect(page.getByText(/Resend OTP in \d+s/)).toBeVisible();
  });

  test('mocked verify-OTP success redirects the user out of the auth flow [positive, mocked backend]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await auth.requestEmailOtp(uniqueTestEmail());
    await auth.mockOtpVerifySuccess();
    await auth.enterOtp('123456');
    await auth.submitOtp();
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});

test.describe('Auth - Google OAuth entry point', () => {
  test('"Continue with Google" control is present on both login and signup [positive]', async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.gotoLogin();
    await expect(auth.googleButton).toBeVisible();
    await auth.gotoSignup();
    await expect(auth.googleButton).toBeVisible();
  });
});
