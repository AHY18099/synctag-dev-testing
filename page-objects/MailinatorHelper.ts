import { BrowserContext, Page } from '@playwright/test';

export class MailinatorHelper {
  static generateEmail(): string {
    return `synctag-test-${Date.now()}@mailinator.com`;
  }

  // ── Browser-based Mailinator web UI (API v2 requires a paid key — use browser instead) ──
  static async getOTPFromBrowser(context: BrowserContext, email: string): Promise<string> {
    const inboxName = email.split('@')[0];

    const mailinatorPage = await context.newPage();
    let otp = '';

    try {
      await mailinatorPage.goto(
        `https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      // Poll for the email up to 60 seconds
      for (let attempt = 0; attempt < 30; attempt++) {
        await mailinatorPage.waitForTimeout(2000);

        // Reload inbox to pick up new mail
        if (attempt > 0) {
          await mailinatorPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await mailinatorPage.waitForTimeout(1000);
        }

        // Try multiple row selectors Mailinator has used across versions
        const row = mailinatorPage.locator([
          'tr.ng-scope',
          '[class*="inbox-row"]',
          'table tbody tr',
          '.subject-col',
        ].join(', ')).first();

        if (!(await row.isVisible({ timeout: 1500 }).catch(() => false))) continue;

        await row.click();
        await mailinatorPage.waitForTimeout(2000);

        // Try extracting OTP from iframe body or page body
        const bodyText = await (async () => {
          try {
            const frame = mailinatorPage.frameLocator('#html_msg_body, iframe[id*="msg"]');
            return await frame.locator('body').innerText({ timeout: 5000 });
          } catch {
            return mailinatorPage.locator('body').innerText();
          }
        })();

        const match = (await bodyText).match(/\b(\d{6})\b/);
        if (match) { otp = match[1]; break; }
      }
    } finally {
      await mailinatorPage.close();
    }

    if (!otp) throw new Error(`OTP not found in Mailinator inbox: ${email}`);
    return otp;
  }

  // ── Fill the 6-digit OTP into whatever input the app uses ─────────────────
  static async fillOTPBoxes(page: Page, otp: string): Promise<void> {
    await page.waitForTimeout(500);

    // App uses a single text input with maxlength=6
    const single = page.locator('input[maxlength="6"]').first();
    if (await single.isVisible({ timeout: 3000 }).catch(() => false)) {
      await single.click();
      await single.fill(otp);
      return;
    }

    // Fallback: six individual maxlength="1" boxes
    const boxes = page.locator('input[maxlength="1"]');
    const count = await boxes.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await boxes.nth(i).fill(otp[i]);
        await page.waitForTimeout(80);
      }
      return;
    }

    // Last resort: any visible text/number input on the OTP screen
    const fallback = page.locator('input[type="text"], input[type="number"]').first();
    if (await fallback.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fallback.fill(otp);
    }
  }

  // ── Complete login flow (reusable by any spec) ────────────────────────────
  static async signupAndLogin(context: BrowserContext, page: Page, email: string): Promise<void> {
    const baseURL = process.env.BASE_URL || 'https://devextension.synctag.com';
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("Email")');
    await page.fill('input[type="email"]', email);
    await page.click('button:has-text("SEND VERIFICATION CODE")');
    await page.waitForSelector('text=Verify your access', { timeout: 20000 });

    const otp = await MailinatorHelper.getOTPFromBrowser(context, email);
    await MailinatorHelper.fillOTPBoxes(page, otp);
    await page.click('button:has-text("VERIFY CODE")');

    // Handle first-time workspace registration
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      { timeout: 30000 }
    );
    const onSetup = await page.locator('button:has-text("COMPLETE REGISTRATION")').isVisible({ timeout: 4000 }).catch(() => false);
    if (onSetup) {
      const fn = page.locator('input[name="firstName"], input[placeholder*="First Name"]').first();
      if (await fn.isVisible({ timeout: 2000 }).catch(() => false)) await fn.fill('QA');
      const ln = page.locator('input[name="lastName"], input[placeholder*="Last Name"]').first();
      if (await ln.isVisible({ timeout: 2000 }).catch(() => false)) await ln.fill('Tester');
      const cb = page.locator('input[type="checkbox"]').first();
      if (await cb.isVisible({ timeout: 2000 }).catch(() => false) && !(await cb.isChecked())) await cb.check();
      await page.click('button:has-text("COMPLETE REGISTRATION")');
    }

    await page.waitForURL(/\/(my-tags|dashboard)/, { timeout: 30000 });
  }
}
