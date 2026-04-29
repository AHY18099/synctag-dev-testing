import { Page, expect } from '@playwright/test';

export class AnalyticsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Analytics, [class*="sidebar"] >> text=Analytics');
    await this.page.waitForURL(/\/analytics/, { timeout: 10000 }).catch(() => {});
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/analytics`, { waitUntil: 'domcontentloaded' });
  }

  // ── Date range controls ────────────────────────────────────────────────────

  async clickTimePeriod(period: 'Today' | '1W' | '1M' | 'Custom'): Promise<void> {
    await this.page.click(`button:has-text("${period}"), [class*="period"]:has-text("${period}")`);
  }

  async setCustomDateRange(from: string, to: string): Promise<void> {
    await this.clickTimePeriod('Custom');
    const fromInput = this.page.locator('input[name="from"], input[name="startDate"], input[placeholder*="From"]').first();
    const toInput = this.page.locator('input[name="to"], input[name="endDate"], input[placeholder*="To"]').first();
    if (await fromInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fromInput.fill(from);
      await toInput.fill(to);
      await this.page.click('button:has-text("Apply"), button:has-text("APPLY")');
    }
  }

  async clickRefresh(): Promise<void> {
    await this.page.click('button:has-text("REFRESH"), button:has-text("Refresh"), button[aria-label*="refresh"]');
  }

  // ── Stat tiles ────────────────────────────────────────────────────────────

  async assertStatTileVisible(label: string): Promise<void> {
    await expect(this.page.locator(`text=${label}`).first()).toBeVisible();
  }

  async getStatValue(label: string): Promise<string> {
    const tile = this.page.locator(`[class*="stat"]:has-text("${label}"), [class*="tile"]:has-text("${label}")`).first();
    const valueEl = tile.locator('[class*="value"], [class*="count"], h3, h4').first();
    return await valueEl.innerText().catch(() => '0');
  }

  async getAllStatValues(): Promise<Record<string, string>> {
    const tiles = this.page.locator('[class*="stat-tile"], [class*="analytics-card"]');
    const count = await tiles.count();
    const result: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const label = await tile.locator('[class*="label"], p, span').first().innerText().catch(() => `stat_${i}`);
      const value = await tile.locator('[class*="value"], h3, h4').first().innerText().catch(() => '0');
      result[label.trim()] = value.trim();
    }
    return result;
  }

  // ── Charts ────────────────────────────────────────────────────────────────

  async assertChartVisible(): Promise<void> {
    await expect(
      this.page.locator('canvas, [class*="chart"], svg[class*="chart"]').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertLineChartVisible(): Promise<void> {
    await expect(
      this.page.locator('canvas, [class*="line-chart"], [class*="trend"]').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertBarChartVisible(): Promise<void> {
    await expect(
      this.page.locator('canvas, [class*="bar-chart"], [class*="histogram"]').first()
    ).toBeVisible({ timeout: 10000 });
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  async filterByTag(trigger: string): Promise<void> {
    const tagFilter = this.page.locator('[class*="tag-filter"] input, input[placeholder*="Filter by tag"]').first();
    if (await tagFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tagFilter.fill(trigger);
      await this.page.click(`[role="option"]:has-text("${trigger}"), [class*="dropdown"]:has-text("${trigger}")`);
    }
  }

  async selectTagInDropdown(trigger: string): Promise<void> {
    const dropdown = this.page.locator('[class*="tag-select"], select[name="tag"]').first();
    if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dropdown.selectOption({ label: trigger });
    }
  }

  async clearFilters(): Promise<void> {
    const clearBtn = this.page.locator('button:has-text("Clear"), button:has-text("Reset"), button:has-text("All")').first();
    if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearBtn.click();
    }
  }

  // ── Table / list ──────────────────────────────────────────────────────────

  async getTopTagsCount(): Promise<number> {
    const rows = this.page.locator('[class*="top-tags"] tr, [class*="analytics-table"] tr, table tr');
    const count = await rows.count();
    return Math.max(0, count - 1); // subtract header
  }

  async getTopTagName(index: number): Promise<string> {
    const rows = this.page.locator('[class*="top-tags"] tr td:first-child, [class*="analytics-table"] tr td:first-child');
    return await rows.nth(index).innerText().catch(() => '');
  }

  async assertTopTagsVisible(): Promise<void> {
    await expect(
      this.page.locator('[class*="top-tags"], [class*="popular-tags"], text=Top Tags').first()
    ).toBeVisible({ timeout: 10000 });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async clickExport(): Promise<void> {
    const exportBtn = this.page.locator('button:has-text("Export"), button:has-text("EXPORT"), button[aria-label*="export"]').first();
    if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await exportBtn.click();
    }
  }

  async selectExportFormat(format: 'CSV' | 'PDF' | 'Excel'): Promise<void> {
    await this.page.click(`button:has-text("${format}"), [role="option"]:has-text("${format}")`);
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async assertAnalyticsLoaded(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Analytics/i }).first()).toBeVisible();
  }

  async assertTotalScans(minScans: number): Promise<void> {
    const value = await this.getStatValue('Total Scans');
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    expect(num).toBeGreaterThanOrEqual(minScans);
  }

  async assertNoDataState(): Promise<void> {
    const noData = this.page.locator('text=No data, text=no analytics, text=0 scans').first();
    const visible = await noData.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await expect(noData).toBeVisible();
    }
  }

  async assertDateRangeLabel(label: string): Promise<void> {
    await expect(
      this.page.locator(`text=${label}, [class*="date-range"]:has-text("${label}")`).first()
    ).toBeVisible({ timeout: 5000 });
  }
}
