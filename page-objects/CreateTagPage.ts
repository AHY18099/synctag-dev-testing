import { Page, expect } from '@playwright/test';

export class CreateTagPage {
  constructor(private page: Page) {}

  async selectTab(tab: 'Text' | 'Form' | 'AI' | 'API' | 'File' | 'Chat'): Promise<void> {
    await this.page.click(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`);
  }

  async fillTrigger(trigger: string): Promise<void> {
    await this.page.fill('input[name="trigger"], input[placeholder*="trigger"], [class*="trigger"] input', trigger);
  }

  async fillDescription(desc: string): Promise<void> {
    await this.page.fill('input[name="description"], textarea[name="description"], [placeholder*="description"]', desc);
  }

  async fillTextContent(content: string): Promise<void> {
    await this.page.fill('textarea[name="content"], .text-content textarea, [placeholder*="content"]', content);
  }

  async fillPromptData(prompt: string): Promise<void> {
    await this.page.fill('textarea[name="prompt"], [placeholder*="prompt"], .prompt-data textarea', prompt);
  }

  async fillApiUrl(url: string): Promise<void> {
    await this.page.fill('input[name="url"], input[placeholder*="URL"], input[placeholder*="http"]', url);
  }

  async clickSave(): Promise<void> {
    await this.page.click('button:has-text("SAVE TAG"), button:has-text("Save Tag")');
  }

  async clickCancel(): Promise<void> {
    await this.page.click('button:has-text("CANCEL"), button:has-text("Cancel")');
  }

  async assertTriggerError(): Promise<void> {
    await expect(this.page.locator('[class*="error"], .error-message, [class*="invalid"]').first()).toBeVisible();
  }

  async createTextTag(trigger: string, description: string, content: string): Promise<void> {
    await this.selectTab('Text');
    await this.fillTrigger(trigger);
    await this.fillDescription(description);
    await this.fillTextContent(content);
    await this.clickSave();
  }
}
