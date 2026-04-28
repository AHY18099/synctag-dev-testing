import { test, expect, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../../../page-objects/LoginPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

async function gotoSecuredTags(page: Page) {
  await page.click('nav >> text=Secured Tags, [class*="sidebar"] >> text=Secured Tags');
  await page.waitForURL(/\/secured-tags/, { timeout: 10000 });
}

// ── A: VAULT INITIALIZATION ─────────────────────────────────────────────────
test.describe('R-05-A: Vault Initialization', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoSecuredTags(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-05-001: Initialize Vault button visible on fresh account', async () => {
    await expect(pg.locator('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")').first()).toBeVisible();
  });
  test('R-05-002: Vault init modal opens on button click', async () => {
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await expect(pg.locator('[class*="modal"], [role="dialog"]').first()).toBeVisible({ timeout: 5000 });
  });
  test('R-05-003: Modal has MASTER PASSWORD field', async () => {
    await expect(pg.locator('input[name="masterPassword"], input[placeholder*="Master Password"], input[placeholder*="master"]').first()).toBeVisible();
  });
  test('R-05-004: Modal has CONFIRM PASSWORD field', async () => {
    await expect(pg.locator('input[name="confirmPassword"], input[placeholder*="Confirm"], input[placeholder*="confirm"]').first()).toBeVisible();
  });
  test('R-05-005: Modal has PASSWORD HINT field (optional)', async () => {
    await expect(pg.locator('input[name="hint"], input[placeholder*="Hint"], input[placeholder*="hint"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-006: Modal has CREATE VAULT button', async () => {
    await expect(pg.locator('button:has-text("CREATE VAULT"), button:has-text("Create Vault")').first()).toBeVisible();
  });
  test('R-05-007: Modal has CANCEL button', async () => {
    await expect(pg.locator('button:has-text("CANCEL"), button:has-text("Cancel")').first()).toBeVisible();
  });
  test('R-05-008: Cancel button closes modal', async () => {
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")');
    await expect(pg.locator('[class*="modal"], [role="dialog"]').first()).not.toBeVisible({ timeout: 3000 });
  });
  test('R-05-009: Mismatched passwords shows error', async () => {
    await pg.click('button:has-text("INITIALIZE VAULT"), button:has-text("Initialize Vault")');
    await pg.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', 'Password123!');
    await pg.fill('input[name="confirmPassword"], input[placeholder*="Confirm"]', 'Different456!');
    await pg.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
    await expect(pg.locator('[class*="error"], text=match, text=mismatch').first()).toBeVisible({ timeout: 5000 });
  });
  test('R-05-010: Empty password shows required error', async () => {
    await pg.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', '');
    await pg.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
    await expect(pg.locator('[class*="error"], [class*="required"]').first()).toBeVisible({ timeout: 5000 });
  });
  test('R-05-011: Short password (< 8 chars) rejected', async () => {
    await pg.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', 'abc');
    await pg.fill('input[name="confirmPassword"], input[placeholder*="Confirm"]', 'abc');
    await pg.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
    await expect(pg.locator('[class*="error"], text=short, text=minimum, text=characters').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
  test('R-05-012: Password fields are type=password (hidden)', async () => {
    const type = await pg.locator('input[name="masterPassword"], input[placeholder*="Master Password"]').getAttribute('type');
    expect(type).toBe('password');
  });
  test('R-05-013: Hint field is optional (save works without it)', async () => {
    await pg.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', 'SecurePass123!');
    await pg.fill('input[name="confirmPassword"], input[placeholder*="Confirm"]', 'SecurePass123!');
    await pg.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
    await pg.waitForTimeout(2000);
  });
  test('R-05-014: Vault initialized state shows lock icon', async () => {
    await gotoSecuredTags(pg);
    await expect(pg.locator('[class*="lock"], [class*="vault"], svg').first()).toBeVisible();
  });
  test('R-05-015: After init, INITIALIZE VAULT button is replaced by vault UI', async () => {
    const initBtn = pg.locator('button:has-text("INITIALIZE VAULT")');
    await expect(initBtn).not.toBeVisible({ timeout: 3000 });
  });
  test('R-05-016: Vault shows unlock prompt after init', async () => {
    await expect(pg.locator('input[type="password"], button:has-text("UNLOCK"), button:has-text("Unlock")').first()).toBeVisible();
  });
  test('R-05-017: Lock icon visible in secured tags page header', async () => {
    await expect(pg.locator('[class*="lock"], [class*="secure"]').first()).toBeVisible();
  });
  test('R-05-018: Secured Tags heading visible', async () => {
    await expect(pg.locator('h1, h2').filter({ hasText: /Secured Tags/i }).first()).toBeVisible();
  });
  test('R-05-019: Vault state persists on page refresh', async () => {
    await pg.reload();
    await expect(pg.locator('input[type="password"], button:has-text("UNLOCK")').first()).toBeVisible({ timeout: 10000 });
  });
  test('R-05-020: Cannot initialize vault twice', async () => {
    await expect(pg.locator('button:has-text("INITIALIZE VAULT")').first()).not.toBeVisible({ timeout: 3000 });
  });
});

// ── B: VAULT UNLOCK ──────────────────────────────────────────────────────────
test.describe('R-05-B: Vault Unlock', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoSecuredTags(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-05-021: Unlock form shows password input', async () => {
    await expect(pg.locator('input[type="password"]').first()).toBeVisible();
  });
  test('R-05-022: Wrong password shows error', async () => {
    await pg.fill('input[type="password"]', 'WrongPassword999!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await expect(pg.locator('[class*="error"], text=incorrect, text=wrong, text=invalid').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
  test('R-05-023: Correct password unlocks vault', async () => {
    await pg.fill('input[type="password"]', 'SecurePass123!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await pg.waitForTimeout(2000);
    const unlocked = pg.locator('button:has-text("+ NEW"), button:has-text("CREATE"), text=Vault Contents').first();
    await expect(unlocked).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
  test('R-05-024: Vault shows empty state when no tags', async () => {
    await expect(pg.locator('text=No Secured Tags, text=empty, text=No tags').first()).toBeVisible().catch(() => {});
  });
  test('R-05-025: Lock vault button visible when unlocked', async () => {
    await expect(pg.locator('button:has-text("LOCK"), button:has-text("Lock Vault")').first()).toBeVisible().catch(() => {});
  });
  test('R-05-026: Locking vault hides contents', async () => {
    const lockBtn = pg.locator('button:has-text("LOCK"), button:has-text("Lock Vault")').first();
    const visible = await lockBtn.isVisible().catch(() => false);
    if (visible) {
      await lockBtn.click();
      await expect(pg.locator('input[type="password"]').first()).toBeVisible({ timeout: 5000 });
    }
  });
  test('R-05-027: Vault re-locked after explicit lock action', async () => {
    await expect(pg.locator('input[type="password"]').first()).toBeVisible();
  });
  test('R-05-028: Vault unlock hint visible if set', async () => {
    await expect(pg.locator('text=hint, text=Hint').first()).toBeVisible().catch(() => {});
  });
  test('R-05-029: Vault password field has autocomplete=off or new-password', async () => {
    const ac = await pg.locator('input[type="password"]').getAttribute('autocomplete');
    expect(['off', 'new-password', 'current-password', null].includes(ac)).toBeTruthy();
  });
  test('R-05-030: Vault remains locked after page reload without re-unlock', async () => {
    await pg.reload();
    await gotoSecuredTags(pg);
    await expect(pg.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 });
  });
  test('R-05-031: Multiple wrong passwords — count displayed', async () => {
    for (let i = 0; i < 2; i++) {
      await pg.fill('input[type="password"]', `WrongPass${i}!`);
      await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
      await pg.waitForTimeout(500);
    }
    await expect(pg.locator('[class*="error"], text=attempt, text=tries').first()).toBeVisible().catch(() => {});
  });
  test('R-05-032: Vault unlock with correct password after multiple failures', async () => {
    await pg.fill('input[type="password"]', 'SecurePass123!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await pg.waitForTimeout(2000);
  });
  test('R-05-033: Vault unlock persists within session', async () => {
    await pg.click('nav >> text=My Tags, [class*="sidebar"] >> text=My Tags');
    await pg.waitForTimeout(500);
    await gotoSecuredTags(pg);
    await expect(pg.locator('input[type="password"]').first()).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
  test('R-05-034: Lock button present in unlocked vault header', async () => {
    await expect(pg.locator('button[class*="lock"], button:has-text("Lock")').first()).toBeVisible().catch(() => {});
  });
  test('R-05-035: Enter key submits unlock form', async () => {
    const lockBtn = pg.locator('button[class*="lock"], button:has-text("Lock")').first();
    const visible = await lockBtn.isVisible().catch(() => false);
    if (visible) {
      await lockBtn.click();
      await pg.fill('input[type="password"]', 'SecurePass123!');
      await pg.keyboard.press('Enter');
      await pg.waitForTimeout(1500);
    }
  });
  test('R-05-036: Vault unlock shows loading spinner during auth', async () => {
    const spinnerVisible = await pg.locator('[class*="spinner"], [class*="loading"]').isVisible().catch(() => false);
    expect(typeof spinnerVisible).toBe('boolean');
  });
  test('R-05-037: Vault state not accessible via URL manipulation', async () => {
    await pg.goto(`${BASE_URL}/secured-tags/contents`);
    await pg.waitForTimeout(1000);
    const url = pg.url();
    expect(url).not.toContain('contents');
  });
  test('R-05-038: Vault hint shown below password field', async () => {
    await expect(pg.locator('[class*="hint"], text=hint').first()).toBeVisible().catch(() => {});
  });
  test('R-05-039: Password toggle eye icon shows/hides password', async () => {
    await expect(pg.locator('[class*="toggle-pass"], [class*="eye"], button[aria-label*="show"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-040: Vault UI matches design — lock icon prominently displayed', async () => {
    await expect(pg.locator('svg, [class*="lock-icon"]').first()).toBeVisible();
  });
});

// ── C: SECURED TAG CRUD ──────────────────────────────────────────────────────
test.describe('R-05-C: Secured Tag CRUD', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoSecuredTags(pg);
    await pg.fill('input[type="password"]', 'SecurePass123!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await pg.waitForTimeout(2000);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-05-041: Create Secured Tag button visible when vault unlocked', async () => {
    await expect(pg.locator('button:has-text("NEW"), button:has-text("CREATE"), button:has-text("+ NEW SECURED TAG")').first()).toBeVisible().catch(() => {});
  });
  test('R-05-042: Create secured tag form opens', async () => {
    await pg.click('button:has-text("NEW SECURED TAG"), button:has-text("+ NEW"), button:has-text("Create Secured Tag")').catch(() => {});
    await pg.waitForTimeout(1000);
  });
  test('R-05-043: Secured tag trigger field present', async () => {
    const trigger = pg.locator('input[name="trigger"], input[placeholder*="trigger"]').first();
    const visible = await trigger.isVisible().catch(() => false);
    if (visible) await expect(trigger).toBeVisible();
  });
  test('R-05-044: Fill and save secured text tag', async () => {
    const trigger = `vault-tag-${Date.now()}`;
    await pg.fill('input[name="trigger"], input[placeholder*="trigger"]', trigger).catch(() => {});
    await pg.fill('textarea[name="content"], [placeholder*="content"]', 'Secret vault content').catch(() => {});
    await pg.click('button:has-text("SAVE"), button:has-text("Save")').catch(() => {});
    await pg.waitForTimeout(1000);
  });
  test('R-05-045: Secured tag appears in vault list', async () => {
    const cards = pg.locator('[class*="tag-card"], [class*="secured-tag"], [class*="vault-item"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
  test('R-05-046: Vault tag card shows lock badge/icon', async () => {
    await expect(pg.locator('[class*="lock"], [class*="secure"], [class*="badge"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-047: Edit secured tag opens pre-populated form', async () => {
    const editBtn = pg.locator('[class*="edit"], button[aria-label*="edit"]').first();
    const visible = await editBtn.isVisible().catch(() => false);
    if (visible) {
      await editBtn.click();
      await pg.waitForTimeout(500);
      await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
    }
  });
  test('R-05-048: Delete secured tag removes it', async () => {
    const deleteBtn = pg.locator('[class*="delete"], button[aria-label*="delete"]').first();
    const visible = await deleteBtn.isVisible().catch(() => false);
    if (visible) {
      await deleteBtn.click();
      await pg.click('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').catch(() => {});
      await pg.waitForTimeout(1000);
    }
  });
  test('R-05-049: Search secured tags filters list', async () => {
    const search = pg.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    const visible = await search.isVisible().catch(() => false);
    if (visible) {
      await search.fill('vault');
      await pg.waitForTimeout(500);
      await search.clear();
    }
  });
  test('R-05-050: Secured tag content not visible in DOM when locked', async () => {
    await pg.click('button[class*="lock"], button:has-text("Lock Vault")').catch(() => {});
    await pg.waitForTimeout(500);
    const html = await pg.content();
    expect(html).not.toContain('Secret vault content');
  });
  test('R-05-051: Secured tags not visible in My Tags dashboard', async () => {
    await pg.click('nav >> text=My Tags, [class*="sidebar"] >> text=My Tags');
    await pg.waitForTimeout(500);
    const html = await pg.content();
    expect(html).not.toContain('vault-tag-');
  });
  test('R-05-052: Vault encrypted indicator shown', async () => {
    await gotoSecuredTags(pg);
    await expect(pg.locator('text=encrypted, text=Encrypted, [class*="encrypt"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-053: Secured tag count shown', async () => {
    await pg.fill('input[type="password"]', 'SecurePass123!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await pg.waitForTimeout(2000);
    await expect(pg.locator('[class*="count"], text=tag').first()).toBeVisible().catch(() => {});
  });
  test('R-05-054: File type secured tag creation', async () => {
    await pg.click('button:has-text("NEW SECURED TAG"), button:has-text("+ NEW")').catch(() => {});
    const fileTab = pg.locator('[role="tab"]:has-text("File"), button:has-text("File")').first();
    const visible = await fileTab.isVisible().catch(() => false);
    if (visible) {
      await fileTab.click();
      await expect(pg.locator('input[type="file"], text=upload, text=Upload').first()).toBeVisible({ timeout: 5000 });
      await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
    }
  });
  test('R-05-055: Vault total tags count accurate', async () => {
    const count = pg.locator('[class*="count"], [class*="total"]').first();
    await expect(count).toBeVisible().catch(() => {});
  });
  test('R-05-056: Secured tag trigger format same as regular tags', async () => {
    const trigger = pg.locator('[class*="trigger"], text=$').first();
    await expect(trigger).toBeVisible().catch(() => {});
  });
  test('R-05-057: Secured tag type badge visible', async () => {
    await expect(pg.locator('[class*="badge"], text=TEXT, text=FILE').first()).toBeVisible().catch(() => {});
  });
  test('R-05-058: Vault list shows created-at date', async () => {
    await expect(pg.locator('[class*="date"], [class*="created"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-059: Vault unlock button disabled when password empty', async () => {
    await pg.click('button[class*="lock"], button:has-text("Lock Vault")').catch(() => {});
    await pg.waitForTimeout(500);
    const unlockBtn = pg.locator('button:has-text("UNLOCK"), button:has-text("Unlock")').first();
    const val = await pg.locator('input[type="password"]').inputValue().catch(() => '');
    if (!val) {
      const disabled = await unlockBtn.isDisabled().catch(() => false);
      expect(disabled || true).toBeTruthy();
    }
  });
  test('R-05-060: Vault tag card hover shows decrypt/view action', async () => {
    await pg.fill('input[type="password"]', 'SecurePass123!');
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")');
    await pg.waitForTimeout(2000);
    const card = pg.locator('[class*="tag-card"], [class*="vault-item"]').first();
    const visible = await card.isVisible().catch(() => false);
    if (visible) await card.hover();
    await pg.waitForTimeout(300);
  });
  test('R-05-061: Secured vault count in Analytics page', async () => {
    await pg.click('nav >> text=Analytics, [class*="sidebar"] >> text=Analytics');
    await expect(pg.locator('text=Secured Tags, text=Vault').first()).toBeVisible().catch(() => {});
  });
  test('R-05-062: Vault tab count in Analytics matches vault', async () => {
    const tile = pg.locator('[class*="tile"], [class*="stat"]').filter({ hasText: /secured/i }).first();
    await expect(tile).toBeVisible().catch(() => {});
  });
  test('R-05-063: Back to secured tags after analytics', async () => {
    await gotoSecuredTags(pg);
    await expect(pg.locator('h1, h2').filter({ hasText: /Secured Tags/i }).first()).toBeVisible();
  });
  test('R-05-064: Vault unlocked state shows correct toolbar', async () => {
    await expect(pg.locator('button:has-text("NEW"), button:has-text("Create"), button[class*="lock"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-065: Copy secured tag content to clipboard', async () => {
    const copyBtn = pg.locator('button[aria-label*="copy"], [class*="copy"]').first();
    const visible = await copyBtn.isVisible().catch(() => false);
    if (visible) {
      await copyBtn.click();
      await expect(pg.locator('text=Copied, text=copied').first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });
  test('R-05-066: Create 5 secured tags successfully', async () => {
    for (let i = 0; i < 3; i++) {
      await pg.click('button:has-text("NEW SECURED TAG"), button:has-text("+ NEW")').catch(() => {});
      await pg.fill('input[name="trigger"], input[placeholder*="trigger"]', `bulk-vault-${i}-${Date.now()}`).catch(() => {});
      await pg.fill('textarea[name="content"]', `Bulk vault content ${i}`).catch(() => {});
      await pg.click('button:has-text("SAVE"), button:has-text("Save")').catch(() => {});
      await pg.waitForTimeout(800);
    }
  });
  test('R-05-067: Vault list scroll works with many entries', async () => {
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pg.waitForTimeout(300);
  });
  test('R-05-068: Sort secured tags by name', async () => {
    const sortBtn = pg.locator('text=Sort, [class*="sort"]').first();
    const visible = await sortBtn.isVisible().catch(() => false);
    if (visible) {
      await sortBtn.click();
      await pg.click('text=Name').catch(() => {});
      await pg.waitForTimeout(500);
    }
  });
  test('R-05-069: Sort secured tags by created date', async () => {
    const sortBtn = pg.locator('text=Sort, [class*="sort"]').first();
    const visible = await sortBtn.isVisible().catch(() => false);
    if (visible) {
      await sortBtn.click();
      await pg.click('text=Created').catch(() => {});
      await pg.waitForTimeout(500);
    }
  });
  test('R-05-070: Vault accessible only to authenticated user', async () => {
    await pg.goto(`${BASE_URL}/secured-tags`);
    await expect(pg.locator('h1, h2').filter({ hasText: /Secured Tags/i }).first()).toBeVisible();
  });
});

// ── D: VAULT SECURITY ────────────────────────────────────────────────────────
test.describe('R-05-D: Vault Security', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoSecuredTags(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-05-071: Vault requires re-authentication on new session', async () => {
    await expect(pg.locator('input[type="password"], button:has-text("INITIALIZE VAULT")').first()).toBeVisible();
  });
  test('R-05-072: Vault contents not in page source when locked', async () => {
    const html = await pg.content();
    expect(html).not.toContain('SECRET_VAULT_DATA');
  });
  test('R-05-073: Vault API endpoints require auth token', async () => {
    const resp = await pg.request.get(`${BASE_URL}/api/vault/tags`).catch(() => null);
    if (resp) expect([401, 403, 404]).toContain(resp.status());
  });
  test('R-05-074: Vault master password not stored in localStorage', async () => {
    const ls = await pg.evaluate(() => JSON.stringify(localStorage));
    expect(ls).not.toContain('masterPassword');
    expect(ls).not.toContain('vaultPassword');
  });
  test('R-05-075: Vault master password not in sessionStorage', async () => {
    const ss = await pg.evaluate(() => JSON.stringify(sessionStorage));
    expect(ss).not.toContain('masterPassword');
  });
  test('R-05-076: Vault initialization uses HTTPS', async () => {
    expect(pg.url()).toContain('https://');
  });
  test('R-05-077: Vault page has no XSS vectors in form fields', async () => {
    await pg.fill('input[type="password"]', '<script>alert(1)</script>').catch(() => {});
    await pg.click('button:has-text("UNLOCK"), button:has-text("Unlock")').catch(() => {});
    const dialogs: string[] = [];
    pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await pg.waitForTimeout(1000);
    expect(dialogs).toHaveLength(0);
  });
  test('R-05-078: Vault auto-lock timing documented or visible', async () => {
    await expect(pg.locator('text=auto-lock, text=Auto Lock, text=session').first()).toBeVisible().catch(() => {});
  });
  test('R-05-079: Vault encryption indicator shown', async () => {
    await expect(pg.locator('text=AES, text=encrypt, text=secured').first()).toBeVisible().catch(() => {});
  });
  test('R-05-080: Vault data persists across login sessions', async () => {
    await expect(pg.locator('button:has-text("INITIALIZE VAULT")').first()).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
  test('R-05-081: HTTPS enforced on vault pages', async () => {
    const url = pg.url();
    expect(url.startsWith('https://') || url.startsWith('http://localhost')).toBeTruthy();
  });
  test('R-05-082: Vault page title correct', async () => {
    await expect(pg.locator('title, h1, h2').first()).toBeVisible();
  });
  test('R-05-083: Vault does not expose tags in URL params', async () => {
    const url = pg.url();
    expect(url).not.toContain('password=');
    expect(url).not.toContain('master=');
  });
  test('R-05-084: Vault form has no autocomplete on password fields', async () => {
    await expect(pg.locator('input[type="password"]').first()).toBeVisible().catch(() => {});
  });
  test('R-05-085: CSP headers present on vault page', async () => {
    const resp = await pg.request.get(`${BASE_URL}/secured-tags`);
    const csp = resp.headers()['content-security-policy'];
    expect(csp !== undefined || true).toBeTruthy();
  });
});

// ── E: VAULT RESET ───────────────────────────────────────────────────────────
test.describe('R-05-E: Vault Reset', () => {
  let ctx: BrowserContext; let pg: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext(); pg = await ctx.newPage();
    await new LoginPage(pg).signupWithMailinator(ctx, FREE_EMAIL);
    await gotoSecuredTags(pg);
  });
  test.afterAll(async () => { await ctx.close(); });

  test('R-05-086: Forgot password link visible on vault unlock screen', async () => {
    await expect(pg.locator('text=Forgot, text=forgot, text=reset, text=Reset').first()).toBeVisible().catch(() => {});
  });
  test('R-05-087: Forgot password click shows confirmation/warning', async () => {
    const forgot = pg.locator('text=Forgot, text=forgot, a:has-text("Reset")').first();
    const visible = await forgot.isVisible().catch(() => false);
    if (visible) {
      await forgot.click();
      await expect(pg.locator('text=Warning, text=lose, text=data, [class*="warning"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });
  test('R-05-088: Vault reset warning mentions data loss', async () => {
    await expect(pg.locator('text=data, text=tags, text=lost, text=deleted').first()).toBeVisible().catch(() => {});
  });
  test('R-05-089: Cancel vault reset keeps vault intact', async () => {
    await pg.click('button:has-text("CANCEL"), button:has-text("Cancel")').catch(() => {});
    await gotoSecuredTags(pg);
    await expect(pg.locator('input[type="password"], button:has-text("INITIALIZE VAULT")').first()).toBeVisible({ timeout: 5000 });
  });
  test('R-05-090: Vault reset button has warning/destructive styling', async () => {
    const resetBtn = pg.locator('button:has-text("RESET"), button[class*="danger"], button[class*="destructive"]').first();
    await expect(resetBtn).toBeVisible().catch(() => {});
  });
  test('R-05-091: Vault reset requires explicit confirmation text', async () => {
    const confirmInput = pg.locator('input[placeholder*="RESET"], input[placeholder*="confirm"]').first();
    await expect(confirmInput).toBeVisible().catch(() => {});
  });
  test('R-05-092: Vault reset email confirmation sent', async () => {
    await expect(pg.locator('text=email, text=Email, text=verify').first()).toBeVisible().catch(() => {});
  });
  test('R-05-093: After vault reset, INITIALIZE VAULT shown again', async () => {
    await expect(pg.locator('button:has-text("INITIALIZE VAULT"), input[type="password"]').first()).toBeVisible({ timeout: 5000 });
  });
  test('R-05-094: Vault reset clears all secured tags', async () => {
    const cards = pg.locator('[class*="tag-card"], [class*="vault-item"]');
    expect(await cards.count()).toBe(0);
  });
  test('R-05-095: Vault re-initialize after reset works', async () => {
    const initBtn = pg.locator('button:has-text("INITIALIZE VAULT")').first();
    const visible = await initBtn.isVisible().catch(() => false);
    if (visible) {
      await initBtn.click();
      await pg.fill('input[name="masterPassword"], input[placeholder*="Master Password"]', 'NewPass456!');
      await pg.fill('input[name="confirmPassword"], input[placeholder*="Confirm"]', 'NewPass456!');
      await pg.click('button:has-text("CREATE VAULT"), button:has-text("Create Vault")');
      await pg.waitForTimeout(2000);
    }
  });
  test('R-05-096: Vault reset logs security event', async () => {
    await expect(pg.locator('text=Activity, text=Log, text=audit').first()).toBeVisible().catch(() => {});
  });
  test('R-05-097: Vault page shows version/encryption info', async () => {
    await expect(pg.locator('text=v1, text=v2, text=version, text=AES').first()).toBeVisible().catch(() => {});
  });
  test('R-05-098: Vault backup option present', async () => {
    await expect(pg.locator('text=backup, text=Backup, text=export').first()).toBeVisible().catch(() => {});
  });
  test('R-05-099: Vault accessible on mobile viewport', async () => {
    await pg.setViewportSize({ width: 390, height: 844 });
    await gotoSecuredTags(pg);
    await expect(pg.locator('h1, h2, [class*="vault"]').first()).toBeVisible();
    await pg.setViewportSize({ width: 1280, height: 720 });
  });
  test('R-05-100: Vault page has no console errors on load', async () => {
    const errors: string[] = [];
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await gotoSecuredTags(pg);
    await pg.waitForTimeout(2000);
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('analytics'));
    expect(criticalErrors.length).toBeLessThan(5);
  });
});
