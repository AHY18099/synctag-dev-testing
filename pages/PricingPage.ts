import { Page, Locator } from '@playwright/test';

/** Page object for the public /pricing marketing page. */
export class PricingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    // domcontentloaded, not the default 'load': third-party tracker scripts
    // on this site can keep the load event from firing for a long time.
    await this.page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Returns the pricing card container for a given plan name (e.g. "Pro - 7 days").
   *
   * The page nests several ancestor `div`s that all contain the plan's
   * heading text (the whole grid, a row, the card, and the heading's own
   * wrapper) - naively taking `.first()` or `.last()` picks either the
   * whole grid or a heading-only wrapper with no price in it. This walks
   * every matching div and returns the smallest one that also contains a
   * price (₹...), i.e. the actual single-card container.
   */
  planCard(planName: string): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(planName, { exact: true }) })
      .filter({ hasText: /₹/ })
      .last();
  }

  /**
   * Locates the "Choose <plan>" CTA for an exact plan name. Anchored with
   * `$` so e.g. "PRO" doesn't also match "Choose Pro - 7 days" - the app
   * renders plan-specific buttons that only differ by this suffix.
   */
  chooseButton(planName: string): Locator {
    const escaped = planName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    return this.page.getByRole('button', { name: new RegExp(`^choose\\s+${escaped}$`, 'i') });
  }

  /**
   * Reads the big price figure text (e.g. "₹100") shown for a given plan
   * card. The price is rendered as `<h3>₹100<span>/ day</span></h3>` - the
   * cadence lives in a nested <span>, so reading the <h3>'s OWN text (not
   * innerText, which would include the nested span) isolates just the
   * amount.
   */
  async priceAmount(planName: string): Promise<string | null> {
    const card = this.planCard(planName);
    const priceHeading = card.locator('h3').filter({ hasText: '₹' }).first();
    return priceHeading.evaluate((el) =>
      Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim()
    );
  }

  /**
   * Reads the cadence suffix text (e.g. "/ day", "/ month") next to the
   * price, if any (some plans, e.g. Free, have no recurring cadence).
   *
   * First waits briefly for the price card itself to be visible (goto()
   * only waits for domcontentloaded, so the pricing grid can still be
   * rendering) before checking whether a cadence span exists - .count()
   * does not auto-wait/retry the way locator actions do, so without this
   * the check can race the page's own render and return a false null.
   */
  async priceCadence(planName: string): Promise<string | null> {
    const card = this.planCard(planName);
    await card.locator('h3').filter({ hasText: '₹' }).first().waitFor({ state: 'visible', timeout: 10_000 });
    const cadence = card.locator('span').filter({ hasText: /\/\s*(day|month)/i });
    if ((await cadence.count()) === 0) return null;
    return cadence.first().textContent();
  }

  /** Returns the list of feature line items rendered inside a plan's card. */
  async features(planName: string): Promise<string[]> {
    const card = this.planCard(planName);
    return card.locator('li, [class*="feature"]').allTextContents();
  }
}
