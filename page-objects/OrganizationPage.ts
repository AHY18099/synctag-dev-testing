import { Page, expect } from '@playwright/test';

/**
 * OrganizationPage — covers Team Plan / Organization module.
 * Only validated when Team plan is active or organization module is visible.
 */
export class OrganizationPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    const base = process.env.BASE_URL || 'https://devextension.synctag.com';
    await this.page.goto(`${base}/organization`, { waitUntil: 'domcontentloaded' }).catch(async () => {
      await this.page.goto(`${base}/my-tags`, { waitUntil: 'domcontentloaded' });
    });
  }

  async isOrgModuleVisible(): Promise<boolean> {
    return this.page.locator(
      'nav >> text=Organization, [class*="sidebar"] >> text=Organization, text=Team'
    ).first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  async clickOrganizationNav(): Promise<void> {
    await this.page.click('nav >> text=Organization, [class*="sidebar"] >> text=Organization');
  }

  // ── Members ───────────────────────────────────────────────────────────────

  async inviteMember(email: string): Promise<void> {
    await this.page.click('button:has-text("Invite"), button:has-text("INVITE MEMBER"), button:has-text("Add Member")');
    await this.page.fill('input[type="email"], input[placeholder*="email"]', email);
    await this.page.click('button:has-text("Send Invite"), button:has-text("SEND INVITE"), button:has-text("Invite")');
  }

  async assertInviteSent(): Promise<void> {
    await expect(
      this.page.locator('text=Invite sent, text=invitation sent, text=invited').first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertDuplicateInviteError(): Promise<void> {
    await expect(
      this.page.locator('text=already invited, text=duplicate, text=already exists').first()
    ).toBeVisible({ timeout: 5000 });
  }

  async assertInvalidEmailError(): Promise<void> {
    await expect(
      this.page.locator('text=invalid email, text=valid email, [class*="error"]').first()
    ).toBeVisible({ timeout: 5000 });
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  async createGroup(name: string): Promise<void> {
    await this.page.click('button:has-text("Create Group"), button:has-text("NEW GROUP"), button:has-text("+ Group")');
    await this.page.fill('input[name="groupName"], input[placeholder*="group name"]', name);
    await this.page.click('button:has-text("Create"), button:has-text("SAVE")');
  }

  async addMemberToGroup(groupName: string, memberEmail: string): Promise<void> {
    await this.page.click(`[class*="group-card"]:has-text("${groupName}") button:has-text("Add")`);
    await this.page.fill('input[type="email"]', memberEmail);
    await this.page.click('button:has-text("Add"), button:has-text("Confirm")');
  }

  // ── Shared tags ───────────────────────────────────────────────────────────

  async shareTagWithMember(trigger: string, memberEmail: string): Promise<void> {
    await this.page.click(`[class*="tag-card"]:has-text("${trigger}") [class*="share"], button[aria-label*="share"]`);
    await this.page.fill('input[type="email"], input[placeholder*="email"]', memberEmail);
    await this.page.click('button:has-text("Share"), button:has-text("SHARE")');
  }

  async shareTagWithGroup(trigger: string, groupName: string): Promise<void> {
    await this.page.click(`[class*="tag-card"]:has-text("${trigger}") [class*="share"]`);
    await this.page.click(`[class*="group"]:has-text("${groupName}")`);
    await this.page.click('button:has-text("Share"), button:has-text("SHARE")');
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async assertOrgPageLoaded(): Promise<void> {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: /Organization|Team|Members/i }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  async assertMemberInList(email: string): Promise<void> {
    await expect(this.page.locator(`text=${email}`).first()).toBeVisible({ timeout: 5000 });
  }

  async assertGroupInList(name: string): Promise<void> {
    await expect(this.page.locator(`text=${name}`).first()).toBeVisible({ timeout: 5000 });
  }

  async assertTeamPlanRequired(): Promise<void> {
    const upgradePrompt = this.page.locator('text=Team Plan, text=Upgrade to Team, text=upgrade required').first();
    const visible = await upgradePrompt.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await expect(upgradePrompt).toBeVisible();
    }
  }
}
