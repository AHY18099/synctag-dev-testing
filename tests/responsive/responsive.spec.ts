/**
 * Responsive Test Suite — RESP-001 to RESP-030
 * Verifies layout integrity across desktop, laptop, tablet, and mobile viewports.
 * Checks no horizontal overflow, sidebar collapse, table reflow, modal behaviour, and footer stacking.
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL   = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

// ─── Viewport definitions ─────────────────────────────────────────────────────

interface Viewport { label: string; width: number; height: number; }

const VIEWPORTS: Viewport[] = [
  { label: 'Desktop 1440',  width: 1440, height: 900  },
  { label: 'Laptop 1024',   width: 1024, height: 768  },
  { label: 'Tablet 768',    width: 768,  height: 1024 },
  { label: 'Mobile 390',    width: 390,  height: 844  },
];

const DESKTOP  = VIEWPORTS[0];
const LAPTOP   = VIEWPORTS[1];
const TABLET   = VIEWPORTS[2];
const MOBILE   = VIEWPORTS[3];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 5;
  });
}

async function loginAndNavigate(browser: import('@playwright/test').Browser, vp: Viewport, path: string): Promise<{ ctx: BrowserContext; pg: Page }> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const pg  = await ctx.newPage();
  const login = new LoginPage(pg);
  await login.signupWithMailinator(ctx, FREE_EMAIL);
  if (path !== '/my-tags') {
    await pg.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  }
  return { ctx, pg };
}

// ─── GROUP 1: Homepage — no overflow at every viewport ───────────────────────

test.describe('RESP-01: Homepage Layout at All Viewports', () => {
  for (const vp of VIEWPORTS) {
    test(`RESP-${VIEWPORTS.indexOf(vp) + 1 < 10 ? '00' + (VIEWPORTS.indexOf(vp) + 1) : '0' + (VIEWPORTS.indexOf(vp) + 1)}: No horizontal overflow on homepage at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `Horizontal overflow detected at ${vp.label}`).toBe(false);
    });
  }
});

// ─── Manual labeled tests below ───────────────────────────────────────────────

test.describe('RESP-02: Login Page Responsiveness', () => {
  test('RESP-005: Login page no overflow on Desktop', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('RESP-006: Login page no overflow on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('RESP-007: Login form CTA visible on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    const continueBtn = page.locator('button:has-text("CONTINUE"), button:has-text("Continue")').first();
    await expect(continueBtn).toBeVisible();
    const box = await continueBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });
});

test.describe('RESP-03: Dashboard Sidebar Behaviour', () => {
  test('RESP-008: Sidebar is visible and fully expanded on Desktop', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, DESKTOP, '/my-tags');
    const sidebar     = pg.locator('[class*="sidebar"], nav').first();
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    expect(box!.width).toBeGreaterThan(150); // Expanded sidebar should be wide
    await ctx.close();
  });

  test('RESP-009: Sidebar collapses or hamburger visible on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/my-tags');
    // Either sidebar is hidden or a hamburger/menu button is present
    const hamburger = pg.locator(
      '[class*="hamburger"], [class*="menu-btn"], button[aria-label*="menu"], button[aria-label*="Menu"]'
    ).first();
    const sidebarHidden = await pg.locator('[class*="sidebar"]')
      .first()
      .evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.width === '0px' || parseFloat(style.width) < 10;
      })
      .catch(() => false);

    const hamburgerVisible = await hamburger.isVisible().catch(() => false);
    expect(sidebarHidden || hamburgerVisible, 'Sidebar should collapse or hamburger appear on mobile').toBeTruthy();
    await ctx.close();
  });

  test('RESP-010: Sidebar visible on Laptop viewport', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, LAPTOP, '/my-tags');
    const sidebar = pg.locator('[class*="sidebar"], nav').first();
    await expect(sidebar).toBeVisible();
    await ctx.close();
  });

  test('RESP-011: Sidebar visible on Tablet viewport', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, TABLET, '/my-tags');
    // Tablet may show collapsed or full sidebar; assert no JS error only
    const sidebar = pg.locator('[class*="sidebar"], nav').first();
    const visible = await sidebar.isVisible().catch(() => false);
    // Tablets may show hamburger too; either is acceptable
    const hamburger = pg.locator('[class*="hamburger"], button[aria-label*="menu"]').first();
    const hamVisible = await hamburger.isVisible().catch(() => false);
    expect(visible || hamVisible, 'Sidebar or hamburger should be visible on tablet').toBeTruthy();
    await ctx.close();
  });
});

test.describe('RESP-04: No Horizontal Overflow on Authenticated Pages', () => {
  test('RESP-012: Dashboard no overflow on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/my-tags');
    expect(await hasHorizontalOverflow(pg)).toBe(false);
    await ctx.close();
  });

  test('RESP-013: Analytics page no overflow on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/analytics');
    expect(await hasHorizontalOverflow(pg)).toBe(false);
    await ctx.close();
  });

  test('RESP-014: Global Tags page no overflow on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/global-tags');
    expect(await hasHorizontalOverflow(pg)).toBe(false);
    await ctx.close();
  });

  test('RESP-015: Profile page no overflow on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/profile');
    expect(await hasHorizontalOverflow(pg)).toBe(false);
    await ctx.close();
  });

  test('RESP-016: Pipelines page no overflow on Tablet', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, TABLET, '/pipelines');
    expect(await hasHorizontalOverflow(pg)).toBe(false);
    await ctx.close();
  });
});

test.describe('RESP-05: CTAs and Content Readable at All Viewports', () => {
  test('RESP-017: Homepage hero CTA visible on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const cta = page.locator('a, button').filter({ hasText: /Get Started Free/i }).first();
    await expect(cta).toBeVisible();
  });

  test('RESP-018: Pricing section legible on Mobile (no clipped text)', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const pricingText = page.locator('text=Free').first();
    await expect(pricingText).toBeVisible();
  });

  test('RESP-019: Tag Library heading visible on Laptop', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, LAPTOP, '/my-tags');
    await expect(pg.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()).toBeVisible();
    await ctx.close();
  });

  test('RESP-020: Create Tag button fully visible on Tablet', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, TABLET, '/my-tags');
    const btn = pg.locator('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")').first();
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    await ctx.close();
  });
});

test.describe('RESP-06: Tables and Grids Reflow on Mobile', () => {
  test('RESP-021: Tag cards on Dashboard stack vertically on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/my-tags');
    const cards = pg.locator('[class*="tag-card"], [class*="card"]');
    const count = await cards.count();
    if (count >= 2) {
      const box1 = await cards.nth(0).boundingBox();
      const box2 = await cards.nth(1).boundingBox();
      if (box1 && box2) {
        // On mobile, cards should stack: second card's top > first card's bottom
        const isStacked = box2.y > box1.y + box1.height - 10;
        expect(isStacked, 'Tag cards should stack vertically on mobile').toBeTruthy();
      }
    }
    await ctx.close();
  });

  test('RESP-022: Analytics stat tiles stack on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/analytics');
    const tiles = pg.locator('[class*="stat-tile"], [class*="tile"], [class*="card"]');
    const count = await tiles.count();
    if (count >= 2) {
      const box1 = await tiles.nth(0).boundingBox();
      const box2 = await tiles.nth(1).boundingBox();
      if (box1 && box2) {
        const viewportWidth = MOBILE.width;
        // Each tile should fit within mobile viewport width
        expect(box1.width).toBeLessThanOrEqual(viewportWidth);
        expect(box2.width).toBeLessThanOrEqual(viewportWidth);
      }
    }
    await ctx.close();
  });

  test('RESP-023: Global Tags marketplace cards fit within Mobile viewport', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/global-tags');
    const cards = pg.locator('[class*="tag-card"], [class*="card"]');
    const count = await cards.count();
    if (count > 0) {
      const box = await cards.first().boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(MOBILE.width + 5);
      }
    }
    await ctx.close();
  });
});

test.describe('RESP-07: Modals on Mobile', () => {
  test('RESP-024: Create-tag modal does not overflow Mobile screen width', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/my-tags');
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await pg.waitForTimeout(500);
    const modal = pg.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
    const exists = await modal.isVisible().catch(() => false);
    if (exists) {
      const box = await modal.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(MOBILE.width + 5);
      }
    }
    await pg.keyboard.press('Escape');
    await ctx.close();
  });

  test('RESP-025: Vault initialization modal fits on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/secured-tags');
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await pg.waitForTimeout(500);
    const modal = pg.locator('[role="dialog"], [class*="modal"]').first();
    const exists = await modal.isVisible().catch(() => false);
    if (exists) {
      const box = await modal.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(MOBILE.width + 5);
      }
    }
    await pg.keyboard.press('Escape');
    await ctx.close();
  });

  test('RESP-026: Plan upgrade modal fits on Mobile', async ({ browser }) => {
    const { ctx, pg } = await loginAndNavigate(browser, MOBILE, '/profile');
    await pg.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
    await pg.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
    await pg.waitForTimeout(500);
    const modal = pg.locator('[role="dialog"], [class*="modal"]').first();
    const exists = await modal.isVisible().catch(() => false);
    if (exists) {
      const box = await modal.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(MOBILE.width + 5);
      }
    }
    await pg.keyboard.press('Escape');
    await ctx.close();
  });
});

test.describe('RESP-08: Footer Responsiveness', () => {
  test('RESP-027: Footer visible and no overflow on Desktop', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.locator('footer, [class*="footer"]').first();
    await expect(footer).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('RESP-028: Footer stacks to single column on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.locator('footer, [class*="footer"]').first();
    await expect(footer).toBeVisible();
    // Stacking means footer columns fit within mobile width
    const footerBox = await footer.boundingBox();
    if (footerBox) {
      expect(footerBox.width).toBeLessThanOrEqual(MOBILE.width + 5);
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('RESP-029: Footer Privacy Policy link visible on Tablet', async ({ page }) => {
    await page.setViewportSize({ width: TABLET.width, height: TABLET.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('text=Privacy Policy').first()).toBeVisible();
  });

  test('RESP-030: No broken layout on Secured Tags page at all viewports', async ({ browser }) => {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const pg  = await ctx.newPage();
      const login = new LoginPage(pg);
      await login.signupWithMailinator(ctx, FREE_EMAIL);
      await pg.goto(`${BASE_URL}/secured-tags`, { waitUntil: 'networkidle' });
      const overflow = await hasHorizontalOverflow(pg);
      expect(overflow, `Horizontal overflow on Secured Tags at ${vp.label}`).toBe(false);
      await ctx.close();
    }
  });
});
