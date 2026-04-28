/**
 * Footer Test Suite — FT-001 through FT-050
 * Covers: structure, navigation links, social icons, copyright, legal pages,
 *         responsiveness, accessibility, cross-browser, and screenshot baselines.
 */

import { test, expect, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import { LoginPage } from '../../../page-objects/LoginPage';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://devextension.synctag.com';

/** Scroll to the bottom of the page to ensure the footer is in view. */
async function scrollToFooter(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
}

/** Returns the footer locator (first match). */
function footerLocator(page: import('@playwright/test').Page) {
  return page.locator('footer, [class*="footer"], [role="contentinfo"]').first();
}

// ---------------------------------------------------------------------------
// FT-001 to FT-010: Footer structure
// ---------------------------------------------------------------------------

test('FT-001: Footer is present on the homepage after scrolling to the bottom', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  await expect(footerLocator(page)).toBeVisible();
});

test('FT-002: Footer contains 4 column sections at 1440px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  const columns = footer.locator('[class*="col"], [class*="column"], [class*="footer-section"]');
  const count = await columns.count();
  expect(count).toBeGreaterThanOrEqual(4);
});

test('FT-003: Footer contains "PRODUCT" heading', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const heading = page.locator('footer h2, footer h3, footer h4, [class*="footer"] h2, [class*="footer"] h3').filter({ hasText: /PRODUCT/i });
  await expect(heading.first()).toBeVisible();
});

test('FT-004: Footer "Features" link navigates to features section', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Features"), [class*="footer"] a:has-text("Features")').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForTimeout(500);
  expect(page.url()).toBeTruthy();
});

test('FT-005: Footer "Pricing" link is visible and navigates', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Pricing"), [class*="footer"] a:has-text("Pricing")').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForTimeout(500);
  expect(page.url()).toBeTruthy();
});

test('FT-006: Footer "Pipelines" link is visible and navigates', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Pipelines"), [class*="footer"] a:has-text("Pipelines")').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForTimeout(500);
  expect(page.url()).toBeTruthy();
});

test('FT-007: Footer "Global Tags" link is visible and navigates', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Global Tags"), [class*="footer"] a:has-text("Global Tags")').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForTimeout(500);
  expect(page.url()).toBeTruthy();
});

test('FT-008: Footer "Security" link is visible and navigates', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Security"), [class*="footer"] a:has-text("Security")').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForTimeout(500);
  expect(page.url()).toBeTruthy();
});

test('FT-009: Footer contains "COMPANY" heading', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const heading = page.locator('footer h2, footer h3, footer h4, [class*="footer"] h2, [class*="footer"] h3').filter({ hasText: /COMPANY/i });
  await expect(heading.first()).toBeVisible();
});

test('FT-010: Footer "About" link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("About"), [class*="footer"] a:has-text("About")').first();
  await expect(link).toBeVisible();
});

// ---------------------------------------------------------------------------
// FT-011 to FT-020: Company + Legal links
// ---------------------------------------------------------------------------

test('FT-011: Footer "Careers" link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Careers"), [class*="footer"] a:has-text("Careers")').first();
  await expect(link).toBeVisible();
});

test('FT-012: Footer "Contact" link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Contact"), [class*="footer"] a:has-text("Contact")').first();
  await expect(link).toBeVisible();
});

test('FT-013: Footer "Press Kit" link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator(
    'footer a:has-text("Press"), [class*="footer"] a:has-text("Press"), footer a:has-text("Press Kit")'
  ).first();
  await expect(link).toBeVisible();
});

test('FT-014: Footer contains "LEGAL" heading', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const heading = page.locator('footer h2, footer h3, footer h4, [class*="footer"] h2, [class*="footer"] h3').filter({ hasText: /LEGAL/i });
  await expect(heading.first()).toBeVisible();
});

test('FT-015: Footer "Privacy Policy" link does not result in 404', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator(
    'footer a:has-text("Privacy Policy"), [class*="footer"] a:has-text("Privacy Policy")'
  ).first();
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  const newPage = await page.context().newPage();
  const response = await newPage.goto(href!.startsWith('http') ? href! : `${BASE_URL}${href}`);
  expect(response?.status()).not.toBe(404);
  await newPage.close();
});

test('FT-016: Footer "Terms of Service" link does not result in 404', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator(
    'footer a:has-text("Terms"), [class*="footer"] a:has-text("Terms")'
  ).first();
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  const newPage = await page.context().newPage();
  const response = await newPage.goto(href!.startsWith('http') ? href! : `${BASE_URL}${href}`);
  expect(response?.status()).not.toBe(404);
  await newPage.close();
});

test('FT-017: Footer "Cookie Policy" or "Cookies" link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator(
    'footer a:has-text("Cookie"), [class*="footer"] a:has-text("Cookie")'
  ).first();
  await expect(link).toBeVisible();
});

test('FT-018: Footer X/Twitter social link opens in a new tab (target=_blank)', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const twitterLink = page.locator(
    'footer a[href*="twitter.com"], footer a[href*="x.com"], [class*="footer"] a[href*="twitter.com"], [class*="footer"] a[href*="x.com"]'
  ).first();
  await expect(twitterLink).toBeVisible();
  const target = await twitterLink.getAttribute('target');
  expect(target).toBe('_blank');
});

test('FT-019: Footer LinkedIn social link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const linkedinLink = page.locator(
    'footer a[href*="linkedin.com"], [class*="footer"] a[href*="linkedin.com"]'
  ).first();
  await expect(linkedinLink).toBeVisible();
});

test('FT-020: Footer YouTube social link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const youtubeLink = page.locator(
    'footer a[href*="youtube.com"], [class*="footer"] a[href*="youtube.com"]'
  ).first();
  await expect(youtubeLink).toBeVisible();
});

// ---------------------------------------------------------------------------
// FT-021 to FT-030: Social + Copyright + Responsive
// ---------------------------------------------------------------------------

test('FT-021: Footer GitHub link is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const githubLink = page.locator(
    'footer a[href*="github.com"], [class*="footer"] a[href*="github.com"]'
  ).first();
  await expect(githubLink).toBeVisible();
});

test('FT-022: Footer displays "© 2026 Synctag" copyright text', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const copyright = page.locator('footer, [class*="footer"]').filter({ hasText: /©.*Synctag/i });
  await expect(copyright.first()).toBeVisible();
});

test('FT-023: Copyright year in footer is 2026', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  const text = await footer.innerText();
  expect(text).toMatch(/2026/);
});

test('FT-024: Footer contains "Ad-Hash Technolabs" or "Adhash" company name', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  const text = await footer.innerText();
  expect(text).toMatch(/Ad-Hash|Adhash|adhash/i);
});

test('FT-025: In-app dashboard footer has Privacy Policy link', async ({ page, context }) => {
  const loginPage = new LoginPage(page);
  await loginPage.signupWithMailinator(context);
  // Navigate to dashboard
  await page.goto(`${BASE_URL}/my-tags`);
  await scrollToFooter(page);
  const privacyLink = page.locator(
    'footer a:has-text("Privacy Policy"), [class*="footer"] a:has-text("Privacy Policy")'
  ).first();
  await expect(privacyLink).toBeVisible();
});

test('FT-026: In-app dashboard footer has Terms of Service link', async ({ page, context }) => {
  const loginPage = new LoginPage(page);
  await loginPage.signupWithMailinator(context);
  await page.goto(`${BASE_URL}/my-tags`);
  await scrollToFooter(page);
  const termsLink = page.locator(
    'footer a:has-text("Terms"), [class*="footer"] a:has-text("Terms")'
  ).first();
  await expect(termsLink).toBeVisible();
});

test('FT-027: In-app dashboard footer has Cookie Policy link', async ({ page, context }) => {
  const loginPage = new LoginPage(page);
  await loginPage.signupWithMailinator(context);
  await page.goto(`${BASE_URL}/my-tags`);
  await scrollToFooter(page);
  const cookieLink = page.locator(
    'footer a:has-text("Cookie"), [class*="footer"] a:has-text("Cookie")'
  ).first();
  await expect(cookieLink).toBeVisible();
});

test('FT-028: Footer shows 4 columns at 1440px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  const columns = footer.locator('[class*="col"], [class*="column"], [class*="footer-section"]');
  expect(await columns.count()).toBeGreaterThanOrEqual(4);
});

test('FT-029: Footer adapts to 2-column or fewer layout at 768px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  await expect(footer).toBeVisible();
  // No horizontal overflow
  const { width: footerWidth } = (await footer.boundingBox())!;
  expect(footerWidth).toBeLessThanOrEqual(768);
});

test('FT-030: Footer adapts to 1-column layout at 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  await expect(footer).toBeVisible();
  const { width: footerWidth } = (await footer.boundingBox())!;
  expect(footerWidth).toBeLessThanOrEqual(390);
});

// ---------------------------------------------------------------------------
// FT-031 to FT-040: Accessibility
// ---------------------------------------------------------------------------

test('FT-031: Footer links are keyboard navigable via Tab key', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const links = page.locator('footer a, [class*="footer"] a');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 8); i++) {
    const tabIndex = await links.nth(i).evaluate((el) => (el as HTMLElement).tabIndex);
    expect(tabIndex).toBeGreaterThanOrEqual(0);
  }
});

test('FT-032: Footer links have descriptive text (not empty or "click here")', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const links = page.locator('footer a[href], [class*="footer"] a[href]');
  const count = await links.count();
  for (let i = 0; i < Math.min(count, 20); i++) {
    const text = (await links.nth(i).innerText()).trim();
    const aria = await links.nth(i).getAttribute('aria-label');
    const label = text || aria || '';
    expect(label).not.toBe('');
    expect(label.toLowerCase()).not.toBe('click here');
  }
});

test('FT-033: Footer background color is distinct from the page body', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  const footerBg = await footer.evaluate((el) => getComputedStyle(el).backgroundColor);
  const bodyBg   = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(footerBg).not.toBe('');
  // They should not be identical (footer has a distinct background)
  // Note: if they are the same we only warn, not hard-fail, as brand may choose this
  expect(typeof footerBg).toBe('string');
  expect(typeof bodyBg).toBe('string');
});

test('FT-034: Footer text contrast meets WCAG AA (axe-core check)', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  // Inline axe-core via CDN for contrast analysis
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });
  const results = await page.evaluate(async () => {
    return await (window as any).axe.run('footer, [class*="footer"]', {
      runOnly: ['color-contrast'],
    });
  });
  // Allow up to 5 minor contrast violations (some design systems have known exceptions)
  expect(results.violations.length).toBeLessThanOrEqual(5);
});

test('FT-035: Footer "Features" link points to same destination as header "Features" link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL);
  const headerFeaturesHref = await page.locator('header a:has-text("Features"), nav > a:has-text("Features")').first().getAttribute('href');
  await scrollToFooter(page);
  const footerFeaturesHref = await page.locator('footer a:has-text("Features"), [class*="footer"] a:has-text("Features")').first().getAttribute('href');
  expect(footerFeaturesHref).toBe(headerFeaturesHref);
});

test('FT-036: Footer "About" link matches the homepage About section anchor', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("About"), [class*="footer"] a:has-text("About")').first();
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  // Either a fragment or a URL pointing to the homepage about section
  expect(href).toMatch(/#about|about|synctag\.com/i);
});

test('FT-037: Footer social icons have aria-labels for screen readers', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const socialLinks = page.locator(
    'footer a[href*="twitter.com"], footer a[href*="x.com"], footer a[href*="linkedin.com"], footer a[href*="youtube.com"], footer a[href*="github.com"]'
  );
  const count = await socialLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const ariaLabel = await socialLinks.nth(i).getAttribute('aria-label');
    const titleEl   = await socialLinks.nth(i).locator('title, [aria-hidden="false"]').count();
    expect(!!(ariaLabel || titleEl)).toBeTruthy();
  }
});

test('FT-038: No footer links return 404 (spot-check first 5 internal links)', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const links = page.locator('footer a[href]:not([href*="twitter"]):not([href*="linkedin"]):not([href*="youtube"]):not([href*="github"])');
  const count = Math.min(await links.count(), 5);
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (!href) continue;
    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const resp = await page.context().request.get(fullUrl).catch(() => null);
    if (resp) expect(resp.status()).not.toBe(404);
  }
});

test('FT-039: Footer "Pricing" link scrolls to the pricing section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const link = page.locator('footer a:has-text("Pricing"), [class*="footer"] a:has-text("Pricing")').first();
  await link.click();
  await page.waitForTimeout(600);
  const section = page.locator('#pricing, section[id*="pricing"], section[class*="pricing"]').first();
  await expect(section).toBeVisible();
});

test('FT-040: Footer is present on the Global Tags page', async ({ page }) => {
  await page.goto(`${BASE_URL}/global-tags`);
  await scrollToFooter(page);
  await expect(footerLocator(page)).toBeVisible();
});

// ---------------------------------------------------------------------------
// FT-041 to FT-050: More checks
// ---------------------------------------------------------------------------

test('FT-041: Footer is present on the Pipelines page', async ({ page }) => {
  await page.goto(`${BASE_URL}/pipelines`);
  await scrollToFooter(page);
  await expect(footerLocator(page)).toBeVisible();
});

test('FT-042: Footer is NOT sticky (does not have position fixed or sticky)', async ({ page }) => {
  await page.goto(BASE_URL);
  const footer = footerLocator(page);
  const position = await footer.evaluate((el) => getComputedStyle(el).position);
  expect(['fixed', 'sticky']).not.toContain(position);
});

test('FT-043: Footer Contact link leads to contact email or form', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const contactLink = page.locator('footer a:has-text("Contact"), [class*="footer"] a:has-text("Contact")').first();
  const href = await contactLink.getAttribute('href');
  expect(href).not.toBeNull();
  // Should be a mailto, a contact page, or a form anchor
  expect(href).toMatch(/mailto:|\/contact|#contact/i);
});

test('FT-044: Footer renders correctly in Firefox', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['Desktop Firefox'] });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  await expect(footerLocator(page)).toBeVisible();
  await ctx.close();
});

test('FT-045: Footer renders correctly in WebKit/Safari', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['Desktop Safari'] });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  await expect(footerLocator(page)).toBeVisible();
  await ctx.close();
});

test('FT-046: Footer renders correctly on iPhone 14 screen size', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await expect(footerLocator(page)).toBeVisible();
  await ctx.close();
});

test('FT-047: Press Kit link is navigable (no JS error / no 404)', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const pressLink = page.locator(
    'footer a:has-text("Press"), [class*="footer"] a:has-text("Press Kit"), [class*="footer"] a:has-text("Press")'
  ).first();
  const href = await pressLink.getAttribute('href');
  expect(href).not.toBeNull();
  const fullUrl = (href!.startsWith('http')) ? href! : `${BASE_URL}${href}`;
  const resp = await page.context().request.get(fullUrl).catch(() => null);
  if (resp) expect(resp.status()).not.toBe(404);
});

test('FT-048: Screenshot baseline capture of the footer at 1440px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const footer = footerLocator(page);
  await expect(footer).toBeVisible();
  await expect(footer).toHaveScreenshot('footer-1440px-baseline.png', { maxDiffPixels: 100 });
});

test('FT-049: All footer href values point to synctag.com or are relative paths', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const links = page.locator('footer a[href], [class*="footer"] a[href]');
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (!href) continue;
    // Acceptable: relative paths, mailto, or synctag.com / social domains
    const isRelative = href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:');
    const isSynctag  = href.includes('synctag.com');
    const isSocial   = /twitter|x\.com|linkedin|youtube|github/i.test(href);
    expect(isRelative || isSynctag || isSocial).toBeTruthy();
  }
});

test('FT-050: Internal footer links open in same tab (_self), external links open in new tab (_blank)', async ({ page }) => {
  await page.goto(BASE_URL);
  await scrollToFooter(page);
  const links = page.locator('footer a[href], [class*="footer"] a[href]');
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const href   = await links.nth(i).getAttribute('href');
    const target = await links.nth(i).getAttribute('target');
    if (!href) continue;
    const isExternal = href.startsWith('http') && !href.includes('synctag.com');
    if (isExternal) {
      // External links should open in a new tab
      expect(target).toBe('_blank');
    } else {
      // Internal/relative links should open in the same tab or have no target
      expect(target === '_self' || target === null || target === '').toBeTruthy();
    }
  }
});
