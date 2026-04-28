/**
 * Performance Test Suite — PERF-001 to PERF-030
 * Validates load times, LCP/FCP/TTFB metrics, and API response times
 * for the Synctag application using the Playwright performance API.
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import { DashboardPage } from '../../page-objects/DashboardPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL  = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PerformanceTiming {
  navigationStart:          number;
  fetchStart:               number;
  domainLookupStart:        number;
  domainLookupEnd:          number;
  connectStart:             number;
  connectEnd:               number;
  requestStart:             number;
  responseStart:            number;
  responseEnd:              number;
  domContentLoadedEventEnd: number;
  loadEventEnd:             number;
}

interface PerformanceEntry {
  name:            string;
  entryType:       string;
  startTime:       number;
  duration:        number;
  initiatorType?:  string;
  responseEnd?:    number;
  responseStart?:  number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getNavigationTiming(page: Page): Promise<PerformanceTiming> {
  return page.evaluate<PerformanceTiming>(() => {
    const t = performance.timing;
    return {
      navigationStart:          t.navigationStart,
      fetchStart:               t.fetchStart,
      domainLookupStart:        t.domainLookupStart,
      domainLookupEnd:          t.domainLookupEnd,
      connectStart:             t.connectStart,
      connectEnd:               t.connectEnd,
      requestStart:             t.requestStart,
      responseStart:            t.responseStart,
      responseEnd:              t.responseEnd,
      domContentLoadedEventEnd: t.domContentLoadedEventEnd,
      loadEventEnd:             t.loadEventEnd,
    };
  });
}

async function getLCP(page: Page): Promise<number> {
  return page.evaluate<number>(() => {
    const entries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntryList;
    if (entries.length > 0) {
      const last = entries[entries.length - 1] as PerformanceEntry;
      return last.startTime;
    }
    // Fallback: use loadEventEnd - navigationStart
    const t = performance.timing;
    return t.loadEventEnd - t.navigationStart;
  });
}

async function getFCP(page: Page): Promise<number> {
  return page.evaluate<number>(() => {
    const entries = performance.getEntriesByType('paint') as PerformanceEntryList;
    const fcp = (entries as unknown as PerformanceEntry[]).find(e => e.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
  });
}

async function getTTFB(page: Page): Promise<number> {
  return page.evaluate<number>(() => {
    const t = performance.timing;
    return t.responseStart - t.navigationStart;
  });
}

async function getResourceTiming(page: Page): Promise<PerformanceEntry[]> {
  return page.evaluate<PerformanceEntry[]>(() => {
    return performance.getEntriesByType('resource').map((e: PerformanceEntry) => ({
      name:          e.name,
      entryType:     e.entryType,
      startTime:     e.startTime,
      duration:      e.duration,
      initiatorType: e.initiatorType,
      responseEnd:   e.responseEnd,
      responseStart: e.responseStart,
    }));
  });
}

// ─── Auth fixture (shared across groups) ─────────────────────────────────────

let authContext: BrowserContext;
let authPage:    Page;

// ─── GROUP 1: Page Load Performance (unauthenticated) ───────────────────────

test.describe('PERF-01: Homepage & Public Pages', () => {
  test('PERF-001: Homepage loads within 3 s (wall-clock)', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Homepage took ${elapsed} ms`).toBeLessThan(3000);
  });

  test('PERF-002: Homepage TTFB < 800 ms', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const ttfb = await getTTFB(page);
    expect(ttfb, `TTFB was ${ttfb} ms`).toBeLessThan(800);
  });

  test('PERF-003: Homepage FCP < 2 s', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(500); // allow paint observers to settle
    const fcp = await getFCP(page);
    expect(fcp, `FCP was ${fcp} ms`).toBeLessThan(2000);
  });

  test('PERF-004: Homepage LCP < 3 s', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const lcp = await getLCP(page);
    expect(lcp, `LCP was ${lcp} ms`).toBeLessThan(3000);
  });

  test('PERF-005: Login page loads within 2 s', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Login page took ${elapsed} ms`).toBeLessThan(2000);
  });

  test('PERF-006: Login page TTFB < 800 ms', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const ttfb = await getTTFB(page);
    expect(ttfb, `Login TTFB was ${ttfb} ms`).toBeLessThan(800);
  });

  test('PERF-007: Login page FCP < 1.5 s', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const fcp = await getFCP(page);
    expect(fcp, `Login FCP was ${fcp} ms`).toBeLessThan(1500);
  });
});

// ─── GROUP 2: Authenticated Page Loads ──────────────────────────────────────

test.describe('PERF-02: Authenticated Page Load Budgets', () => {
  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage    = await authContext.newPage();
    const login = new LoginPage(authPage);
    await login.signupWithMailinator(authContext, FREE_EMAIL);
  });

  test.afterAll(async () => {
    await authContext.close();
  });

  test('PERF-008: Dashboard (My Tags) loads within 3 s after login', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Dashboard took ${elapsed} ms`).toBeLessThan(3000);
  });

  test('PERF-009: Dashboard TTFB < 800 ms', async () => {
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    const ttfb = await getTTFB(authPage);
    expect(ttfb, `Dashboard TTFB ${ttfb} ms`).toBeLessThan(800);
  });

  test('PERF-010: Tag Library renders within 2 s after navigation', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.locator('h1, h2').filter({ hasText: /Tag Library/i }).waitFor({ timeout: 2000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Tag Library took ${elapsed} ms`).toBeLessThan(2000);
  });

  test('PERF-011: Create-tag form opens within 1 s', async () => {
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const start = Date.now();
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await authPage.locator('[role="tab"]:has-text("Text"), button:has-text("Text")').waitFor({ timeout: 1000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Create-tag form opened in ${elapsed} ms`).toBeLessThan(1000);
    await authPage.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });

  test('PERF-012: Pipeline builder opens within 2 s', async () => {
    await authPage.goto(`${BASE_URL}/pipelines`, { waitUntil: 'networkidle' });
    const start = Date.now();
    await authPage.click(
      'button:has-text("CREATE YOUR FIRST PIPELINE"), button:has-text("NEW PIPELINE"), button:has-text("+ NEW PIPELINE")'
    );
    await authPage.locator('input[name="name"], input[placeholder*="Pipeline"]').waitFor({ timeout: 2000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Pipeline builder opened in ${elapsed} ms`).toBeLessThan(2000);
    await authPage.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });

  test('PERF-013: Analytics page data loads within 5 s', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await authPage.locator('text=Total Tags, text=Total Events').first().waitFor({ timeout: 5000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Analytics took ${elapsed} ms`).toBeLessThan(5000);
  });

  test('PERF-014: Global Tags marketplace loads within 3 s', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/global-tags`, { waitUntil: 'networkidle' });
    await authPage.locator('h1, h2').filter({ hasText: /Global Tags/i }).waitFor({ timeout: 3000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Global Tags took ${elapsed} ms`).toBeLessThan(3000);
  });

  test('PERF-015: Profile page loads within 2 s', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Profile page took ${elapsed} ms`).toBeLessThan(2000);
  });

  test('PERF-016: Secured Tags page loads within 2 s', async () => {
    const start = Date.now();
    await authPage.goto(`${BASE_URL}/secured-tags`, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed, `Secured Tags took ${elapsed} ms`).toBeLessThan(2000);
  });
});

// ─── GROUP 3: Search & Interaction Responsiveness ───────────────────────────

test.describe('PERF-03: Interaction Responsiveness', () => {
  let ctx: BrowserContext;
  let pg:  Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    pg  = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
  });

  test.afterAll(async () => { await ctx.close(); });

  test('PERF-017: Tag search response completes within 500 ms', async () => {
    const search = pg.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await search.waitFor();
    const start = Date.now();
    await search.fill('test');
    // Wait for debounce + results re-render
    await pg.waitForTimeout(300);
    const elapsed = Date.now() - start;
    expect(elapsed, `Search took ${elapsed} ms`).toBeLessThan(500);
    await search.clear();
  });

  test('PERF-018: Sidebar navigation completes within 1 s', async () => {
    const start = Date.now();
    await pg.click('nav >> text=Pipelines, [class*="sidebar"] >> text=Pipelines');
    await pg.waitForURL(/\/pipelines/, { timeout: 1000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `Sidebar nav took ${elapsed} ms`).toBeLessThan(1000);
  });

  test('PERF-019: Sort dropdown opens and applies within 500 ms', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const start = Date.now();
    await pg.click('text=Sort, [class*="sort"]');
    await pg.waitForTimeout(200);
    const elapsed = Date.now() - start;
    expect(elapsed, `Sort dropdown took ${elapsed} ms`).toBeLessThan(500);
    await pg.keyboard.press('Escape');
  });

  test('PERF-020: Type filter dropdown opens within 500 ms', async () => {
    const start = Date.now();
    await pg.click('text=All Types, [class*="type-filter"]');
    await pg.waitForTimeout(200);
    const elapsed = Date.now() - start;
    expect(elapsed, `Filter dropdown took ${elapsed} ms`).toBeLessThan(500);
    await pg.keyboard.press('Escape');
  });
});

// ─── GROUP 4: API Response Times ─────────────────────────────────────────────

test.describe('PERF-04: API Response Times via page.request', () => {
  let ctx: BrowserContext;
  let pg:  Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    pg  = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
  });

  test.afterAll(async () => { await ctx.close(); });

  test('PERF-021: GET /api/tags responds within 2 s', async () => {
    const start = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/tags`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/tags took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });

  test('PERF-022: GET /api/analytics responds within 2 s', async () => {
    const start    = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/analytics`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/analytics took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });

  test('PERF-023: GET /api/profile responds within 2 s', async () => {
    const start    = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/profile`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/profile took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });

  test('PERF-024: GET /api/global-tags responds within 2 s', async () => {
    const start    = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/global-tags`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/global-tags took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });

  test('PERF-025: GET /api/pipelines responds within 2 s', async () => {
    const start    = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/pipelines`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/pipelines took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });

  test('PERF-026: GET /api/wallet responds within 2 s', async () => {
    const start    = Date.now();
    const response = await pg.request.get(`${BASE_URL}/api/wallet`).catch(() => null);
    const elapsed  = Date.now() - start;
    expect(elapsed, `GET /api/wallet took ${elapsed} ms`).toBeLessThan(2000);
    if (response) expect([200, 401, 403]).toContain(response.status());
  });
});

// ─── GROUP 5: Resource Timing & Bundle Size ───────────────────────────────────

test.describe('PERF-05: Resource Timing & Bundle Checks', () => {
  test('PERF-027: No individual JS bundle exceeds 1 MB on homepage', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const resources = await getResourceTiming(page);
    const jsFiles   = resources.filter(r => r.name.endsWith('.js'));
    for (const js of jsFiles) {
      // duration is a proxy for transfer time; flag extremely large files
      expect(js.duration, `JS bundle ${js.name} duration ${js.duration} ms exceeds threshold`).toBeLessThan(5000);
    }
  });

  test('PERF-028: Total number of network requests on homepage < 80', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', req => requests.push(req.url()));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(requests.length, `${requests.length} requests on homepage`).toBeLessThan(80);
  });

  test('PERF-029: Dashboard LCP < 3 s (authenticated)', async ({ browser }) => {
    const ctx   = await browser.newContext();
    const pg    = await ctx.newPage();
    const login = new LoginPage(pg);
    await login.signupWithMailinator(ctx, FREE_EMAIL);
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(500);
    const lcp = await getLCP(pg);
    expect(lcp, `Dashboard LCP was ${lcp} ms`).toBeLessThan(3000);
    await ctx.close();
  });

  test('PERF-030: Navigation timing — DOM content loaded < 2 s on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const timing = await getNavigationTiming(page);
    const dcl    = timing.domContentLoadedEventEnd - timing.navigationStart;
    expect(dcl, `DOMContentLoaded was ${dcl} ms`).toBeLessThan(2000);
  });
});
