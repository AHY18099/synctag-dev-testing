import { Page, expect } from '@playwright/test';

export class PipelinesPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.click('nav >> text=Pipelines, [class*="sidebar"] >> text=Pipelines');
    await this.page.waitForURL(/\/pipelines/, { timeout: 10000 });
  }

  async clickCreatePipeline(): Promise<void> {
    await this.page.click('button:has-text("CREATE YOUR FIRST PIPELINE"), button:has-text("+ NEW PIPELINE"), button:has-text("NEW PIPELINE")');
  }

  async fillPipelineName(name: string): Promise<void> {
    await this.page.fill('input[name="name"], input[placeholder*="Pipeline name"], input[placeholder*="name"]', name);
  }

  async addStep(): Promise<void> {
    await this.page.click('button:has-text("+ Add Step"), button:has-text("Add Step")');
  }

  async savePipeline(): Promise<void> {
    await this.page.click('button:has-text("SAVE PIPELINE"), button:has-text("Save Pipeline")');
  }

  async testPipeline(): Promise<void> {
    await this.page.click('button:has-text("TEST"), button:has-text("Test")');
  }

  async assertPipelineLibraryVisible(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: /Pipeline Library/i })).toBeVisible();
  }
}
