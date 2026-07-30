import { Page, Locator, FrameLocator } from '@playwright/test';

/**
 * Page object for the authenticated in-app plan-upgrade flow:
 *   /profile?tab=plan -> "Upgrade Plan" modal -> "Confirm Plan Change" modal
 *   -> embedded Razorpay Checkout iframe (Test Mode).
 *
 * Requires an authenticated session (see AuthPage.mockOtpVerifySuccess, or
 * a pre-provisioned storageState - see README.md).
 */
export class CheckoutPage {
  readonly page: Page;
  readonly upgradePlanButton: Locator;
  readonly confirmAndPayButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.upgradePlanButton = page.getByRole('button', { name: 'Upgrade Plan' });
    this.confirmAndPayButton = page.getByRole('button', { name: 'Confirm & Pay' });
  }

  async goto() {
    // domcontentloaded, not the default 'load': third-party tracker scripts
    // on this site can keep the load event from firing for a long time.
    await this.page.goto('/profile?tab=plan', { waitUntil: 'domcontentloaded' });
  }

  async openUpgradeModal() {
    await this.upgradePlanButton.click();
  }

  /**
   * Locates the "Choose <plan>" CTA inside the upgrade modal for an exact
   * plan name. Anchored with `$` so e.g. "Pro" doesn't also match
   * "Choose Pro - 7 days".
   */
  choosePlanInModal(planName: string): Locator {
    const escaped = planName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    return this.page.getByRole('button', { name: new RegExp(`^choose\\s+${escaped}$`, 'i') });
  }

  /** The "Confirm Plan Change" summary dialog (current plan -> new plan, total). */
  confirmDialogTotal(): Locator {
    return this.page.locator('text=Total').locator('..').locator('text=/₹[0-9,]+/');
  }

  confirmDialogBillingCadence(): Locator {
    return this.page.locator('text=Billing').locator('..').locator('text=/Monthly|Daily|Weekly|Yearly/i');
  }

  async confirmAndPay() {
    await this.confirmAndPayButton.click();
  }

  /**
   * The Razorpay Checkout renders in a same-origin-looking overlay backed by
   * an <iframe> from api.razorpay.com. Playwright's frameLocator lets us
   * reach into it directly.
   */
  razorpayFrame(): FrameLocator {
    return this.page.frameLocator('iframe[name^="razorpay"], iframe[src*="razorpay"]');
  }

  async assertTestModeBannerVisible() {
    // The red diagonal "Test Mode" ribbon rendered by Razorpay Checkout when
    // the merchant/key is in test mode. Confirmed present during manual
    // exploration - this assertion is a hard safety gate: if it is ever
    // NOT present, the suite must abort rather than submit a real card.
    await this.page.locator('text=Test Mode').first().waitFor({ state: 'visible', timeout: 10_000 });
  }

  async payWithNewCard(card: { number: string; expiry: string; cvv: string }) {
    const frame = this.razorpayFrame();
    const addNewCard = frame.getByText('Add a new card');
    if (await addNewCard.isVisible().catch(() => false)) {
      await addNewCard.click();
    }
    await frame.getByPlaceholder('Card Number').fill(card.number.replace(/\s+/g, ''));
    await frame.getByPlaceholder('MM / YY').fill(card.expiry);
    await frame.getByPlaceholder('CVV').fill(card.cvv);
    await frame.getByRole('button', { name: 'Continue' }).click();
  }

  paymentSuccessIndicator(): Locator {
    return this.page.locator('text=/Payment successful|Plan upgraded|Subscription active/i');
  }

  paymentFailureIndicator(): Locator {
    return this.page.locator('text=/Payment failed|declined|try a different/i');
  }
}
