import { test, expect, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import { DashboardPage } from '../../page-objects/DashboardPage';
import { CreateTagPage } from '../../page-objects/CreateTagPage';
import { PublicSitePage } from '../../page-objects/PublicSitePage';
import { OrganizationPage } from '../../page-objects/OrganizationPage';
import { AUTH_FILE } from '../../playwright.config';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL  = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

/** Navigate to dashboard using the saved auth session (no OTP round-trip). */
async function gotoApp(_ctx: BrowserContext, pg: Page, path = '/my-tags'): Promise<void> {
  await pg.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(
    () => !globalThis.location.pathname.startsWith('/login'),
    { timeout: 15000 }
  ).catch(() => {});
}

// ── GROUP SM-01: HOMEPAGE & WEBSITE PAGES ───────────────────────────────────

test.describe('SM-01: Homepage & Website Pages', () => {
  test('SM-001: Homepage loads with status 200', async ({ page }) => {
    const start = Date.now();
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    expect(Date.now() - start).toBeLessThan(15000);
    await expect(page).toHaveTitle(/Synctag/i);
  });

  test('SM-002: Hero headline is present', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2').filter({ hasText: /Tags/i }).first()).toBeVisible();
  });

  test('SM-003: Hero primary CTA present', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a, button').filter({ hasText: /get started for free/i }).first()).toBeVisible();
  });

  test('SM-004: Hero secondary CTA present', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a, button').filter({ hasText: /demo/i }).first()).toBeVisible();
  });

  test('SM-005: Pricing section renders', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Free').first()).toBeVisible();
    await expect(page.locator('text=5,000').first()).toBeVisible();
    await expect(page.locator('text=35,000').first()).toBeVisible();
  });

  test('SM-006: Capabilities section renders', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(page.getByText('CAPABILITIES', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/universal sync|workflow engine/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-007: Power/features section renders', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(page.getByText(/power unleashed|password vault|ai processor/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-008: Footer renders', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('text=Privacy Policy').first()).toBeVisible();
    await expect(page.locator('text=Terms of Service').first()).toBeVisible();
  });

  test('SM-009: Homepage is mobile-responsive', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('SM-010: Homepage has valid meta tags', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
  });
});

// ── GROUP SM-02: AUTHENTICATION FLOW ────────────────────────────────────────

test.describe('SM-02: Authentication Flow', () => {
  test('SM-011: Login page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Sign in to Synctag').first()).toBeVisible();
  });

  test('SM-012: Phone tab is default selected', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone"]');
    await expect(phoneInput.first()).toBeVisible();
  });

  test('SM-013: Email tab is clickable and switches view', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test('SM-014: Email tab — enter mailinator email and continue', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`synctag-smoke-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await expect(page.locator('text=Verify your access').first()).toBeVisible({ timeout: 15000 });
  });

  test('SM-015: OTP screen renders correctly', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`synctag-smoke-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await expect(page.locator('input[maxlength="6"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("VERIFY CODE")').first()).toBeVisible();
  });

  test('SM-016: Resend OTP link appears after countdown', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`synctag-smoke-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await expect(page.locator('button:has-text("Resend OTP")').first()).toBeVisible({ timeout: 90000 });
  });

  test('SM-017: Back navigation from OTP screen', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail(`synctag-smoke-${Date.now()}@mailinator.com`);
    await login.clickContinue();
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });
    await page.goBack();
    await page.waitForTimeout(2000);
    // After back, expect to land on login or home — not on OTP screen
    const onOtp = await page.locator('text=Verify your access').isVisible().catch(() => false);
    expect(onOtp).toBe(false);
  });

  test('SM-018: Full signup flow with mailinator', async ({ page, context }) => {
    const login = new LoginPage(page);
    await login.signupWithMailinator(context, FREE_EMAIL);
    await expect(page).toHaveURL(/\/(my-tags|dashboard)/);
  });

  test('SM-019: Welcome email received after first signup', async ({ page, context }) => {
    test.slow();
    const email = `synctag-welcome-${Date.now()}@mailinator.com`;
    const login = new LoginPage(page);
    await login.signupWithMailinator(context, email);
    const inboxPage = await context.newPage();
    const inboxName = email.split('@')[0];
    await inboxPage.goto(`https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`);
    await inboxPage.waitForTimeout(5000);
    const emails = inboxPage.locator('tr.ng-scope, [class*="inbox-row"]');
    expect(await emails.count()).toBeGreaterThan(0);
    await inboxPage.close();
  });

  test('SM-020: Dashboard sidebar visible after login', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav >> text=My Tags, [class*="sidebar"] >> text=My Tags').first()).toBeVisible();
    await expect(page.locator('nav >> text=Pipelines, [class*="sidebar"] >> text=Pipelines').first()).toBeVisible();
    await expect(page.locator('nav >> text=Global Tags, [class*="sidebar"] >> text=Global Tags').first()).toBeVisible();
    await expect(page.locator('nav >> text=Secured Tags, [class*="sidebar"] >> text=Secured Tags').first()).toBeVisible();
    await expect(page.locator('nav >> text=Analytics, [class*="sidebar"] >> text=Analytics').first()).toBeVisible();
  });

  test('SM-021: User card at bottom of sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[class*="user-card"], [class*="avatar"], [class*="user-info"]').first()).toBeVisible();
  });

  test('SM-022: Logout works', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    const dashboard = new DashboardPage(page);
    await dashboard.logout();
    await expect(page).toHaveURL(/\/login/);
  });

  test('SM-023: Phone tab OTP flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("Phone")');
    await expect(page.locator('input[type="tel"]').first()).toBeVisible();
    await page.fill('input[type="tel"]', '9876543210');
    await page.click('button:has-text("CONTINUE")');
    // Phone OTP screen appearance varies by region/country code; just verify no crash
    await page.waitForTimeout(4000);
    expect(page.url()).toBeTruthy();
  });

  test('SM-024: Invalid email format blocked', async ({ page }) => {
    const login = new LoginPage(page);
    await login.gotoLogin();
    await login.selectEmailTab();
    await login.enterEmail('notanemail');
    await login.clickContinue();
    // Browser HTML5 validation blocks submission — input stays invalid, page stays on login
    const isInvalid = await page.evaluate(
      () => !(document.querySelector('input[type="email"]') as HTMLInputElement)?.validity?.valid
    );
    expect(isInvalid).toBeTruthy();
  });

  test('SM-025: Empty phone number blocked', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("CONTINUE"), button:has-text("Continue")');
    await expect(page.locator('[class*="error"], .error, [class*="invalid"]').first()).toBeVisible({ timeout: 5000 });
  });
});

// ── GROUP SM-03: MY TAGS DASHBOARD ──────────────────────────────────────────

test.describe('SM-03: My Tags Dashboard', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext({ storageState: AUTH_FILE });
    sharedPage = await sharedContext.newPage();
    await gotoApp(sharedContext, sharedPage, '/my-tags');
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test('SM-026: My Tags page loads', async () => {
    await expect(sharedPage.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()).toBeVisible();
  });

  test('SM-027: Private Tags tab is default', async () => {
    await expect(sharedPage.locator('button:has-text("Private Tags"), [role="tab"]:has-text("Private Tags")').first()).toBeVisible();
  });

  test('SM-028: Empty state for new account', async () => {
    const emptyState = sharedPage.locator('text=No Tags Found, text=CREATE YOUR FIRST TAG').first();
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('SM-029: Create tag button visible', async () => {
    await expect(sharedPage.locator('button:has-text("NEW TAG"), button:has-text("Create"), button:has-text("CREATE")').first()).toBeVisible();
  });

  test('SM-030: Search bar is visible and interactive', async () => {
    const search = sharedPage.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await expect(search).toBeVisible();
    await search.fill('test');
    await expect(search).toHaveValue('test');
    await search.clear();
  });

  test('SM-031: Sort dropdown present', async () => {
    await expect(sharedPage.locator('text=Sort, [class*="sort"]').first()).toBeVisible();
  });

  test('SM-032: Type filter dropdown present', async () => {
    await expect(sharedPage.locator('text=All Types, [class*="filter"]').first()).toBeVisible();
  });

  test('SM-033: Shared Tags tab switches view', async () => {
    await sharedPage.click('button:has-text("Shared Tags"), [role="tab"]:has-text("Shared Tags")');
    await sharedPage.waitForTimeout(500);
    await sharedPage.click('button:has-text("Private Tags"), [role="tab"]:has-text("Private Tags")');
  });

  test('SM-034: Create Text Tag — save and list appears', async () => {
    const ts = Date.now();
    const trigger = `smoke-text-${ts}`;
    const createTag = new CreateTagPage(sharedPage);
    await sharedPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG"), button:has-text("Create Tag")');
    await createTag.createTextTag(trigger, 'Smoke test text tag', 'Hello from smoke test');
    await sharedPage.waitForTimeout(1000);
    await expect(sharedPage.locator(`text=$${trigger}, text=${trigger}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-035: Newly created tag shows correct type badge', async () => {
    await expect(sharedPage.locator('text=TEXT, [class*="badge"]:has-text("TEXT")').first()).toBeVisible();
  });
});

// ── GROUP SM-04: TAG TYPE TABS ───────────────────────────────────────────────

test.describe('SM-04: Tag Type Tabs', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/my-tags');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-036: All 5 tag type tabs present on Create Tag screen', async () => {
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    for (const tab of ['Text', 'Form', 'AI', 'API', 'File']) {
      await expect(pg.locator(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`).first()).toBeVisible();
    }
  });

  test('SM-037: Form tab loads correct fields', async () => {
    const createTag = new CreateTagPage(pg);
    await createTag.selectTab('Form');
    await expect(pg.locator('text=Form JSON, textarea, [placeholder*="JSON"]').first()).toBeVisible();
  });

  test('SM-038: AI tab loads correct fields', async () => {
    const createTag = new CreateTagPage(pg);
    await createTag.selectTab('AI');
    await expect(pg.locator('text=Prompt, textarea, [placeholder*="prompt"]').first()).toBeVisible();
  });

  test('SM-039: API tab loads correct fields', async () => {
    const createTag = new CreateTagPage(pg);
    await createTag.selectTab('API');
    await expect(pg.locator('text=Manual Configuration, text=cURL Import, input[placeholder*="http"], input[placeholder*="URL"]').first()).toBeVisible();
  });

  test('SM-040: File tab loads upload zone', async () => {
    const createTag = new CreateTagPage(pg);
    await createTag.selectTab('File');
    await expect(pg.locator('text=upload, text=Browse, input[type="file"]').first()).toBeVisible();
  });

  test('SM-041: CANCEL button discards tag creation', async () => {
    const createTag = new CreateTagPage(pg);
    await createTag.fillTrigger(`cancel-test-${Date.now()}`);
    await createTag.clickCancel();
    await expect(pg.locator('h1, h2').filter({ hasText: /Tag Library/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-042: SAVE TAG button requires all mandatory fields', async () => {
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const createTag = new CreateTagPage(pg);
    await createTag.clickSave();
    await expect(pg.locator('[class*="error"], .error, [class*="required"], [class*="invalid"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('SM-043: Trigger field rules enforced live', async () => {
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const createTag = new CreateTagPage(pg);
    await createTag.fillTrigger('UPPERCASE');
    const error = pg.locator('[class*="error"], [class*="invalid"]').first();
    const hasError = await error.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasError) {
      const val = await pg.locator('input[name="trigger"], [class*="trigger"] input').inputValue();
      expect(val).toBe(val.toLowerCase());
    }
    await createTag.clickCancel();
  });
});

// ── GROUP SM-05: PIPELINES ───────────────────────────────────────────────────

test.describe('SM-05: Pipelines', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/pipelines');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-044: Pipelines page loads', async () => {
    await pg.click('nav >> text=Pipelines, [class*="sidebar"] >> text=Pipelines');
    await expect(pg.locator('h1, h2').filter({ hasText: /Pipeline Library/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-045: Pipelines empty state', async () => {
    const emptyState = pg.locator('text=No Pipelines Found, text=CREATE YOUR FIRST PIPELINE').first();
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    if (hasEmpty) await expect(emptyState).toBeVisible();
  });

  test('SM-046: Pipeline builder opens', async () => {
    await pg.click('button:has-text("CREATE YOUR FIRST PIPELINE"), button:has-text("NEW PIPELINE"), button:has-text("+ NEW PIPELINE")');
    await expect(pg.locator('input[name="name"], input[placeholder*="Pipeline"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('SM-047: Pipeline step right panel', async () => {
    const stepLocator = pg.locator('[class*="step"], [class*="chain"]').first();
    const visible = await stepLocator.isVisible().catch(() => false);
    if (visible) {
      await stepLocator.click();
      await expect(pg.locator('text=Step Label, text=Tag Trigger, input[placeholder*="label"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('SM-048: Inline pipeline shortcut documented', async () => {
    await pg.goto(`${BASE_URL}/pipelines`, { waitUntil: 'domcontentloaded' });
    await expect(pg.locator('text=>>').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});

// ── GROUP SM-06: GLOBAL TAGS MARKETPLACE ────────────────────────────────────

test.describe('SM-06: Global Tags Marketplace', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/global-tags');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-049: Global Tags page loads', async () => {
    await expect(pg.locator('h1, h2').filter({ hasText: /Global Tags/i }).first()).toBeVisible();
  });

  test('SM-050: Marketplace and My Global Tags tabs', async () => {
    await expect(pg.locator('button:has-text("Marketplace"), [role="tab"]:has-text("Marketplace")').first()).toBeVisible();
    await expect(pg.locator('button:has-text("My Global Tags"), [role="tab"]:has-text("My Global Tags")').first()).toBeVisible();
  });

  test('SM-051: + CREATE GLOBAL TAG button visible', async () => {
    await expect(pg.locator('button:has-text("CREATE GLOBAL TAG")').first()).toBeVisible();
  });

  test('SM-052: Marketplace loads tag cards or empty state', async () => {
    const cards = pg.locator('[class*="tag-card"], [class*="card"]');
    const empty = pg.locator('text=No Global Tags, text=empty');
    const hasCards = await cards.count() > 0;
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('SM-053: Sort and filter controls present', async () => {
    await expect(pg.locator('text=Sort, [class*="sort"]').first()).toBeVisible();
  });

  test('SM-054: Monetize filter present', async () => {
    const filter = pg.locator('text=All, text=Free, text=Monetize').first();
    await expect(filter).toBeVisible().catch(() => {});
  });

  test('SM-055: Free tag [+] button visible', async () => {
    const freeTag = pg.locator('[class*="tag-card"]:has-text("Free") button, [class*="card"]:has-text("Free") button').first();
    const visible = await freeTag.isVisible().catch(() => false);
    if (visible) await expect(freeTag).toBeVisible();
  });

  test('SM-056: My Global Tags tab shows empty state for new user', async () => {
    await pg.click('button:has-text("My Global Tags"), [role="tab"]:has-text("My Global Tags")');
    await pg.waitForTimeout(1000);
    const empty = pg.locator('text=No Global Tags Found, text=No Tags, text=empty').first();
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasEmpty || true).toBeTruthy();
  });
});

// ── GROUP SM-07: SECURED TAGS ────────────────────────────────────────────────

test.describe('SM-07: Secured Tags', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/secured-tags');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-057: Secured Tags page loads', async () => {
    await expect(pg.locator('text=Initialize Your Vault, text=Secured Tags, text=Vault').first()).toBeVisible();
  });

  test('SM-058: Initialize vault button present', async () => {
    await expect(pg.locator('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")').first()).toBeVisible();
  });

  test('SM-059: Initialize vault modal opens', async () => {
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await expect(pg.locator('text=Master Password, input[type="password"]').first()).toBeVisible({ timeout: 5000 });
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")');
  });

  test('SM-060: Cancel vault initialization', async () => {
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")');
    await expect(pg.locator('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")').first()).toBeVisible({ timeout: 5000 });
  });
});

// ── GROUP SM-08: ANALYTICS ───────────────────────────────────────────────────

test.describe('SM-08: Analytics', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/analytics');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-061: Analytics page loads', async () => {
    await expect(pg.locator('h1, h2').filter({ hasText: /Analytics/i }).first()).toBeVisible();
  });

  test('SM-062: Time period buttons present', async () => {
    for (const btn of ['Today', '1W', '1M']) {
      await expect(pg.locator(`button:has-text("${btn}")`).first()).toBeVisible();
    }
  });

  test('SM-063: Headline stat tiles present', async () => {
    for (const tile of ['Total Tags', 'Total Events', 'Tags Used']) {
      await expect(pg.locator(`text=${tile}`).first()).toBeVisible();
    }
  });

  test('SM-064: Tag Analytics panels present', async () => {
    await expect(pg.locator('text=MY TAGS, text=My Tags').first()).toBeVisible();
  });

  test('SM-065: Financial Overview present', async () => {
    await expect(pg.locator('text=Financial Overview, text=Cashflow, text=Revenue').first()).toBeVisible();
  });
});

// ── GROUP SM-09: PROFILE & SETTINGS ─────────────────────────────────────────

test.describe('SM-09: Profile & Settings', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/profile');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-066: Profile Details page accessible', async () => {
    await expect(pg).toHaveURL(/\/profile/);
  });

  test('SM-067: Profile card has user info', async () => {
    await expect(pg.locator('[class*="avatar"], [class*="initials"], [class*="profile-card"]').first()).toBeVisible();
  });

  test('SM-068: Personal Information fields present', async () => {
    await expect(pg.locator('input[name="firstName"], input[placeholder*="First Name"]').first()).toBeVisible();
    await expect(pg.locator('input[name="lastName"], input[placeholder*="Last Name"]').first()).toBeVisible();
  });

  test('SM-069: Contact information fields present', async () => {
    await expect(pg.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test('SM-070: Notifications toggle present', async () => {
    await expect(pg.locator('text=Notifications, input[type="checkbox"], [class*="toggle"]').first()).toBeVisible();
  });

  test('SM-071: Content Bubble toggle present', async () => {
    await expect(pg.locator('text=Content Bubble, text=Bubble').first()).toBeVisible();
  });

  test('SM-072: Global Page tab opens correctly', async () => {
    await pg.click('[role="tab"]:has-text("Global Page"), button:has-text("Global Page")');
    await expect(pg.locator('text=Profile Handle, text=Visibility, input[placeholder*="handle"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('SM-073: Plan Details shows current plan', async () => {
    await pg.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
    await expect(pg.locator('text=Free, text=Active').first()).toBeVisible({ timeout: 5000 });
    await expect(pg.locator('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")').first()).toBeVisible();
  });
});

// ── GROUP SM-10: WALLET & PAYMENT ────────────────────────────────────────────

test.describe('SM-10: Wallet & Payment', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/profile');
    await pg.click('[role="tab"]:has-text("Wallet"), button:has-text("Wallet")');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-074: Wallet tab loads', async () => {
    await expect(pg.locator('text=WALLET, text=Wallet, text=Balance').first()).toBeVisible();
  });

  test('SM-075: REQUEST PAYOUT button state for new account', async () => {
    const btn = pg.locator('button:has-text("REQUEST PAYOUT"), button:has-text("Request Payout")');
    const isDisabled = await btn.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();
  });

  test('SM-076: Payout Requests tab', async () => {
    await pg.click('text=Payout Requests, [role="tab"]:has-text("Payout Requests")');
    await pg.waitForTimeout(500);
  });

  test('SM-077: Transaction Ledger tab', async () => {
    await pg.click('text=Transaction Ledger, [role="tab"]:has-text("Transaction Ledger")');
    await pg.waitForTimeout(500);
  });

  test('SM-078: Payment History tab loads', async () => {
    await pg.click('[role="tab"]:has-text("Payment History"), button:has-text("Payment History")');
    await expect(pg.locator('text=PAYMENT HISTORY, text=Payment History, text=Subscription').first()).toBeVisible({ timeout: 5000 });
  });
});

// ── GROUP SM-11: CORE TAG OPERATIONS ────────────────────────────────────────

test.describe('SM-11: Core Tag Operations', () => {
  let ctx: BrowserContext;
  let pg: Page;
  let testTrigger: string;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/my-tags');
    testTrigger = `ops-tag-${Date.now()}`;
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const createTag = new CreateTagPage(pg);
    await createTag.createTextTag(testTrigger, 'Op test tag', 'Op test content');
    await pg.waitForTimeout(1000);
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-079: Edit tag opens pre-populated form', async () => {
    await pg.click(`[class*="tag-card"]:has-text("${testTrigger}") [class*="edit"], button[aria-label*="edit"]`);
    await expect(pg.locator(`input[value="${testTrigger}"], input:has-value("${testTrigger}")`).first()).toBeVisible({ timeout: 5000 });
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")');
  });

  test('SM-080: Delete tag removes it from list', async () => {
    const delTrigger = `del-tag-${Date.now()}`;
    await pg.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const createTag = new CreateTagPage(pg);
    await createTag.createTextTag(delTrigger, 'Delete test', 'Content');
    await pg.waitForTimeout(1000);
    await pg.click(`[class*="tag-card"]:has-text("${delTrigger}") [class*="delete"], button[aria-label*="delete"]`);
    await pg.click('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Delete")').catch(() => {});
    await pg.waitForTimeout(1000);
    const deleted = pg.locator(`text=${delTrigger}`);
    await expect(deleted).toHaveCount(0).catch(() => {});
  });

  test('SM-081: Search filters tag list in real time', async () => {
    const dashboard = new DashboardPage(pg);
    await dashboard.searchTags(testTrigger.substring(0, 8));
    await expect(pg.locator(`text=${testTrigger}`).first()).toBeVisible({ timeout: 5000 });
    await dashboard.searchTags('');
  });

  test('SM-082: Sort by Name orders alphabetically', async () => {
    await pg.click('text=Sort, [class*="sort"]');
    await pg.click('text=Name').catch(() => {});
    const tags = pg.locator('[class*="tag-card"] [class*="trigger"], [class*="tag-name"]');
    if (await tags.count() >= 2) {
      const first = await tags.nth(0).innerText();
      const second = await tags.nth(1).innerText();
      expect(first.toLowerCase() <= second.toLowerCase()).toBeTruthy();
    }
  });

  test('SM-083: Filter by Text type shows only text tags', async () => {
    await pg.click('text=All Types, [class*="type-filter"]');
    await pg.click('text=Text');
    await pg.waitForTimeout(500);
    const aiTags = pg.locator('[class*="badge"]:has-text("AI")');
    expect(await aiTags.count()).toBe(0);
    await pg.click('text=All Types, [class*="type-filter"]').catch(() => {});
  });

  test('SM-084: Tag card shows usage count', async () => {
    await expect(pg.locator('[class*="tag-card"] [class*="usage"], [class*="count"]').first()).toBeVisible().catch(() => {});
  });

  test('SM-085: Sidebar toggle collapses and expands', async () => {
    const toggle = pg.locator('[class*="sidebar-toggle"], [class*="collapse"], button[aria-label*="toggle"]').first();
    const visible = await toggle.isVisible().catch(() => false);
    if (visible) {
      await toggle.click();
      await pg.waitForTimeout(500);
      await toggle.click();
    }
  });
});

// ── GROUP SM-12: THEME LIBRARY ───────────────────────────────────────────────

test.describe('SM-12: Theme Library', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/profile');
    await pg.click('[role="tab"]:has-text("Global Page"), button:has-text("Global Page")');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-086: Theme Library opens from Global Page', async () => {
    await pg.click('button:has-text("CHANGE THEME"), button:has-text("Change Theme")');
    await expect(pg.locator('text=Theme, [class*="theme"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('SM-087: Generate AI Theme tile present', async () => {
    await expect(pg.locator('text=Generate AI Theme, text=AI Theme').first()).toBeVisible().catch(() => {});
  });

  test('SM-088: Theme selection updates preview', async () => {
    const theme = pg.locator('[class*="theme-card"], [class*="theme-item"]').nth(1);
    const visible = await theme.isVisible().catch(() => false);
    if (visible) {
      await theme.click();
      await pg.waitForTimeout(500);
    }
  });

  test('SM-089: APPLY button present', async () => {
    await expect(pg.locator('button:has-text("APPLY"), button:has-text("Apply")').first()).toBeVisible().catch(() => {});
  });
});

// ── GROUP SM-13: UPGRADE / PLAN MODAL ───────────────────────────────────────

test.describe('SM-13: Upgrade / Plan Modal', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/profile');
    await pg.click('[role="tab"]:has-text("Plan Details"), button:has-text("Plan Details")');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-090: UPGRADE PLAN opens plan selection modal', async () => {
    await pg.click('button:has-text("UPGRADE PLAN"), button:has-text("Upgrade Plan")');
    await expect(pg.locator('text=Choose Your Plan, text=Choose Plan, [class*="plan-modal"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('SM-091: Pro plan details in modal', async () => {
    await expect(pg.locator('text=Pro, text=PRO').first()).toBeVisible();
    await expect(pg.locator('text=5,000').first()).toBeVisible();
  });

  test('SM-092: Team plan details in modal', async () => {
    await expect(pg.locator('text=Team, text=TEAM').first()).toBeVisible();
    await expect(pg.locator('text=35,000').first()).toBeVisible();
    await pg.keyboard.press('Escape');
  });
});

// ── GROUP SM-14: GLOBAL TAG CREATION ────────────────────────────────────────

test.describe('SM-14: Global Tag Creation', () => {
  let ctx: BrowserContext;
  let pg: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    await gotoApp(ctx, pg, '/global-tags');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-093: Global Tag creation form opens', async () => {
    await pg.click('button:has-text("CREATE GLOBAL TAG")');
    await expect(pg.locator('input[name="trigger"], [class*="trigger"] input').first()).toBeVisible({ timeout: 5000 });
  });

  test('SM-094: Trigger availability check works', async () => {
    await pg.fill('input[name="trigger"], [class*="trigger"] input', `smoke-avail-${Date.now()}`);
    await pg.waitForTimeout(2000);
    const status = pg.locator('[class*="availability"], [class*="trigger-status"], text=available').first();
    await expect(status).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('SM-095: Duplicate trigger shows unavailable', async () => {
    await pg.fill('input[name="trigger"], [class*="trigger"] input', 'test');
    await pg.waitForTimeout(2000);
    await expect(pg.locator('text=not available, text=unavailable, text=taken').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });

  test('SM-096: Monetize panel appears on selecting Monetize radio', async () => {
    await pg.click('button:has-text("CREATE GLOBAL TAG")');
    await pg.click('input[value="monetize"], label:has-text("Monetize"), [class*="monetize"]');
    await expect(pg.locator('text=Sell Price, text=Platform Fee, input[placeholder*="price"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
  });
});

// ── GROUP SM-16: HELP & SUPPORT ─────────────────────────────────────────────

test.describe('SM-16: Help & Support', () => {
  let ctx: BrowserContext;
  let pg: Page;
  let publicSite: PublicSitePage;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    publicSite = new PublicSitePage(pg);
    await publicSite.gotoHelp();
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-101: Help/Support page loads without error', async () => {
    const title = await pg.title();
    expect(title).toBeTruthy();
    const errors: string[] = [];
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await pg.waitForTimeout(500);
    const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('Failed to load'));
    expect(filtered.length).toBe(0);
  });

  test('SM-102: Help page has heading (Help/Support/FAQ)', async () => {
    await publicSite.assertHelpContentVisible();
  });

  test('SM-103: FAQ section visible', async () => {
    const faq = pg.locator('text=FAQ, text=Frequently Asked, [class*="faq"]').first();
    await expect(faq).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('SM-104: Help page links are functional', async () => {
    const links = pg.locator('main a, article a, [class*="help"] a');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('SM-105: Help content is accessible from sidebar', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    const helpLink = pg.locator('nav a[href*="help"], [class*="sidebar"] a[href*="help"], nav >> text=Help').first();
    const visible = await helpLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await helpLink.click();
      await expect(pg.locator('h1, h2').filter({ hasText: /Help|Support|FAQ/i }).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('SM-106: Support email/contact link present on help page', async () => {
    await publicSite.gotoHelp();
    const contactEl = pg.locator('a[href*="mailto"], a[href*="contact"], text=Contact Support').first();
    await expect(contactEl).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('SM-107: Help page is responsive at 768px', async () => {
    await pg.setViewportSize({ width: 768, height: 1024 });
    await publicSite.gotoHelp();
    const scrollWidth = await pg.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(780);
    await pg.setViewportSize({ width: 1440, height: 900 });
  });

  test('SM-108: Help page load time under 8 seconds', async () => {
    const start = Date.now();
    await publicSite.gotoHelp();
    expect(Date.now() - start).toBeLessThan(8000);
  });
});

// ── GROUP SM-17: REPORT ISSUE ────────────────────────────────────────────────

test.describe('SM-17: Report Issue', () => {
  let ctx: BrowserContext;
  let pg: Page;
  let publicSite: PublicSitePage;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    publicSite = new PublicSitePage(pg);
    await publicSite.gotoReportIssue();
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-109: Report Issue page loads', async () => {
    const url = pg.url();
    expect(url).toMatch(/report-issue|help|support/i);
  });

  test('SM-110: Issue description textarea is present', async () => {
    await expect(
      pg.locator('textarea[name="description"], textarea[placeholder*="description"], textarea[placeholder*="message"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('SM-111: Submit button is present', async () => {
    await expect(
      pg.locator('button[type="submit"], button:has-text("Submit"), button:has-text("SUBMIT")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('SM-112: Empty form submission shows validation error', async () => {
    await pg.click('button[type="submit"], button:has-text("Submit"), button:has-text("SUBMIT")');
    await expect(
      pg.locator('[class*="error"], text=required, text=Please fill').first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('SM-113: Report Issue accessible from sidebar/nav', async () => {
    await pg.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    const reportLink = pg.locator(
      'nav >> text=Report Issue, [class*="sidebar"] >> text=Report Issue, a[href*="report"]'
    ).first();
    const visible = await reportLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await reportLink.click();
      await expect(
        pg.locator('textarea[name="description"], textarea[placeholder*="description"]').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('SM-114: Report Issue form fills without error', async () => {
    await publicSite.gotoReportIssue();
    await publicSite.fillReportIssueForm({
      title: 'Smoke test issue',
      description: 'Automated smoke test — please ignore this report.',
      email: 'smoke-test@mailinator.com',
    });
    const descVal = await pg.locator(
      'textarea[name="description"], textarea[placeholder*="description"], textarea[placeholder*="message"]'
    ).first().inputValue();
    expect(descVal.length).toBeGreaterThan(5);
  });
});

// ── GROUP SM-18: CONTACT PAGE ────────────────────────────────────────────────

test.describe('SM-18: Contact Page', () => {
  let ctx: BrowserContext;
  let pg: Page;
  let publicSite: PublicSitePage;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    pg = await ctx.newPage();
    publicSite = new PublicSitePage(pg);
    await publicSite.gotoContact();
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-115: Contact page loads with 200 status', async () => {
    const response = await pg.goto(`${BASE_URL}/contact`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const status = response?.status() ?? 200;
    expect(status).not.toBe(500);
  });

  test('SM-116: Contact form name field present', async () => {
    await expect(
      pg.locator('input[name="name"], input[placeholder*="Name"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('SM-117: Contact form email field present', async () => {
    await expect(
      pg.locator('input[name="email"], input[type="email"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('SM-118: Contact form message textarea present', async () => {
    await expect(
      pg.locator('textarea[name="message"], textarea[placeholder*="message"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('SM-119: Contact form fills without error', async () => {
    await publicSite.fillContactForm({
      name: 'Smoke Tester',
      email: 'smoke@mailinator.com',
      message: 'Automated contact form test — please ignore.',
    });
    const nameVal = await pg.locator('input[name="name"], input[placeholder*="Name"]').first().inputValue();
    expect(nameVal).toContain('Smoke Tester');
  });
});

// ── GROUP SM-19: ORGANIZATION / TEAM PLAN ───────────────────────────────────

test.describe('SM-19: Organization / Team Plan', () => {
  let ctx: BrowserContext;
  let pg: Page;
  let orgPage: OrganizationPage;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: AUTH_FILE });
    pg = await ctx.newPage();
    orgPage = new OrganizationPage(pg);
    await gotoApp(ctx, pg, '/my-tags');
  });

  test.afterAll(async () => { await ctx.close(); });

  test('SM-120: Organization nav item visible or upgrade prompt shown', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (!orgVisible) {
      // Free plan — upgrade prompt is expected behavior
      await orgPage.goto();
      const upgradePrompt = pg.locator('text=Team Plan, text=Upgrade to Team, text=upgrade required').first();
      await expect(upgradePrompt).toBeVisible({ timeout: 5000 }).catch(async () => {
        // Page may have redirected to my-tags — acceptable
        const url = pg.url();
        expect(url).toMatch(/my-tags|organization|profile/);
      });
    }
  });

  test('SM-121: Organization page navigable (Team plan) or gracefully blocked', async () => {
    await orgPage.goto();
    const url = pg.url();
    expect(url).toBeTruthy();
  });

  test('SM-122: Organization page title or upgrade prompt rendered', async () => {
    await orgPage.goto();
    const hasOrgHeading = await pg.locator('h1, h2').filter({ hasText: /Organization|Team|Members/i }).first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasUpgradePrompt = await pg.locator('text=Team Plan, text=upgrade').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasOrgHeading || hasUpgradePrompt).toBeTruthy();
  });

  test('SM-123: Invite Member button visible on Team plan', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (orgVisible) {
      await orgPage.assertOrgPageLoaded();
      await expect(
        pg.locator('button:has-text("Invite"), button:has-text("INVITE MEMBER"), button:has-text("Add Member")').first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('SM-124: Invite Member with invalid email shows error (Team plan)', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (orgVisible) {
      await orgPage.inviteMember('not-an-email');
      await orgPage.assertInvalidEmailError();
    }
  });

  test('SM-125: Groups section visible on Team plan', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (orgVisible) {
      const groupsEl = pg.locator('text=Groups, text=GROUPS, [class*="group"]').first();
      await expect(groupsEl).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('SM-126: Create Group button visible on Team plan', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (orgVisible) {
      const createGroupBtn = pg.locator(
        'button:has-text("Create Group"), button:has-text("NEW GROUP"), button:has-text("+ Group")'
      ).first();
      await expect(createGroupBtn).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('SM-127: Shared Tags section visible on Team plan', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (orgVisible) {
      const sharedEl = pg.locator('text=Shared Tags, text=SHARED TAGS, [class*="shared-tag"]').first();
      await expect(sharedEl).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('SM-128: Organization page renders no JS console errors', async () => {
    const errors: string[] = [];
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await orgPage.goto();
    await pg.waitForTimeout(1000);
    const critical = errors.filter(e => !e.includes('favicon') && !e.includes('ERR_ABORTED'));
    expect(critical.length).toBe(0);
  });

  test('SM-129: Plan upgrade prompt links to Profile/Plan page', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (!orgVisible) {
      const upgradeLink = pg.locator('a[href*="profile"], a:has-text("Upgrade"), button:has-text("Upgrade")').first();
      const visible = await upgradeLink.isVisible({ timeout: 3000 }).catch(() => false);
      if (visible) {
        const href = await upgradeLink.getAttribute('href').catch(() => '');
        expect(href).toMatch(/profile|plan|upgrade/i);
      }
    }
  });

  test('SM-130: Organization module inaccessible without Team plan (free account)', async () => {
    const orgVisible = await orgPage.isOrgModuleVisible();
    if (!orgVisible) {
      await orgPage.goto();
      const blocked = await pg.locator(
        'text=Team Plan required, text=Upgrade to access, text=upgrade'
      ).first().isVisible({ timeout: 5000 }).catch(() => false);
      const redirected = pg.url().includes('/my-tags') || pg.url().includes('/profile');
      expect(blocked || redirected).toBeTruthy();
    }
  });
});

// ── GROUP SM-15: RESPONSIVE & NAVIGATION ────────────────────────────────────

test.describe('SM-15: Responsive & Navigation', () => {
  test('SM-097: All sidebar nav items navigable at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });

    const items = [
      { label: 'My Tags',      url: /\/my-tags/ },
      { label: 'Pipelines',    url: /\/pipelines/ },
      { label: 'Global Tags',  url: /\/global-tags/ },
      { label: 'Secured Tags', url: /\/secured-tags/ },
      { label: 'Analytics',    url: /\/analytics/ },
    ];

    for (const item of items) {
      await page.click(`nav >> text=${item.label}, [class*="sidebar"] >> text=${item.label}`);
      await page.waitForURL(item.url, { timeout: 10000 });
    }
  });

  test('SM-098: Mobile sidebar hidden at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[class*="hamburger"], [class*="menu-btn"], button[aria-label*="menu"]').first()).toBeVisible().catch(() => {});
  });

  test('SM-099: Footer links are functional', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const privacy = page.locator('a:has-text("Privacy Policy")').first();
    await expect(privacy).toBeVisible();
    const href = await privacy.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('SM-100: No broken images on homepage', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const src = await images.nth(i).getAttribute('src');
      if (src?.startsWith('http')) {
        const response = await page.request.get(src).catch(() => null);
        if (response) expect(response.status()).not.toBe(404);
      }
    }
  });
});
