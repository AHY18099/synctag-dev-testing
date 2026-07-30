import { Page, Locator } from '@playwright/test';

/** Page object for the public /pricing marketing page. */
export class PricingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/pricing');
  }

  /** Returns the pricing card container for a given plan name (e.g. "PRO - 7 DAYS"). */
  planCard(planName: string): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(planName, { exact: true }) })
      .last();
  }

  chooseButton(planName: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`CHOOSE\\s+${planName}`, 'i') });
  }

  /** Reads the big price figure text (e.g. "₹100") shown for a given plan card. */
  async priceAmount(planName: string): Promise<string | null> {
    const card = this.planCard(planName);
    return card.locator('text=/₹[0-9,]+/').first().textContent();
  }

  /** Reads the cadence suffix text (e.g. "/ day", "/ month") next to the price, if any. */
  async priceCadence(planName: string): Promise<string | null> {
    const card = this.planCard(planName);
    const cadence = card.locator('text=/\\/\\s*(day|month)/i');
    if (await cadence.count() === 0) return null;
    return cadence.first().textContent();
  }

  /** Returns the list of feature line items rendered inside a plan's card. */
  async features(planName: string): Promise<string[]> {
    const card = this.planCard(planName);
    return card.locator('li, [class*="feature"]').allTextContents();
  }
}
