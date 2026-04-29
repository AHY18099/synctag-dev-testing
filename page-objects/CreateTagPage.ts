import { Page, expect } from '@playwright/test';

export class CreateTagPage {
  constructor(private page: Page) {}

  // ── Tab selection ──────────────────────────────────────────────────────────

  async selectTab(tab: 'Text' | 'Form' | 'AI' | 'API' | 'File' | 'Chat'): Promise<void> {
    await this.page.click(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`);
  }

  // ── Common fields ──────────────────────────────────────────────────────────

  async fillTrigger(trigger: string): Promise<void> {
    await this.page.fill('input[name="trigger"], input[placeholder*="trigger"], [class*="trigger"] input', trigger);
  }

  async clearTrigger(): Promise<void> {
    await this.page.fill('input[name="trigger"], input[placeholder*="trigger"], [class*="trigger"] input', '');
  }

  async fillDescription(desc: string): Promise<void> {
    await this.page.fill('input[name="description"], textarea[name="description"], [placeholder*="description"]', desc);
  }

  async getTriggerValue(): Promise<string> {
    const el = this.page.locator('input[name="trigger"], input[placeholder*="trigger"], [class*="trigger"] input').first();
    return await el.inputValue();
  }

  // ── Text tag fields ────────────────────────────────────────────────────────

  async fillTextContent(content: string): Promise<void> {
    await this.page.fill('textarea[name="content"], .text-content textarea, [placeholder*="content"]', content);
  }

  async insertTemplateVariable(variable: string): Promise<void> {
    const btn = this.page.locator(`button:has-text("{{${variable}}}"), [title*="${variable}"]`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.page.locator('textarea[name="content"], .text-content textarea').first()
        .fill(`{{${variable}}}`);
    }
  }

  // ── AI tag fields ──────────────────────────────────────────────────────────

  async fillPromptData(prompt: string): Promise<void> {
    await this.page.fill('textarea[name="prompt"], [placeholder*="prompt"], .prompt-data textarea', prompt);
  }

  async selectAiModel(model: string): Promise<void> {
    const sel = this.page.locator('select[name="model"], [class*="model-select"]').first();
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sel.selectOption({ label: model });
    }
  }

  // ── API tag fields ─────────────────────────────────────────────────────────

  async fillApiUrl(url: string): Promise<void> {
    await this.page.fill('input[name="url"], input[placeholder*="URL"], input[placeholder*="http"]', url);
  }

  async selectApiMethod(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'): Promise<void> {
    const sel = this.page.locator('select[name="method"], [class*="method-select"]').first();
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sel.selectOption(method);
    } else {
      await this.page.click(`button:has-text("${method}"), [role="option"]:has-text("${method}")`);
    }
  }

  async addApiHeader(key: string, value: string): Promise<void> {
    await this.page.click('button:has-text("Add Header"), button:has-text("+ Header")');
    const keyInputs = this.page.locator('input[placeholder*="Header key"], input[placeholder*="Key"]');
    const count = await keyInputs.count();
    await keyInputs.nth(count - 1).fill(key);
    const valInputs = this.page.locator('input[placeholder*="Header value"], input[placeholder*="Value"]');
    await valInputs.nth(count - 1).fill(value);
  }

  async fillApiBody(body: string): Promise<void> {
    const bodyArea = this.page.locator('textarea[name="body"], textarea[placeholder*="body"], .body-editor').first();
    if (await bodyArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bodyArea.fill(body);
    }
  }

  // ── Form tag fields ────────────────────────────────────────────────────────

  async fillFormJson(json: string): Promise<void> {
    await this.page.fill('textarea[name="formJson"], textarea[placeholder*="JSON"], .form-json textarea', json);
  }

  async addFormField(fieldType: string, label: string): Promise<void> {
    const addBtn = this.page.locator('button:has-text("Add Field"), button:has-text("+ Field")').first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await this.page.click(`[role="option"]:has-text("${fieldType}"), option:has-text("${fieldType}")`);
      const labelInput = this.page.locator('input[placeholder*="label"], input[name="label"]').last();
      await labelInput.fill(label);
    }
  }

  // ── Pipeline inline syntax ─────────────────────────────────────────────────

  async fillInlinePipeline(syntax: string): Promise<void> {
    await this.page.fill('input[name="pipeline"], input[placeholder*=">>"], [class*="pipeline"] input', syntax);
  }

  // ── Tag settings ───────────────────────────────────────────────────────────

  async toggleMonetization(): Promise<void> {
    const toggle = this.page.locator('[class*="monetize"] input[type="checkbox"], [class*="monetize"] button[role="switch"]').first();
    await toggle.click();
  }

  async fillSellPrice(price: string): Promise<void> {
    await this.page.fill('input[name="sellPrice"], input[name="price"], input[placeholder*="price"]', price);
  }

  async setTagVisibility(visibility: 'public' | 'private'): Promise<void> {
    await this.page.click(`input[value="${visibility}"], [class*="visibility"] button:has-text("${visibility}")`);
  }

  async enableGlobalTag(): Promise<void> {
    const toggle = this.page.locator('[class*="global"] input[type="checkbox"], [class*="global"] button[role="switch"]').first();
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggle.click();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async clickSave(): Promise<void> {
    await this.page.click('button:has-text("SAVE TAG"), button:has-text("Save Tag")');
  }

  async clickCancel(): Promise<void> {
    await this.page.click('button:has-text("CANCEL"), button:has-text("Cancel")');
  }

  async clickTest(): Promise<void> {
    await this.page.click('button:has-text("TEST"), button:has-text("Test Tag")');
  }

  async clickDelete(): Promise<void> {
    await this.page.click('button:has-text("DELETE"), button:has-text("Delete Tag"), button[aria-label*="delete"]');
    const confirm = this.page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("DELETE")').last();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirm.click();
    }
  }

  async clickEdit(): Promise<void> {
    await this.page.click('button:has-text("EDIT"), button:has-text("Edit"), button[aria-label*="edit"]');
  }

  async clickDuplicate(): Promise<void> {
    await this.page.click('button:has-text("DUPLICATE"), button:has-text("Duplicate"), button[aria-label*="duplicate"]');
  }

  // ── Search & filter (on tag list) ─────────────────────────────────────────

  async searchTag(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"], input[type="search"]', query);
  }

  async filterByType(type: string): Promise<void> {
    await this.page.click(`button:has-text("${type}"), [class*="filter"]:has-text("${type}")`);
  }

  async sortBy(field: 'Name' | 'Date' | 'Type'): Promise<void> {
    const sortBtn = this.page.locator(`button:has-text("${field}"), [class*="sort"]:has-text("${field}")`).first();
    if (await sortBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortBtn.click();
    }
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  async assertTriggerError(): Promise<void> {
    await expect(this.page.locator('[class*="error"], .error-message, [class*="invalid"]').first()).toBeVisible();
  }

  async assertSaveSuccess(): Promise<void> {
    await expect(
      this.page.locator('text=saved, text=Tag created, text=success').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertTagInList(trigger: string): Promise<void> {
    await expect(this.page.locator(`text=${trigger}`).first()).toBeVisible({ timeout: 10000 });
  }

  async assertTagNotInList(trigger: string): Promise<void> {
    await expect(this.page.locator(`text=${trigger}`).first()).not.toBeVisible({ timeout: 5000 });
  }

  async assertEmptyState(): Promise<void> {
    await expect(
      this.page.locator('text=No tags, text=empty, text=Create your first').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertTagCount(expectedMin: number): Promise<void> {
    const cards = this.page.locator('[class*="tag-card"], [class*="tag-item"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(expectedMin);
  }

  async assertTestOutputVisible(): Promise<void> {
    await expect(
      this.page.locator('[class*="output"], [class*="test-result"], text=Output').first()
    ).toBeVisible({ timeout: 15000 });
  }

  async isTagFormVisible(): Promise<boolean> {
    return this.page.locator('[class*="create-tag"], [class*="tag-form"], form').first()
      .isVisible({ timeout: 5000 }).catch(() => false);
  }

  // ── Composite helpers ──────────────────────────────────────────────────────

  async createTextTag(trigger: string, description: string, content: string): Promise<void> {
    await this.selectTab('Text');
    await this.fillTrigger(trigger);
    await this.fillDescription(description);
    await this.fillTextContent(content);
    await this.clickSave();
  }

  async createAiTag(trigger: string, description: string, prompt: string): Promise<void> {
    await this.selectTab('AI');
    await this.fillTrigger(trigger);
    await this.fillDescription(description);
    await this.fillPromptData(prompt);
    await this.clickSave();
  }

  async createApiTag(trigger: string, description: string, url: string, method = 'GET'): Promise<void> {
    await this.selectTab('API');
    await this.fillTrigger(trigger);
    await this.fillDescription(description);
    await this.fillApiUrl(url);
    await this.selectApiMethod(method as 'GET');
    await this.clickSave();
  }
}
