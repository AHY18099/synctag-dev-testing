import { BrowserContext, Page } from '@playwright/test';

export class MailinatorHelper {
  static generateEmail(): string {
    return `synctag-test-${Date.now()}@mailinator.com`;
  }

  static async getOTPFromBrowser(context: BrowserContext, email: string): Promise<string> {
    const inboxName = email.split('@')[0];
    const mailinatorPage = await context.newPage();
    let otp = '';

    try {
      await mailinatorPage.goto(
        `https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`,
        { waitUntil: 'domcontentloaded' }
      );

      for (let i = 0; i < 30; i++) {
        await mailinatorPage.waitForTimeout(2000);

        const rows = mailinatorPage.locator('tr.ng-scope, .subject-col, [class*="inbox-row"]');
        if (await rows.count() > 0) {
          await rows.first().click();
          await mailinatorPage.waitForTimeout(1500);

          let bodyText = '';
          try {
            const frame = mailinatorPage.frameLocator('#html_msg_body, iframe');
            bodyText = await frame.locator('body').innerText({ timeout: 5000 });
          } catch {
            bodyText = await mailinatorPage.locator('body').innerText();
          }

          const match = bodyText.match(/\b(\d{6})\b/);
          if (match) { otp = match[1]; break; }
        }

        await mailinatorPage.reload();
      }
    } finally {
      await mailinatorPage.close();
    }

    if (!otp) throw new Error(`OTP not found in inbox: ${email}`);
    return otp;
  }

  static async fillOTPBoxes(page: Page, otp: string): Promise<void> {
    const inputs = page.locator('input[maxlength="1"], .otp-input input, [class*="otp"] input');
    const count = await inputs.count();

    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).fill(otp[i]);
        await page.waitForTimeout(100);
      }
    } else {
      const single = page.locator('input[name="otp"], input[placeholder*="code"], input[placeholder*="OTP"]');
      await single.fill(otp);
    }
  }

  static async signupAndLogin(context: BrowserContext, page: Page, email: string): Promise<void> {
    const baseURL = process.env.BASE_URL || 'https://devextension.synctag.com';
    await page.goto(`${baseURL}/login`);

    await page.click('text=Email, [data-tab="email"], button:has-text("Email")');
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.click('button:has-text("CONTINUE"), button:has-text("Continue")');
    await page.waitForSelector('text=Verify your access', { timeout: 15000 });

    const otp = await MailinatorHelper.getOTPFromBrowser(context, email);
    await MailinatorHelper.fillOTPBoxes(page, otp);
    await page.click('button:has-text("VERIFY CODE"), button:has-text("Verify Code")');
    await page.waitForURL(/\/(my-tags|dashboard)/, { timeout: 20000 });
  }
}
