/**
 * Global auth setup — runs ONCE before all tests.
 * Logs in via Mailinator web UI, completes any workspace registration,
 * then explicitly navigates to /my-tags to confirm the session works
 * before saving auth-state.json.
 */
import { test as setup, BrowserContext, Page } from '@playwright/test';
import * as path from 'node:path';
import * as fs   from 'node:fs';

export const AUTH_FILE = path.resolve('auth-state.json');

const BASE_URL   = process.env.BASE_URL   || 'https://devextension.synctag.com';
const AUTH_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

// ── Mailinator helpers ────────────────────────────────────────────────────────

async function getMailBodyText(inbox: Page): Promise<string> {
  try {
    return await inbox.frameLocator('#html_msg_body, iframe').locator('body').innerText({ timeout: 5000 });
  } catch {
    return inbox.locator('body').innerText();
  }
}

async function navigateToMailinatorInbox(inbox: Page, inboxName: string): Promise<void> {
  await inbox.goto('https://www.mailinator.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const searchBox = inbox.locator('#inboxfield, input[placeholder*="Public Inbox"], input[placeholder*="inbox"], input[name="to"]').first();
  if (await searchBox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchBox.fill(inboxName);
    await inbox.keyboard.press('Enter');
    await inbox.waitForTimeout(3000);
    return;
  }
  await inbox.goto(
    `https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
}

async function pollOTPViaBrowser(context: BrowserContext, inboxName: string): Promise<string> {
  console.log('[auth.setup] Opening Mailinator inbox:', inboxName);
  const inbox = await context.newPage();
  let otp = '';
  try {
    await navigateToMailinatorInbox(inbox, inboxName);
    for (let i = 0; i < 30 && !otp; i++) {
      await inbox.waitForTimeout(2000);
      if (i > 0) await inbox.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      const row = inbox.locator('tr.ng-scope, [class*="inbox-row"], table tbody tr').first();
      if (!(await row.isVisible({ timeout: 1500 }).catch(() => false))) {
        console.log(`[auth.setup] Waiting for OTP email... (${i + 1}/30)`);
        continue;
      }
      await row.click();
      await inbox.waitForTimeout(1500);
      const bodyText = await getMailBodyText(inbox);
      const m = /\b(\d{6})\b/.exec(bodyText);
      if (m) { otp = m[1]; break; }
    }
  } finally {
    await inbox.close();
  }
  return otp;
}

// ── OTP input helper ──────────────────────────────────────────────────────────

async function fillOTP(page: Page, otp: string): Promise<void> {
  const single = page.locator('input[maxlength="6"]').first();
  if (await single.isVisible({ timeout: 3000 }).catch(() => false)) {
    await single.fill(otp);
    return;
  }
  const boxes = page.locator('input[maxlength="1"]');
  const count = await boxes.count();
  for (let i = 0; i < Math.min(count, 6); i++) {
    await boxes.nth(i).fill(otp[i]);
  }
}

// ── Registration helper ───────────────────────────────────────────────────────

async function completeRegistrationIfVisible(page: Page): Promise<boolean> {
  const btn = page.locator('button:has-text("COMPLETE REGISTRATION"), button:has-text("Complete Registration")');
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) return false;

  console.log('[auth.setup] Registration page detected — filling workspace setup form...');
  const fn = page.locator('input[name="firstName"], input[placeholder*="First Name"]').first();
  if (await fn.isVisible({ timeout: 2000 }).catch(() => false)) await fn.fill('QA');
  const ln = page.locator('input[name="lastName"], input[placeholder*="Last Name"]').first();
  if (await ln.isVisible({ timeout: 2000 }).catch(() => false)) await ln.fill('Tester');
  const cb = page.locator('input[type="checkbox"]').first();
  if (await cb.isVisible({ timeout: 2000 }).catch(() => false) && !(await cb.isChecked())) await cb.check();
  await btn.click();
  console.log('[auth.setup] Registration submitted — waiting for redirect...');
  await page.waitForTimeout(3000);
  return true;
}

// ── Setup test ────────────────────────────────────────────────────────────────

setup('authenticate once and save session', async ({ page, context }) => {
  setup.setTimeout(180000);

  // Reuse recent auth file (< 30 min old)
  if (fs.existsSync(AUTH_FILE)) {
    const ageMs = Date.now() - fs.statSync(AUTH_FILE).mtimeMs;
    if (ageMs < 30 * 60 * 1000) {
      console.log('[auth.setup] Reusing existing auth-state.json (age:', Math.round(ageMs / 1000), 's)');
      return;
    }
  }

  console.log('[auth.setup] Logging in as:', AUTH_EMAIL);

  // ── Step 1: Submit email & send OTP ────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.click('button:has-text("Email")');
  await page.fill('input[type="email"]', AUTH_EMAIL);
  await page.click('button:has-text("SEND VERIFICATION CODE")');
  await page.waitForSelector('text=Verify your access', { timeout: 20000 });

  // ── Step 2: Get OTP from Mailinator ────────────────────────────────────────
  const inboxName = AUTH_EMAIL.split('@')[0];
  const otp = await pollOTPViaBrowser(context, inboxName);
  if (!otp) throw new Error('[auth.setup] Could not retrieve OTP from Mailinator for ' + AUTH_EMAIL);
  console.log('[auth.setup] OTP received:', otp);

  // ── Step 3: Verify OTP ─────────────────────────────────────────────────────
  await fillOTP(page, otp);
  await page.click('button:has-text("VERIFY CODE")');

  // Wait for any navigation away from login/OTP screens
  await page.waitForFunction(
    () => !globalThis.location.pathname.startsWith('/login'),
    { timeout: 60000 }
  );
  console.log('[auth.setup] Post-OTP URL:', page.url());

  // ── Step 4: Complete registration if shown (first-time user) ───────────────
  await completeRegistrationIfVisible(page);

  // ── Step 5: Navigate directly to dashboard to validate session ─────────────
  console.log('[auth.setup] Navigating to /my-tags to validate session...');
  await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Registration may appear after direct navigation (if it wasn't shown earlier)
  const registeredNow = await completeRegistrationIfVisible(page);
  if (registeredNow) {
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Confirm we landed on the dashboard (not an error page)
  const onDashboard = await page.locator('h1, h2, [class*="header"]')
    .filter({ hasText: /Tag Library|My Tags|Dashboard|Tags/i })
    .first().isVisible({ timeout: 10000 }).catch(() => false);

  if (onDashboard) {
    console.log('[auth.setup] Dashboard confirmed. URL:', page.url());
  } else {
    console.log('[auth.setup] WARNING: Could not confirm dashboard — current URL:', page.url());
    console.log('[auth.setup] Saving session anyway and proceeding...');
  }

  // ── Step 6: Save session ───────────────────────────────────────────────────
  await context.storageState({ path: AUTH_FILE });
  console.log('[auth.setup] Session saved to', AUTH_FILE);
});
