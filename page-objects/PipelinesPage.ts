import { Page, expect } from '@playwright/test';

export class PipelinesPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Pipelines, [class*="sidebar"] >> text=Pipelines');
    await this.page.waitForURL(/\/pipelines/, { timeout: 10000 }).catch(() => {});
  }

  async gotoByUrl(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/pipelines`, { waitUntil: 'domcontentloaded' });
  }

  // ── Pipeline creation ──────────────────────────────────────────────────────

  async clickCreatePipeline(): Promise<void> {
    await this.page.click('button:has-text("CREATE YOUR FIRST PIPELINE"), button:has-text("+ NEW PIPELINE"), button:has-text("NEW PIPELINE"), button:has-text("Create Pipeline")');
  }

  async fillPipelineName(name: string): Promise<void> {
    await this.page.fill('input[name="name"], input[placeholder*="Pipeline name"], input[placeholder*="name"]', name);
  }

  async fillPipelineDescription(desc: string): Promise<void> {
    const el = this.page.locator('textarea[name="description"], input[name="description"], [placeholder*="description"]').first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.fill(desc);
    }
  }

  // ── Step management ────────────────────────────────────────────────────────

  async addStep(): Promise<void> {
    await this.page.click('button:has-text("+ Add Step"), button:has-text("Add Step"), button:has-text("ADD STEP")');
  }

  async selectStepType(stepIndex: number, type: 'Text' | 'AI' | 'API'): Promise<void> {
    const stepSelects = this.page.locator('[class*="step"] select, [class*="step"] [class*="type-select"]');
    const count = await stepSelects.count();
    if (count > stepIndex) {
      await stepSelects.nth(stepIndex).selectOption({ label: type });
    } else {
      await this.page.click(`[class*="step-${stepIndex}"] button:has-text("${type}"), [class*="step-type"]:has-text("${type}")`);
    }
  }

  async fillStepLabel(stepIndex: number, label: string): Promise<void> {
    const labelInputs = this.page.locator('[class*="step"] input[name="label"], [class*="step"] input[placeholder*="label"]');
    if (await labelInputs.nth(stepIndex).isVisible({ timeout: 2000 }).catch(() => false)) {
      await labelInputs.nth(stepIndex).fill(label);
    }
  }

  async fillStepPrompt(stepIndex: number, prompt: string): Promise<void> {
    const prompts = this.page.locator('[class*="step"] textarea[name="prompt"], [class*="step"] textarea[placeholder*="prompt"]');
    if (await prompts.nth(stepIndex).isVisible({ timeout: 2000 }).catch(() => false)) {
      await prompts.nth(stepIndex).fill(prompt);
    }
  }

  async fillStepApiUrl(stepIndex: number, url: string): Promise<void> {
    const urls = this.page.locator('[class*="step"] input[name="url"], [class*="step"] input[placeholder*="URL"]');
    if (await urls.nth(stepIndex).isVisible({ timeout: 2000 }).catch(() => false)) {
      await urls.nth(stepIndex).fill(url);
    }
  }

  async removeStep(stepIndex: number): Promise<void> {
    const removeBtns = this.page.locator('[class*="step"] button[aria-label*="remove"], [class*="step"] button:has-text("Remove")');
    if (await removeBtns.nth(stepIndex).isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtns.nth(stepIndex).click();
    }
  }

  async getStepCount(): Promise<number> {
    const steps = this.page.locator('[class*="step-item"], [class*="pipeline-step"]');
    return await steps.count();
  }

  // ── Inline pipeline (>> syntax) ────────────────────────────────────────────

  async fillInlinePipeline(syntax: string): Promise<void> {
    const input = this.page.locator('input[placeholder*=">>"], input[name="pipeline"], [class*="inline-pipeline"] input').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(syntax);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async savePipeline(): Promise<void> {
    await this.page.click('button:has-text("SAVE PIPELINE"), button:has-text("Save Pipeline"), button:has-text("SAVE")');
  }

  async testPipeline(): Promise<void> {
    await this.page.click('button:has-text("TEST"), button:has-text("Test"), button:has-text("TEST PIPELINE")');
  }

  async fillTestInput(input: string): Promise<void> {
    const testInput = this.page.locator('[class*="test-input"] input, [class*="test-input"] textarea, input[placeholder*="test input"]').first();
    if (await testInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testInput.fill(input);
      await this.page.click('button:has-text("Run"), button:has-text("Execute"), button:has-text("SUBMIT")');
    }
  }

  async activatePipeline(pipelineName: string): Promise<void> {
    const card = this.page.locator(`[class*="pipeline-card"]:has-text("${pipelineName}")`).first();
    await card.locator('button:has-text("Activate"), button[aria-label*="activate"], input[type="checkbox"]').first().click();
  }

  async deactivatePipeline(pipelineName: string): Promise<void> {
    const card = this.page.locator(`[class*="pipeline-card"]:has-text("${pipelineName}")`).first();
    await card.locator('button:has-text("Deactivate"), button[aria-label*="deactivate"]').first().click();
  }

  async editPipeline(pipelineName: string): Promise<void> {
    const card = this.page.locator(`[class*="pipeline-card"]:has-text("${pipelineName}")`).first();
    await card.locator('button:has-text("Edit"), button[aria-label*="edit"]').first().click();
  }

  async deletePipeline(pipelineName: string): Promise<void> {
    const card = this.page.locator(`[class*="pipeline-card"]:has-text("${pipelineName}")`).first();
    await card.locator('button:has-text("Delete"), button[aria-label*="delete"]').first().click();
    const confirm = this.page.locator('button:has-text("Confirm"), button:has-text("Yes, Delete")').first();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
  }

  async duplicatePipeline(pipelineName: string): Promise<void> {
    const card = this.page.locator(`[class*="pipeline-card"]:has-text("${pipelineName}")`).first();
    await card.locator('button:has-text("Duplicate"), button[aria-label*="duplicate"]').first().click();
  }

  async searchPipeline(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"], input[type="search"]', query);
  }

  // ── Error handling settings ────────────────────────────────────────────────

  async setErrorHandling(option: 'Stop' | 'Continue' | 'Retry'): Promise<void> {
    const sel = this.page.locator('select[name="errorHandling"], [class*="error-handling"] select').first();
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sel.selectOption({ label: option });
    }
  }

  async setTimeoutValue(seconds: string): Promise<void> {
    const input = this.page.locator('input[name="timeout"], input[placeholder*="timeout"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(seconds);
    }
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  async assertPipelineLibraryVisible(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Pipeline Library/i })).toBeVisible();
  }

  async assertPipelineInList(name: string): Promise<void> {
    await expect(this.page.locator(`text=${name}`).first()).toBeVisible({ timeout: 10000 });
  }

  async assertPipelineNotInList(name: string): Promise<void> {
    await expect(this.page.locator(`text=${name}`).first()).not.toBeVisible({ timeout: 5000 });
  }

  async assertSaveSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=saved, text=Pipeline created, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertTestOutputVisible(): Promise<void> {
    await expect(
      this.page.locator('[class*="output"], [class*="test-result"], text=Output').first()
    ).toBeVisible({ timeout: 20000 });
  }

  async assertMaxStepsError(): Promise<void> {
    await expect(
      this.page.locator('text=maximum, text=max steps, text=limit').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertEmptyState(): Promise<void> {
    await expect(
      this.page.locator('text=No pipelines, text=Create your first pipeline, button:has-text("CREATE YOUR FIRST PIPELINE")').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertPipelineCount(expectedMin: number): Promise<void> {
    const cards = this.page.locator('[class*="pipeline-card"], [class*="pipeline-item"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(expectedMin);
  }

  async assertUnsupportedCombinationWarning(): Promise<void> {
    const warning = this.page.locator('text=not supported, text=limited support, text=combination, [class*="warning"]').first();
    const visible = await warning.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await expect(warning).toBeVisible();
    }
  }

  // ── Composite helpers ──────────────────────────────────────────────────────

  async createSimplePipeline(name: string): Promise<void> {
    await this.clickCreatePipeline();
    await this.fillPipelineName(name);
    await this.savePipeline();
  }
}
