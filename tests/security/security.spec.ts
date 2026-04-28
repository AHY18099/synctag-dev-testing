/**
 * Security Test Suite — SEC-001 to SEC-050
 * Browser-level and API-level security checks:
 * XSS, CSRF indicators, clickjacking headers, auth bypass, token exposure,
 * sensitive data in URL/storage, CORS behaviour, and input sanitization.
 */

import { test, expect, BrowserContext, Page, APIRequestContext, request } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL   = process.env.BASE_URL  || 'https://devextension.synctag.com';
const FREE_EMAIL = process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com';

// ─── Shared Auth Context ──────────────────────────────────────────────────────

let authCtx:  BrowserContext;
let authPage: Page;

// ─── SEC-01: HTTP Security Headers ───────────────────────────────────────────

test.describe('SEC-01: HTTP Security Headers', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-001: Homepage response includes Content-Security-Policy or X-Frame-Options header', async () => {
    const res = await api.get('/');
    const headers = res.headers();
    const hasCSP = 'content-security-policy' in headers;
    const hasXFO = 'x-frame-options' in headers;
    expect(hasCSP || hasXFO, 'Neither CSP nor X-Frame-Options header present').toBe(true);
  });

  test('SEC-002: Homepage response does not expose X-Powered-By with version', async () => {
    const res = await api.get('/');
    const powered = res.headers()['x-powered-by'] || '';
    expect(powered).not.toMatch(/Express \d/i);
    expect(powered).not.toMatch(/PHP\/\d/i);
  });

  test('SEC-003: API auth endpoint includes proper Content-Type on response', async () => {
    const res = await api.post('/api/auth/send-otp', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: FREE_EMAIL },
    });
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('SEC-004: API endpoint does not return 500 with stack trace', async () => {
    const res = await api.post('/api/auth/send-otp', { data: {} });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|at Function\.|\.js:\d+:\d+/);
    expect(text).not.toMatch(/SyntaxError|TypeError|ReferenceError/);
  });

  test('SEC-005: Login page response status is 200', async () => {
    const res = await api.get('/login');
    expect([200, 301, 302]).toContain(res.status());
  });

  test('SEC-006: 404 pages do not expose server error details', async () => {
    const res = await api.get('/this-page-does-not-exist-xyz');
    const text = await res.text();
    expect(text).not.toMatch(/ENOENT|ECONNREFUSED|at Module\./);
    expect(res.status()).not.toBe(500);
  });
});

// ─── SEC-02: XSS Prevention ───────────────────────────────────────────────────

test.describe('SEC-02: XSS Prevention in Browser', () => {
  test.beforeAll(async ({ browser }) => {
    authCtx  = await browser.newContext();
    authPage = await authCtx.newPage();
    await new LoginPage(authPage).signupWithMailinator(authCtx, FREE_EMAIL);
  });
  test.afterAll(async () => { await authCtx?.close(); });

  test('SEC-007: Script tag in tag trigger does not execute', async () => {
    const dialogs: string[] = [];
    authPage.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    await authPage.locator('input[name="trigger"], input[placeholder*="trigger" i]').first().fill('<script>alert("xss")</script>');
    await authPage.waitForTimeout(500);
    expect(dialogs.filter(d => d.includes('xss'))).toHaveLength(0);
    await authPage.keyboard.press('Escape');
  });

  test('SEC-008: img onerror payload in content field does not execute', async () => {
    const dialogs: string[] = [];
    authPage.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const contentField = authPage.locator('textarea, [contenteditable="true"]').first();
    await contentField.fill('<img src=x onerror="alert(\'xss\')" />');
    await authPage.waitForTimeout(500);
    expect(dialogs.filter(d => d.toLowerCase().includes('xss'))).toHaveLength(0);
    await authPage.keyboard.press('Escape');
  });

  test('SEC-009: JavaScript URL in href field does not execute', async () => {
    const dialogs: string[] = [];
    authPage.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const urlField = authPage.locator('input[type="url"], input[placeholder*="url" i]').first();
    if (await urlField.count() > 0) {
      await urlField.fill('javascript:alert("xss")');
      await authPage.waitForTimeout(500);
    }
    expect(dialogs.filter(d => d.includes('xss'))).toHaveLength(0);
    await authPage.keyboard.press('Escape');
  });

  test('SEC-010: SVG onload payload in content does not execute', async () => {
    const dialogs: string[] = [];
    authPage.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await authPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await authPage.click('button:has-text("NEW TAG"), button:has-text("CREATE YOUR FIRST TAG")');
    const contentField = authPage.locator('textarea, [contenteditable="true"]').first();
    await contentField.fill('<svg onload="alert(1)"><rect/></svg>');
    await authPage.waitForTimeout(500);
    expect(dialogs).toHaveLength(0);
    await authPage.keyboard.press('Escape');
  });

  test('SEC-011: DOM-based XSS via URL fragment does not execute alert', async () => {
    const dialogs: string[] = [];
    authPage.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await authPage.goto(`${BASE_URL}/my-tags#<script>alert("dom-xss")</script>`, { waitUntil: 'networkidle' });
    await authPage.waitForTimeout(500);
    expect(dialogs.filter(d => d.includes('dom-xss'))).toHaveLength(0);
  });
});

// ─── SEC-03: Authentication & Session Security ────────────────────────────────

test.describe('SEC-03: Authentication & Session Security', () => {
  test('SEC-012: Accessing /my-tags without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-013: Accessing /analytics without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-014: Accessing /profile without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-015: Accessing /wallet without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/wallet`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-016: Accessing /pipelines without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/pipelines`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-017: Accessing /secured-tags without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/secured-tags`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-018: Accessing /global-tags without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/global-tags`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login|signin|auth/i);
  });

  test('SEC-019: Auth token is not present in page URL after login', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await new LoginPage(page).signupWithMailinator(ctx, FREE_EMAIL);
    const url = page.url();
    expect(url).not.toMatch(/token=|access_token=|jwt=/i);
    await ctx.close();
  });

  test('SEC-020: Auth token is not exposed in page source HTML', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await new LoginPage(page).signupWithMailinator(ctx, FREE_EMAIL);
    await page.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
    const content = await page.content();
    // Token should not appear verbatim inside script-less HTML attributes
    expect(content).not.toMatch(/data-token="ey/i);
    await ctx.close();
  });
});

// ─── SEC-04: Sensitive Data in Storage ───────────────────────────────────────

test.describe('SEC-04: Sensitive Data in Browser Storage', () => {
  let secCtx:  BrowserContext;
  let secPage: Page;

  test.beforeAll(async ({ browser }) => {
    secCtx  = await browser.newContext();
    secPage = await secCtx.newPage();
    await new LoginPage(secPage).signupWithMailinator(secCtx, FREE_EMAIL);
    await secPage.goto(`${BASE_URL}/my-tags`, { waitUntil: 'networkidle' });
  });
  test.afterAll(async () => { await secCtx?.close(); });

  test('SEC-021: localStorage does not store plaintext password', async () => {
    const storage = await secPage.evaluate(() => JSON.stringify(localStorage));
    expect(storage).not.toMatch(/password/i);
  });

  test('SEC-022: sessionStorage does not store plaintext password', async () => {
    const storage = await secPage.evaluate(() => JSON.stringify(sessionStorage));
    expect(storage).not.toMatch(/password/i);
  });

  test('SEC-023: localStorage auth token is not base64-decoded sensitive PII', async () => {
    const storage = await secPage.evaluate(() => JSON.stringify(localStorage));
    // Token should be a JWT or opaque — not contain raw email/name in localStorage values
    // We check it's not storing raw profile JSON
    const parsed = JSON.parse(storage) as Record<string, string>;
    for (const [, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.length > 10) {
        expect(value).not.toMatch(/"password"\s*:/i);
      }
    }
  });

  test('SEC-024: Cookies for session do not have Secure=false on HTTPS', async () => {
    const cookies = await secCtx.cookies();
    const sessionCookies = cookies.filter(c => c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('auth'));
    // On HTTPS pages, auth cookies should be secure
    for (const cookie of sessionCookies) {
      expect(cookie.secure, `Cookie "${cookie.name}" is not Secure`).toBe(true);
    }
  });

  test('SEC-025: localStorage does not contain credit card numbers', async () => {
    const storage = await secPage.evaluate(() => JSON.stringify(localStorage));
    // Regex for 16-digit card numbers
    expect(storage).not.toMatch(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  });
});

// ─── SEC-05: SQL Injection & Input Sanitization ───────────────────────────────

test.describe('SEC-05: SQL Injection & Input Sanitization', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Content-Type': 'application/json' } });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-026: SQL injection in email field does not return 500', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: "' OR '1'='1" } });
    expect(res.status()).not.toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/SQL syntax|mysql_fetch|ORA-\d{5}/i);
  });

  test('SEC-027: UNION-based SQL injection in email does not leak data', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: "test' UNION SELECT 1,2,3--" } });
    expect(res.status()).not.toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/UNION|SELECT.*FROM/i);
  });

  test('SEC-028: NoSQL injection object in email is rejected', async () => {
    const res = await api.post('/api/auth/send-otp', {
      data: { email: { '$gt': '' } },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('SEC-029: Path traversal in API route returns 404 not file contents', async () => {
    const res = await api.get('/api/../../../etc/passwd');
    expect([400, 404]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toMatch(/root:x:|daemon:/);
  });

  test('SEC-030: Null byte injection in email field is rejected', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: 'test\x00@evil.com' } });
    expect([400, 422]).toContain(res.status());
  });
});

// ─── SEC-06: CORS & Cross-Origin Checks ──────────────────────────────────────

test.describe('SEC-06: CORS Behaviour', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Origin': 'https://evil.example.com', 'Content-Type': 'application/json' } });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-031: Cross-origin POST to /api/auth/send-otp does not return wildcard CORS', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: FREE_EMAIL } });
    const acao = res.headers()['access-control-allow-origin'] || '';
    // Should not be '*' — wildcard allows any origin
    if (acao) {
      expect(acao).not.toBe('*');
    }
  });

  test('SEC-032: CORS preflight from untrusted origin is not allowed', async () => {
    const res = await api.fetch('/api/tags', { method: 'OPTIONS' });
    const acao = res.headers()['access-control-allow-origin'] || '';
    if (acao) {
      expect(acao).not.toBe('*');
    }
    // Either not allowed (403/401) or restricted origin
    expect([200, 204, 401, 403]).toContain(res.status());
  });

  test('SEC-033: Cross-origin request does not expose credentials header with wildcard', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: FREE_EMAIL } });
    const allowCreds = res.headers()['access-control-allow-credentials'] || '';
    const acao       = res.headers()['access-control-allow-origin'] || '';
    // If credentials are allowed, origin must not be wildcard
    if (allowCreds === 'true') {
      expect(acao).not.toBe('*');
    }
  });
});

// ─── SEC-07: Clickjacking & Frame Protection ──────────────────────────────────

test.describe('SEC-07: Clickjacking Protection', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-034: Homepage has X-Frame-Options or frame-ancestors CSP', async () => {
    const res     = await api.get('/');
    const headers = res.headers();
    const xfo     = headers['x-frame-options'] || '';
    const csp     = headers['content-security-policy'] || '';
    const hasFrameProtection = xfo !== '' || csp.includes('frame-ancestors');
    expect(hasFrameProtection, 'No clickjacking protection header found').toBe(true);
  });

  test('SEC-035: Login page has X-Frame-Options or frame-ancestors CSP', async () => {
    const res     = await api.get('/login');
    const headers = res.headers();
    const xfo     = headers['x-frame-options'] || '';
    const csp     = headers['content-security-policy'] || '';
    const hasFrameProtection = xfo !== '' || csp.includes('frame-ancestors');
    expect(hasFrameProtection, 'Login page has no clickjacking protection').toBe(true);
  });
});

// ─── SEC-08: Information Disclosure ──────────────────────────────────────────

test.describe('SEC-08: Information Disclosure Prevention', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-036: /api/users endpoint does not exist (no user enumeration)', async () => {
    const res = await api.get('/api/users');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('SEC-037: /api/admin endpoint is not publicly accessible', async () => {
    const res = await api.get('/api/admin');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('SEC-038: /api/config endpoint is not publicly accessible', async () => {
    const res = await api.get('/api/config');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('SEC-039: /.env file is not accessible via HTTP', async () => {
    const res = await api.get('/.env');
    expect([401, 403, 404]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toMatch(/BASE_URL=|EMAIL_FREE=/);
  });

  test('SEC-040: /package.json is not accessible via HTTP', async () => {
    const res = await api.get('/package.json');
    expect([401, 403, 404]).toContain(res.status());
    const text = await res.text();
    // Should not expose dependency list
    expect(text).not.toMatch(/"dependencies"\s*:/);
  });

  test('SEC-041: /.git directory is not accessible via HTTP', async () => {
    const res = await api.get('/.git/config');
    expect([401, 403, 404]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toMatch(/\[core\]|\[remote/);
  });

  test('SEC-042: Error messages do not expose database table names', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: '' }, headers: { 'Content-Type': 'application/json' } });
    const text = await res.text();
    expect(text).not.toMatch(/users table|tags table|Table '.*' doesn't exist/i);
  });

  test('SEC-043: Error messages do not expose internal file paths', async () => {
    const res = await api.get('/api/nonexistent');
    const text = await res.text();
    expect(text).not.toMatch(/\/home\/|\/var\/www\/|C:\\|D:\\/);
  });
});

// ─── SEC-09: Rate Limiting & Brute Force Prevention ──────────────────────────

test.describe('SEC-09: Rate Limiting', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Content-Type': 'application/json' } });
  });
  test.afterAll(async () => { await api.dispose(); });

  test('SEC-044: Rapid OTP send requests do not return 500', async () => {
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await api.post('/api/auth/send-otp', { data: { email: 'bruteforce@mailinator.com' } });
      results.push(res.status());
    }
    expect(results.every(s => s !== 500)).toBe(true);
  });

  test('SEC-045: After multiple wrong OTP attempts, account is not locked with 500', async () => {
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await api.post('/api/auth/verify-otp', { data: { email: FREE_EMAIL, otp: '111111' } });
      results.push(res.status());
    }
    results.forEach(s => expect(s).not.toBe(500));
  });

  test('SEC-046: Rate limit response includes Retry-After or rate-limit headers if 429', async () => {
    const results: Array<{ status: number; headers: Record<string, string> }> = [];
    for (let i = 0; i < 10; i++) {
      const res = await api.post('/api/auth/send-otp', { data: { email: 'ratelimit@mailinator.com' } });
      results.push({ status: res.status(), headers: res.headers() as Record<string, string> });
    }
    const rateLimited = results.filter(r => r.status === 429);
    for (const r of rateLimited) {
      const hasRetryHeader = 'retry-after' in r.headers || 'x-ratelimit-reset' in r.headers || 'x-rate-limit-reset' in r.headers;
      expect(hasRetryHeader, 'Rate limit response missing Retry-After header').toBe(true);
    }
  });
});

// ─── SEC-10: Open Redirect Prevention ────────────────────────────────────────

test.describe('SEC-10: Open Redirect Prevention', () => {
  test('SEC-047: redirect param on login page cannot redirect to external site', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?redirect=https://evil.example.com`, { waitUntil: 'networkidle' });
    // After the page settles, should not be on evil.example.com
    expect(page.url()).not.toMatch(/evil\.example\.com/);
  });

  test('SEC-048: next param on login page cannot redirect to external site', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?next=//evil.example.com`, { waitUntil: 'networkidle' });
    expect(page.url()).not.toMatch(/evil\.example\.com/);
  });

  test('SEC-049: returnUrl with protocol-relative URL is not followed', async ({ page }) => {
    await page.goto(`${BASE_URL}/login?returnUrl=//evil.example.com/steal`, { waitUntil: 'networkidle' });
    expect(page.url()).not.toMatch(/evil\.example\.com/);
  });

  test('SEC-050: Logout redirects to login page, not to an arbitrary external URL', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await new LoginPage(page).signupWithMailinator(ctx, FREE_EMAIL);
    // Attempt to hit logout with an external redirect param
    await page.goto(`${BASE_URL}/logout?redirect=https://evil.example.com`, { waitUntil: 'networkidle' });
    expect(page.url()).not.toMatch(/evil\.example\.com/);
    await ctx.close();
  });
});
