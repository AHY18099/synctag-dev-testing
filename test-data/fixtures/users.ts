/**
 * Test user data fixtures for Synctag E2E automation.
 * All emails use @mailinator.com for OTP-based login.
 * Sensitive values are read from .env; defaults are safe fallbacks.
 */

export const TEST_USERS = {
  free: {
    email:    process.env.EMAIL_FREE    || 'synctagfreetest@mailinator.com',
    plan:     'Free',
    tagLimit: 5000,
  },
  pro: {
    email:    process.env.EMAIL_PRO     || 'synctagprotest@mailinator.com',
    plan:     'Pro',
    tagLimit: 35000,
  },
  team: {
    email:    process.env.EMAIL_TEAM    || 'synctagteamtest@mailinator.com',
    plan:     'Team',
    tagLimit: 100000,
  },
  auth: {
    email:    process.env.EMAIL_AUTH    || 'synctagauthtest@mailinator.com',
    plan:     'Free',
  },
  payment: {
    email:    process.env.EMAIL_PAYMENT || 'synctagpaytest@mailinator.com',
    plan:     'Free',
  },
};

export const SIGNUP_PROFILES = {
  default: {
    firstName: 'QA',
    lastName:  'Tester',
    company:   'Synctag QA',
  },
  profile_update: {
    firstName: 'Updated',
    lastName:  'Name',
    company:   'Updated Corp',
  },
};

export const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'TestPass@1234';

export function generateEmail(prefix = 'synctag-qa'): string {
  return `${prefix}-${Date.now()}@mailinator.com`;
}

export function generateUniqueEmail(module: string): string {
  return `synctag-${module}-${Date.now()}@mailinator.com`;
}
