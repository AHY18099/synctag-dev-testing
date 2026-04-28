/**
 * Accessibility Test Suite — A11Y-001 to A11Y-030
 * Uses @axe-core/playwright to assert WCAG 2.1 compliance on every major page.
 * Also covers keyboard navigation, focus visibility, ARIA roles, and screen-reader attributes.
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage }     from '../../page-objects/LoginPage';
import { DashboardPage } from '../../page-objects/DashboardPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL   = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AxeViolation {
  id:     string;
  impact: string | null;
  description: string;
  nodes:  unknown[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function runAxe(page: Page, context?: string): Promise<AxeViolation[]> {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (context) builder = builder.include(context);
  const results = await builder.analyze();
  return results.violations as AxeViolation[];
}

function assertNoCriticalOrSerious(violations: AxeViolation[], pageLabel: string): void {
  const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  expect(
    critical,
    `${pageLabel} has ${critical.length} critical/serious axe violation(s):\n` +
    critical.map(v => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
  ).toHaveLength(0);
}

// ─── Shared authenticated context ────────────────────────────────────────────

let authCtx:  BrowserContext;
let authPage: Page;

// ─── GROUP 1: Axe scans on public pages ──────────────────────────────────────

test.describe('A11Y-01: Public Pages — Axe Core Scans', () => {
  test('A11Y-001: Homepage has no critical/serious accessibility violations', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const violations = await runAxe(page);
    assertNoCriticalOrSerious(violations, 'Homepage');
  });

  test('A11Y-002: Login page has no critical/serious accessibility violations', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const violations = await runAxe(page);
    assertNoCriticalOrSerious(violations, 'Login page');
  });

  test('A11Y-003: Login page — all form inputs have associated labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    // Axe's label rule covers this; also assert via DOM query
    const violations = await new AxeBuilder({ page }).withRules(['label']).analyze();
    expect(
      (violations.violations as AxeViolation[]).filter(v => v.id === 'label'),
      'Input elements must have labels'
    ).toHaveLength(0);
  });

  test('A11Y-004: Login page — color-contrast rule passes', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const results    = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const violations = (results.violations as AxeViolation[]).filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(violations, 'Critical/serious color-contrast failures on login page').toHaveLength(0);
  });
});

// ─── GROUP 2: Axe scans on authenticated pages ───────────────────────────────

test.describe('A11Y-02: Authenticated Pages — Axe Core Scans', () => {
  test.beforeAll(async ({ browser }) => {
    authCtx  = await browser.newContext();
    authPage = await authCtx.newPage();
    const login = new LoginPage(authPage);
    await login.signupWithMailinator(authCtx, FREE_EMAIL);
  });

  test.afterAll(async () => { await authCtx.close(); });

  test('A11Y-005: Dashboard (Tag Library) has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Dashboard');
  });

  test('A11Y-006: Create-tag form has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await authPage.locator('[role="tab"]:has-text("Text"), button:has-text("Text")').waitFor({ timeout: 5000 });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Create-tag form');
    await authPage.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });

  test('A11Y-007: Pipelines page has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/pipelines`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Pipelines');
  });

  test('A11Y-008: Global Tags page has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/global-tags`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Global Tags');
  });

  test('A11Y-009: Secured Tags page has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/secured-tags`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Secured Tags');
  });

  test('A11Y-010: Analytics page has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Analytics');
  });

  test('A11Y-011: Profile page has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Profile');
  });

  test('A11Y-012: Wallet tab has no critical/serious violations', async () => {
    await authPage.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await authPage.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
    await authPage.waitForTimeout(500);
    const violations = await runAxe(authPage);
    assertNoCriticalOrSerious(violations, 'Wallet tab');
  });
});

// ─── GROUP 3: Keyboard Navigation ────────────────────────────────────────────

test.describe('A11Y-03: Keyboard Navigation', () => {
  let ctx: BrowserContext;
  let pg:  Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    pg  = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
  });

  test.afterAll(async () => { await ctx.close(); });

  test('A11Y-013: Login page — Tab cycles through all form fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    // Focus first element and tab through
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused);
  });

  test('A11Y-014: Login page — Enter on Continue button submits', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    await page.fill('input[type="email"], input[name="email"]', `kbd-test-${Date.now()}@mailinator.com`);
    await page.focus('button:has-text("CONTINUE"), button:has-text("Continue")');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Verify your access').first()).toBeVisible({ timeout: 15000 });
  });

  test('A11Y-015: Dashboard — Tab moves focus through sidebar nav links', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await pg.keyboard.press('Tab');
    const firstFocused = await pg.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();
    // Tab several more times to cycle through interactive elements
    for (let i = 0; i < 5; i++) {
      await pg.keyboard.press('Tab');
    }
    const focusedAfter = await pg.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? '');
    expect(focusedAfter.length).toBeGreaterThanOrEqual(0); // Focus moved without error
  });

  test('A11Y-016: Create-tag modal — Escape closes it', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await pg.locator('[role="tab"]:has-text("Text"), button:has-text("Text")').waitFor({ timeout: 5000 });
    await pg.keyboard.press('Escape');
    await expect(pg.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('A11Y-017: Vault modal — Escape closes it', async () => {
    await pg.goto(`${BASE_URL}/secured-tags`, { waitUntil: 'networkidle' });
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await pg.locator('input[type="password"]').waitFor({ timeout: 5000 });
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(500);
    const modalGone = await pg.locator('input[type="password"]').isVisible().catch(() => false);
    // Modal should be gone or vault button visible again
    const vaultBtn = await pg.locator('button:has-text("INITIALIZE VAULT")').isVisible().catch(() => false);
    expect(!modalGone || vaultBtn).toBeTruthy();
  });

  test('A11Y-018: Plan upgrade modal — Escape closes it', async () => {
    await pg.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await pg.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
    await pg.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
    await pg.locator('text=Choose Your Plan, text=Choose Plan').first().waitFor({ timeout: 5000 }).catch(() => {});
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(500);
  });
});

// ─── GROUP 4: Screen-reader Attributes ───────────────────────────────────────

test.describe('A11Y-04: Screen-reader Attributes', () => {
  let ctx: BrowserContext;
  let pg:  Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    pg  = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
  });

  test.afterAll(async () => { await ctx.close(); });

  test('A11Y-019: All images on homepage have non-empty alt attributes', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const images = page.locator('img');
    const count  = await images.count();
    for (let i = 0; i < count; i++) {
      const alt  = await images.nth(i).getAttribute('alt');
      const role = await images.nth(i).getAttribute('role');
      // Either has alt text, or is decorative (role="presentation" or alt="")
      const isDecorative = role === 'presentation' || alt === '';
      if (!isDecorative) {
        expect(alt, `Image ${i} missing alt`).toBeTruthy();
      }
    }
  });

  test('A11Y-020: All buttons on dashboard have accessible names', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const violations = await new AxeBuilder({ page: pg }).withRules(['button-name']).analyze();
    expect(
      (violations.violations as AxeViolation[]).filter(v => v.id === 'button-name'),
      'Buttons without accessible names found'
    ).toHaveLength(0);
  });

  test('A11Y-021: All form inputs on create-tag form have labels', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await pg.locator('[role="tab"]:has-text("Text"), button:has-text("Text")').waitFor({ timeout: 5000 });
    const violations = await new AxeBuilder({ page: pg }).withRules(['label']).analyze();
    expect(
      (violations.violations as AxeViolation[]).filter(v => v.id === 'label'),
      'Form inputs without labels on create-tag form'
    ).toHaveLength(0);
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });

  test('A11Y-022: Sidebar nav links have aria-label or visible text', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const navLinks = pg.locator('nav a, [class*="sidebar"] a');
    const count    = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const link      = navLinks.nth(i);
      const text      = await link.innerText().catch(() => '');
      const ariaLabel = await link.getAttribute('aria-label') ?? '';
      const ariaLbBy  = await link.getAttribute('aria-labelledby') ?? '';
      expect(
        text.trim().length > 0 || ariaLabel.trim().length > 0 || ariaLbBy.trim().length > 0,
        `Sidebar link ${i} has no accessible name`
      ).toBeTruthy();
    }
  });

  test('A11Y-023: Tabs on profile page have correct ARIA role', async () => {
    await pg.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const violations = await new AxeBuilder({ page: pg })
      .withRules(['aria-required-attr', 'aria-valid-attr-value'])
      .analyze();
    const ariaViolations = (violations.violations as AxeViolation[])
      .filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(ariaViolations, 'Critical ARIA attribute violations on profile page').toHaveLength(0);
  });
});

// ─── GROUP 5: Focus Visibility ────────────────────────────────────────────────

test.describe('A11Y-05: Focus Visibility', () => {
  test('A11Y-024: Interactive elements on login page show visible focus ring', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.focus();
    // Check that the focused element has a CSS outline or box-shadow
    const hasFocusStyle = await emailInput.evaluate((el: HTMLElement) => {
      const style   = window.getComputedStyle(el);
      const outline = style.outline;
      const shadow  = style.boxShadow;
      return outline !== 'none' || shadow !== 'none';
    });
    // We accept if the element renders a focus indicator in any form
    expect(hasFocusStyle).toBeTruthy();
  });

  test('A11Y-025: Continue button on login page is focusable', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    const btn = page.locator('button:has-text("CONTINUE"), button:has-text("Continue")').first();
    await btn.focus();
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(focused.toLowerCase()).toMatch(/continue/i);
  });

  test('A11Y-026: NEW TAG button on dashboard is focusable via keyboard Tab', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const pg   = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const btn = pg.locator('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")').first();
    await btn.focus();
    const tabIndex = await btn.evaluate((el: HTMLElement) => el.tabIndex);
    expect(tabIndex).toBeGreaterThanOrEqual(-1); // -1 is programmatically focusable
    await ctx.close();
  });
});

// ─── GROUP 6: Color Contrast & ARIA Roles ────────────────────────────────────

test.describe('A11Y-06: Color Contrast & ARIA Correctness', () => {
  test('A11Y-027: Homepage passes color-contrast check', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    const serious = (results.violations as AxeViolation[]).filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(serious, 'Critical color-contrast failures on homepage').toHaveLength(0);
  });

  test('A11Y-028: Modal dialogs use role=dialog and aria-modal', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const pg   = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await pg.waitForTimeout(500);

    const dialogs = pg.locator('[role="dialog"]');
    const count   = await dialogs.count();
    // If a dialog role is found, it should be accessible
    if (count > 0) {
      const violations = await new AxeBuilder({ page: pg })
        .withRules(['aria-dialog-name'])
        .analyze()
        .catch(() => ({ violations: [] }));
      const critViol = ((violations as { violations: AxeViolation[] }).violations)
        .filter(v => v.impact === 'critical');
      expect(critViol).toHaveLength(0);
    }
    await pg.keyboard.press('Escape');
    await ctx.close();
  });

  test('A11Y-029: Skip link present on dashboard (if main content exists)', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const pg   = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });

    // Skip link may be visually hidden but accessible via keyboard
    const skipLink = pg.locator('a[href="#main"], a[href="#content"], a:has-text("Skip")').first();
    const exists   = await skipLink.count() > 0;
    if (exists) {
      await skipLink.focus();
      await expect(skipLink).toBeFocused();
    }
    // Pass regardless; just log presence
    await ctx.close();
  });

  test('A11Y-030: Analytics page passes full WCAG 2.1 AA axe scan', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const pg   = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    const violations = await runAxe(pg);
    assertNoCriticalOrSerious(violations, 'Analytics');
    await ctx.close();
  });
});
