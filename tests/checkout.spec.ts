import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { RAZORPAY_TEST_CARDS, INVALID_CARDS, uniqueTestEmail } from '../fixtures/testData';

/**
 * Checkout / payment coverage for the authenticated plan-upgrade flow,
 * which opens an embedded Razorpay Checkout (confirmed TEST MODE via the
 * red "Test Mode" ribbon during manual exploration - see README.md).
 *
 * All tests in this file require an authenticated session. Because OTP
 * verification cannot be completed against the real backend from this
 * suite (see auth.spec.ts), each test logs in via the mocked verify-OTP
 * response. If your environment instead has a fixture account +
 * storageState available, prefer that (faster, and exercises the real
 * session) - see README.md "Recommended: storageState login".
 *
 * SAFETY: assertTestModeBannerVisible() is called before any card is
 * submitted. Do not remove this guard - it is what makes it safe to run
 * real-looking card numbers against this suite at all.
 */

test.beforeEach(async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.gotoLogin();
  await auth.requestEmailOtp(uniqueTestEmail());
  await auth.mockOtpVerifySuccess();
  await auth.enterOtp('123456');
  await auth.submitOtp();
});

test.describe('Checkout - successful payment scenarios', () => {
  test('upgrading to PRO - 7 DAYS with a successful Visa test card completes payment [positive]', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO - 7 DAYS').click();
    await checkout.confirmAndPay();
    await checkout.assertTestModeBannerVisible();
    await checkout.payWithNewCard(RAZORPAY_TEST_CARDS.success);
    await expect(checkout.paymentSuccessIndicator()).toBeVisible({ timeout: 20_000 });
  });

  test('upgrading to PRO with a successful Mastercard test card completes payment [positive]', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO').click();
    await checkout.confirmAndPay();
    await checkout.assertTestModeBannerVisible();
    await checkout.payWithNewCard(RAZORPAY_TEST_CARDS.successMastercard);
    await expect(checkout.paymentSuccessIndicator()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Checkout - declined payment scenarios', () => {
  test('a generic decline test card surfaces a payment-failed message, not a false success [negative]', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO - 7 DAYS').click();
    await checkout.confirmAndPay();
    await checkout.assertTestModeBannerVisible();
    await checkout.payWithNewCard(RAZORPAY_TEST_CARDS.failureDecline);
    await expect(checkout.paymentFailureIndicator()).toBeVisible({ timeout: 20_000 });
    await expect(checkout.paymentSuccessIndicator()).not.toBeVisible();
  });

  test('an insufficient-funds test card surfaces a payment-failed message [negative]', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO - 7 DAYS').click();
    await checkout.confirmAndPay();
    await checkout.assertTestModeBannerVisible();
    await checkout.payWithNewCard(RAZORPAY_TEST_CARDS.failureInsufficientFunds);
    await expect(checkout.paymentFailureIndicator()).toBeVisible({ timeout: 20_000 });
  });

  test('the account plan must NOT be upgraded after a declined payment [negative]', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO').click();
    await checkout.confirmAndPay();
    await checkout.assertTestModeBannerVisible();
    await checkout.payWithNewCard(RAZORPAY_TEST_CARDS.failureDecline);
    await expect(checkout.paymentFailureIndicator()).toBeVisible({ timeout: 20_000 });

    await page.goto('/profile?tab=plan');
    await expect(page.getByText('Free')).toBeVisible(); // plan must remain unchanged
  });
});

test.describe('Checkout - invalid card input (client-side validation)', () => {
  for (const [name, card] of Object.entries(INVALID_CARDS)) {
    test(`rejects invalid card input: ${name} [negative]`, async ({ page }) => {
      const checkout = new CheckoutPage(page);
      await checkout.goto();
      await checkout.openUpgradeModal();
      await checkout.choosePlanInModal('PRO - 7 DAYS').click();
      await checkout.confirmAndPay();
      await checkout.assertTestModeBannerVisible();

      const frame = checkout.razorpayFrame();
      await frame.getByPlaceholder('Card Number').fill(card.number.replace(/\s+/g, ''));
      await frame.getByPlaceholder('MM / YY').fill(card.expiry);
      await frame.getByPlaceholder('CVV').fill(card.cvv);
      await frame.getByRole('button', { name: 'Continue' }).click();

      // Must not be allowed to proceed to a charge attempt with bad input.
      await expect(checkout.paymentSuccessIndicator()).not.toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe('Checkout - plan pricing/billing consistency (BUG-02 regression)', () => {
  test('the Confirm Plan Change dialog for "PRO - 7 DAYS" must not silently switch cadence to Monthly', async ({ page }) => {
    // Documented finding: the pricing page advertises "PRO - 7 DAYS" as
    // ₹100/day, but the authenticated Confirm Plan Change dialog shows
    // "₹100 /mo" and labels billing as "Monthly", and the downstream
    // Razorpay checkout describes a recurring charge every 7 days until
    // 29 Jun 2028. This test pins the dialog's own internal consistency:
    // if it shows a per-day price, it must not also claim monthly billing.
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.openUpgradeModal();
    await checkout.choosePlanInModal('PRO - 7 DAYS').click();

    const planPriceInModal = page.locator('text=/₹100/');
    await expect(planPriceInModal).toBeVisible();

    const cadenceLabel = await checkout.confirmDialogBillingCadence().textContent().catch(() => null);
    if (cadenceLabel && /monthly/i.test(cadenceLabel)) {
      throw new Error(
        `BUG-02: "PRO - 7 DAYS" is priced per-day on /pricing but the Confirm Plan Change ` +
          `dialog labels billing as "${cadenceLabel}". Cadence must be consistent across surfaces.`
      );
    }
  });
});
