import { Page, expect } from '@playwright/test';

export class PublicSitePage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(base, { waitUntil: 'domcontentloaded' });
  }

  async gotoPath(path: string): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async clickNavItem(label: string): Promise<void> {
    await this.page.click(`nav a:has-text("${label}"), header a:has-text("${label}")`);
  }

  async clickGetStarted(): Promise<void> {
    await this.page.click('a:has-text("Get Started"), button:has-text("Get Started"), a:has-text("GET STARTED")');
  }

  async clickRequestDemo(): Promise<void> {
    await this.page.click('a:has-text("Demo"), button:has-text("Demo"), a:has-text("Request Demo")');
  }

  async scrollToSection(selector: string): Promise<void> {
    await this.page.locator(selector).first().scrollIntoViewIfNeeded();
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(500);
  }

  // ── Pricing section ───────────────────────────────────────────────────────

  async getPricingPlans(): Promise<string[]> {
    const plans = this.page.locator('[class*="pricing"] [class*="plan-name"], [class*="plan-card"] h3, [class*="price"] h3');
    const count = await plans.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(await plans.nth(i).innerText());
    }
    return names;
  }

  async clickSignupForPlan(plan: string): Promise<void> {
    const btn = this.page.locator(`[class*="plan-card"]:has-text("${plan}") button, [class*="pricing-card"]:has-text("${plan}") a`).first();
    await btn.click();
  }

  async assertPricingVisible(): Promise<void> {
    await expect(this.page.locator('[class*="pricing"], text=Pricing, text=PRICING').first()).toBeVisible();
  }

  // ── Contact form ──────────────────────────────────────────────────────────

  async gotoContact(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/contact`, { waitUntil: 'domcontentloaded' });
  }

  async fillContactForm(data: { name: string; email: string; message: string }): Promise<void> {
    await this.page.fill('input[name="name"], input[placeholder*="Name"]', data.name);
    await this.page.fill('input[name="email"], input[type="email"]', data.email);
    await this.page.fill('textarea[name="message"], textarea[placeholder*="message"]', data.message);
  }

  async submitContactForm(): Promise<void> {
    await this.page.click('button[type="submit"]:has-text("Send"), button:has-text("Submit"), button:has-text("SEND")');
  }

  async assertContactSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=Thank you, text=sent successfully, text=received').first()
    ).toBeVisible({ timeout: 10000 });
  }

  // ── Report Issue form ────────────────────────────────────────────────────

  async gotoReportIssue(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/report-issue`, { waitUntil: 'domcontentloaded' }).catch(async () => {
      await this.page.goto(`${base}/help`, { waitUntil: 'domcontentloaded' });
    });
  }

  async fillReportIssueForm(data: { title: string; description: string; email?: string }): Promise<void> {
    const titleInput = this.page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="subject"]').first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(data.title);
    }
    await this.page.fill('textarea[name="description"], textarea[placeholder*="description"], textarea[placeholder*="message"]', data.description);
    if (data.email) {
      const emailInput = this.page.locator('input[name="email"], input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill(data.email);
      }
    }
  }

  async submitReportIssue(): Promise<void> {
    await this.page.click('button[type="submit"], button:has-text("Submit"), button:has-text("SUBMIT")');
  }

  // ── Help & Support ────────────────────────────────────────────────────────

  async gotoHelp(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/help`, { waitUntil: 'domcontentloaded' }).catch(async () => {
      await this.page.goto(`${base}/support`, { waitUntil: 'domcontentloaded' });
    });
  }

  async assertHelpContentVisible(): Promise<void> {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: /Help|Support|FAQ|Documentation/i }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async assertNoConsoleErrors(): Promise<void> {
    const errors: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await this.page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  }

  async assertPageTitle(pattern: RegExp | string): Promise<void> {
    const title = await this.page.title();
    if (pattern instanceof RegExp) {
      expect(title).toMatch(pattern);
    } else {
      expect(title).toContain(pattern);
    }
  }

  async assertMetaDescription(): Promise<void> {
    const desc = await this.page.locator('meta[name="description"]').getAttribute('content');
    expect(desc?.length ?? 0).toBeGreaterThan(10);
  }

  async getPageLoadTime(): Promise<number> {
    return this.page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav ? nav.loadEventEnd - nav.startTime : 0;
    });
  }

  async isResponsive(maxWidth: number): Promise<boolean> {
    const scrollWidth = await this.page.evaluate(() => document.documentElement.scrollWidth);
    return scrollWidth <= maxWidth + 10;
  }
}
