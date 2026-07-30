import { test, expect } from '@playwright/test';
import { PricingPage } from '../pages/PricingPage';
import { PLAN_NAMES, EXPECTED_PRICING } from '../fixtures/testData';

/**
 * Coverage for the public /pricing page: all 7 plan cards, their pricing
 * copy, and feature lists. Several assertions here are direct regression
 * guards for bugs found during manual QA (see bug-report.html).
 */

test.describe('Pricing page - all plans render', () => {
  for (const plan of PLAN_NAMES) {
    test(`"${plan}" plan card is visible with a CTA button [positive]`, async ({ page }) => {
      const pricing = new PricingPage(page);
      await pricing.goto();
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    });
  }
});

test.describe('Pricing page - price/cadence consistency', () => {
  for (const [plan, expected] of Object.entries(EXPECTED_PRICING)) {
    test(`"${plan}" shows the expected amount${expected.cadence ? ' and cadence' : ''} [positive]`, async ({ page }) => {
      const pricing = new PricingPage(page);
      await pricing.goto();
      const amount = await pricing.priceAmount(plan);
      expect(amount?.trim()).toContain(expected.amount);
      if (expected.cadence) {
        const cadence = await pricing.priceCadence(plan);
        expect(cadence?.replace(/\s+/g, ' ').trim()).toContain(expected.cadence.replace(/\s+/g, ' ').trim());
      }
    });
  }

  test('BUG-02 regression: "PRO - 7 DAYS" cadence must stay consistent between the pricing page and the in-app upgrade modal', async ({ page }) => {
    // Documented finding: pricing page shows "₹100 / day" while the
    // authenticated upgrade modal / Confirm Plan Change dialog shows
    // "₹100 /mo" with "Billing: Monthly", and the Razorpay checkout copy
    // describes a recurring charge "every 7 days until 29 Jun 2028" for a
    // plan literally named "7 days". This test only re-verifies the public
    // page's half of the claim (the modal requires an authenticated
    // session - see checkout.spec.ts and README.md "Known gaps").
    const pricing = new PricingPage(page);
    await pricing.goto();
    const cadence = await pricing.priceCadence('PRO - 7 DAYS');
    expect(cadence).toMatch(/day/i);
    expect(cadence).not.toMatch(/month/i);
  });
});

test.describe('Pricing page - business-logic guard rails', () => {
  test('BUG-01 regression: the free "CUSTOM FREE" plan must not expose more premium features than the paid "PRO" plan', async ({ page }) => {
    // Documented finding: the public pricing page offers an "internal
    // unlimited plan" (Admin Dashboard, SSO Integration, Custom
    // Integrations, unlimited tags, 500 org members, etc.) for ₹0 with a
    // self-service "Choose Custom Free" button, while the paid PRO plan at
    // ₹5,000/month lacks several of those same features. This test encodes
    // the specific feature gap so it fails loudly if left unfixed.
    const pricing = new PricingPage(page);
    await pricing.goto();

    const customFreeFeatures = (await pricing.features('CUSTOM FREE')).map((f) => f.trim());
    const enterpriseOnlyFeatures = [
      'Admin Dashboard',
      'SSO Integration',
      'Custom Integrations',
      'Organization Features',
    ];

    const exposedOnFreeTier = enterpriseOnlyFeatures.filter((f) =>
      customFreeFeatures.some((cf) => cf.includes(f))
    );

    expect(
      exposedOnFreeTier,
      `Expected none of ${JSON.stringify(enterpriseOnlyFeatures)} to be selectable for free via ` +
        `"CUSTOM FREE", but found: ${JSON.stringify(exposedOnFreeTier)}. This plan should require ` +
        `admin/internal provisioning, not a public self-service button.`
    ).toEqual([]);
  });

  test('every plan\'s "Choose" button requires authentication before completing selection [positive]', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.chooseButton('PRO').click();
    await expect(page).toHaveURL(/\/auth|\/profile/);
  });
});
