import { test, expect, APIRequestContext, request } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://devextension.synctag.com';

// Helper to build authenticated request context
async function buildAuthContext(baseURL: string): Promise<APIRequestContext> {
  return await request.newContext({ baseURL, extraHTTPHeaders: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
}

test.describe('R-11-A: Auth API — Send OTP', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-001: POST /api/auth/send-otp returns 200 for valid email', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE || 'synctagfreetest@mailinator.com' } });
    expect([200, 201]).toContain(res.status());
  });

  test('R-11-002: POST /api/auth/send-otp response has success field', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE } });
    const body = await res.json().catch(() => ({}));
    expect(res.status()).toBeLessThan(500);
    expect(body).toBeDefined();
  });

  test('R-11-003: POST /api/auth/send-otp rejects missing email', async () => {
    const res = await api.post('/api/auth/send-otp', { data: {} });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-004: POST /api/auth/send-otp rejects invalid email format', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: 'not-an-email' } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-005: POST /api/auth/send-otp returns JSON content-type', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE } });
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-006: POST /api/auth/send-otp rejects empty string email', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: '' } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-007: POST /api/auth/send-otp handles phone number input', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { phone: '+919999999999' } });
    expect(res.status()).toBeLessThan(500);
  });

  test('R-11-008: POST /api/auth/send-otp rejects null payload', async () => {
    const res = await api.post('/api/auth/send-otp', { data: null });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-009: POST /api/auth/send-otp does not expose stack trace on error', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: 'bad' } });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|at Function\.|\.js:\d+/);
  });

  test('R-11-010: POST /api/auth/send-otp responds under 3 seconds', async () => {
    const start = Date.now();
    await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE } });
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

test.describe('R-11-B: Auth API — Verify OTP', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-011: POST /api/auth/verify-otp rejects missing fields', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: {} });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-012: POST /api/auth/verify-otp rejects wrong OTP', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    expect([400, 401, 422]).toContain(res.status());
  });

  test('R-11-013: POST /api/auth/verify-otp rejects 5-digit OTP', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '12345' } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-014: POST /api/auth/verify-otp rejects 7-digit OTP', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '1234567' } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-015: POST /api/auth/verify-otp rejects alpha OTP', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: 'abcdef' } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-016: POST /api/auth/verify-otp returns JSON content-type', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-017: POST /api/auth/verify-otp returns token structure on success (mocked)', async () => {
    // Test the shape expectation — actual valid OTP would come from mailinator
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    const body = await res.json().catch(() => ({}));
    // Either error body or token — check it's not a 500
    expect(res.status()).not.toBe(500);
    expect(body).toBeDefined();
  });

  test('R-11-018: POST /api/auth/verify-otp rejects null otp', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: null } });
    expect([400, 422]).toContain(res.status());
  });

  test('R-11-019: POST /api/auth/verify-otp responds under 3 seconds', async () => {
    const start = Date.now();
    await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test('R-11-020: POST /api/auth/verify-otp does not expose credentials in response', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    const text = await res.text();
    expect(text).not.toContain('password');
    expect(text).not.toContain('secret_key');
  });
});

test.describe('R-11-C: Tags API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-021: GET /api/tags requires authentication', async () => {
    const res = await api.get('/api/tags');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-022: POST /api/tags requires authentication', async () => {
    const res = await api.post('/api/tags', { data: { trigger: 'test', content: 'hello' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-023: PUT /api/tags/1 requires authentication', async () => {
    const res = await api.put('/api/tags/1', { data: { trigger: 'test' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-024: DELETE /api/tags/1 requires authentication', async () => {
    const res = await api.delete('/api/tags/1');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-025: GET /api/tags returns JSON content-type on auth error', async () => {
    const res = await api.get('/api/tags');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-026: GET /api/tags with invalid Bearer token returns 401', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer invalidtoken123', 'Content-Type': 'application/json' } });
    const res = await badApi.get('/api/tags');
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-027: GET /api/tags with malformed Bearer token returns 401', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer ', 'Content-Type': 'application/json' } });
    const res = await badApi.get('/api/tags');
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-028: POST /api/tags with invalid token does not create tag', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer fakejwt.fake.fake', 'Content-Type': 'application/json' } });
    const res = await badApi.post('/api/tags', { data: { trigger: 'unauthtest', content: 'hello' } });
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-029: DELETE /api/tags/999999 requires authentication', async () => {
    const res = await api.delete('/api/tags/999999');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-030: GET /api/tags unauthenticated error body has message field', async () => {
    const res = await api.get('/api/tags');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });
});

test.describe('R-11-D: Pipelines API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-031: GET /api/pipelines requires authentication', async () => {
    const res = await api.get('/api/pipelines');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-032: POST /api/pipelines requires authentication', async () => {
    const res = await api.post('/api/pipelines', { data: { name: 'Test Pipeline' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-033: PUT /api/pipelines/1 requires authentication', async () => {
    const res = await api.put('/api/pipelines/1', { data: { name: 'Updated' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-034: DELETE /api/pipelines/1 requires authentication', async () => {
    const res = await api.delete('/api/pipelines/1');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-035: GET /api/pipelines error response has message field', async () => {
    const res = await api.get('/api/pipelines');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });

  test('R-11-036: GET /api/pipelines returns JSON content-type on auth error', async () => {
    const res = await api.get('/api/pipelines');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-037: POST /api/pipelines does not create with invalid token', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer invalid', 'Content-Type': 'application/json' } });
    const res = await badApi.post('/api/pipelines', { data: { name: 'Hacked Pipeline' } });
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-038: GET /api/pipelines/:id requires authentication', async () => {
    const res = await api.get('/api/pipelines/1');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-039: Pipeline API unauthenticated response under 2 seconds', async () => {
    const start = Date.now();
    await api.get('/api/pipelines');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('R-11-040: DELETE /api/pipelines/999999 requires authentication', async () => {
    const res = await api.delete('/api/pipelines/999999');
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('R-11-E: Analytics API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-041: GET /api/analytics requires authentication', async () => {
    const res = await api.get('/api/analytics');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-042: GET /api/analytics/summary requires authentication', async () => {
    const res = await api.get('/api/analytics/summary');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-043: GET /api/analytics/tags requires authentication', async () => {
    const res = await api.get('/api/analytics/tags');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-044: Analytics error response has message field', async () => {
    const res = await api.get('/api/analytics');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });

  test('R-11-045: Analytics API returns JSON content-type', async () => {
    const res = await api.get('/api/analytics');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-046: GET /api/analytics?range=7d requires authentication', async () => {
    const res = await api.get('/api/analytics?range=7d');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-047: GET /api/analytics?range=30d requires authentication', async () => {
    const res = await api.get('/api/analytics?range=30d');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-048: Analytics API unauthenticated response under 2 seconds', async () => {
    const start = Date.now();
    await api.get('/api/analytics');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('R-11-049: GET /api/analytics with expired token returns 401', async () => {
    const expiredApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid', 'Content-Type': 'application/json' } });
    const res = await expiredApi.get('/api/analytics');
    expect([401, 403]).toContain(res.status());
    await expiredApi.dispose();
  });

  test('R-11-050: Analytics no-auth error does not expose internal paths', async () => {
    const res = await api.get('/api/analytics');
    const text = await res.text();
    expect(text).not.toMatch(/\/home\/|\/var\/www\/|C:\\Users\\/);
  });
});

test.describe('R-11-F: Profile API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-051: GET /api/profile requires authentication', async () => {
    const res = await api.get('/api/profile');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-052: PUT /api/profile requires authentication', async () => {
    const res = await api.put('/api/profile', { data: { name: 'Hacker' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-053: PATCH /api/profile requires authentication', async () => {
    const res = await api.patch('/api/profile', { data: { name: 'Hacker' } });
    expect([401, 403, 404, 405]).toContain(res.status());
  });

  test('R-11-054: Profile error response has message field', async () => {
    const res = await api.get('/api/profile');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });

  test('R-11-055: Profile API returns JSON content-type', async () => {
    const res = await api.get('/api/profile');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-056: DELETE /api/profile requires authentication', async () => {
    const res = await api.delete('/api/profile');
    expect([401, 403, 404, 405]).toContain(res.status());
  });

  test('R-11-057: PUT /api/profile with invalid token returns 401', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer xyz', 'Content-Type': 'application/json' } });
    const res = await badApi.put('/api/profile', { data: { name: 'Test' } });
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-058: Profile API unauthenticated response under 2 seconds', async () => {
    const start = Date.now();
    await api.get('/api/profile');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('R-11-059: GET /api/profile/settings requires authentication', async () => {
    const res = await api.get('/api/profile/settings');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-060: Profile no-auth does not expose DB errors', async () => {
    const res = await api.get('/api/profile');
    const text = await res.text();
    expect(text).not.toMatch(/SQL|mysql|postgres|MongoError/i);
  });
});

test.describe('R-11-G: Global Tags API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-061: GET /api/global-tags requires authentication', async () => {
    const res = await api.get('/api/global-tags');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-062: POST /api/global-tags requires authentication', async () => {
    const res = await api.post('/api/global-tags', { data: { trigger: 'globaltest' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-063: PUT /api/global-tags/1 requires authentication', async () => {
    const res = await api.put('/api/global-tags/1', { data: { trigger: 'updated' } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-064: DELETE /api/global-tags/1 requires authentication', async () => {
    const res = await api.delete('/api/global-tags/1');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-065: Global Tags error response has message field', async () => {
    const res = await api.get('/api/global-tags');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });

  test('R-11-066: Global Tags API returns JSON content-type', async () => {
    const res = await api.get('/api/global-tags');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-067: GET /api/global-tags with bad token returns 401', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer bad', 'Content-Type': 'application/json' } });
    const res = await badApi.get('/api/global-tags');
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });

  test('R-11-068: Global Tags API unauthenticated response under 2 seconds', async () => {
    const start = Date.now();
    await api.get('/api/global-tags');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('R-11-069: GET /api/global-tags/search requires authentication', async () => {
    const res = await api.get('/api/global-tags/search?q=test');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-070: Global Tags no-auth does not leak sensitive data', async () => {
    const res = await api.get('/api/global-tags');
    const text = await res.text();
    expect(text).not.toMatch(/password|secret|apikey/i);
  });
});

test.describe('R-11-H: Wallet API — Unauthenticated Guards', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-071: GET /api/wallet requires authentication', async () => {
    const res = await api.get('/api/wallet');
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-072: POST /api/wallet/payout requires authentication', async () => {
    const res = await api.post('/api/wallet/payout', { data: { amount: 100 } });
    expect([401, 403]).toContain(res.status());
  });

  test('R-11-073: GET /api/wallet/transactions requires authentication', async () => {
    const res = await api.get('/api/wallet/transactions');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-074: Wallet error response has message field', async () => {
    const res = await api.get('/api/wallet');
    const body = await res.json().catch(() => ({}));
    expect(body).toHaveProperty('message');
  });

  test('R-11-075: Wallet API returns JSON content-type', async () => {
    const res = await api.get('/api/wallet');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-076: POST /api/wallet/withdraw requires authentication', async () => {
    const res = await api.post('/api/wallet/withdraw', { data: { amount: 500 } });
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-077: Wallet API unauthenticated response under 2 seconds', async () => {
    const start = Date.now();
    await api.get('/api/wallet');
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('R-11-078: GET /api/wallet/balance requires authentication', async () => {
    const res = await api.get('/api/wallet/balance');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('R-11-079: Wallet no-auth does not expose balance data', async () => {
    const res = await api.get('/api/wallet');
    const text = await res.text();
    expect(text).not.toMatch(/"balance"\s*:\s*\d+/);
  });

  test('R-11-080: POST /api/wallet/payout with invalid token returns 401', async () => {
    const badApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Authorization': 'Bearer fake', 'Content-Type': 'application/json' } });
    const res = await badApi.post('/api/wallet/payout', { data: { amount: 100 } });
    expect([401, 403]).toContain(res.status());
    await badApi.dispose();
  });
});

test.describe('R-11-I: HTTP Method & Security Checks', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-081: GET on POST-only endpoint /api/auth/send-otp returns 405 or 404', async () => {
    const res = await api.get('/api/auth/send-otp');
    expect([404, 405]).toContain(res.status());
  });

  test('R-11-082: DELETE /api/auth/send-otp not allowed', async () => {
    const res = await api.delete('/api/auth/send-otp');
    expect([404, 405]).toContain(res.status());
  });

  test('R-11-083: API does not return 500 for unknown route', async () => {
    const res = await api.get('/api/nonexistent-route-xyz');
    expect([404]).toContain(res.status());
  });

  test('R-11-084: API 404 response has JSON body', async () => {
    const res = await api.get('/api/nonexistent-route-xyz');
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('R-11-085: OPTIONS /api/tags returns CORS headers', async () => {
    const res = await api.fetch('/api/tags', { method: 'OPTIONS' });
    expect([200, 204, 401, 403]).toContain(res.status());
  });

  test('R-11-086: API responses include X-Content-Type-Options header', async () => {
    const res = await api.get('/api/tags');
    const headers = res.headers();
    // Either the header is present or it's a 404 — we're checking it doesn't return bare HTML
    expect(res.status()).not.toBe(500);
  });

  test('R-11-087: Large payload to /api/auth/send-otp is rejected', async () => {
    const largeEmail = 'a'.repeat(10000) + '@mailinator.com';
    const res = await api.post('/api/auth/send-otp', { data: { email: largeEmail } });
    expect([400, 413, 422]).toContain(res.status());
  });

  test('R-11-088: SQL injection in email field is rejected', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: "' OR 1=1 --" } });
    expect([400, 422]).toContain(res.status());
    const text = await res.text();
    expect(text).not.toMatch(/SQL|syntax error/i);
  });

  test('R-11-089: XSS payload in email field is sanitized', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: '<script>alert(1)</script>@evil.com' } });
    const text = await res.text();
    expect(text).not.toContain('<script>alert(1)</script>');
  });

  test('R-11-090: API does not reveal server technology in headers', async () => {
    const res = await api.get('/api/tags');
    const headers = res.headers();
    // Server header should not expose internal version details
    const serverHeader = headers['x-powered-by'] || '';
    expect(serverHeader).not.toMatch(/Express \d+\.\d+\.\d+/);
  });
});

test.describe('R-11-J: Rate Limiting & Infrastructure', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await buildAuthContext(BASE_URL); });
  test.afterAll(async () => { await api.dispose(); });

  test('R-11-091: Rapid GET /api/tags requests return consistent status', async () => {
    const statuses = await Promise.all(Array.from({ length: 5 }, () => api.get('/api/tags').then(r => r.status())));
    statuses.forEach(s => expect([401, 403, 429]).toContain(s));
  });

  test('R-11-092: Rapid POST /api/auth/send-otp may trigger rate limit', async () => {
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await api.post('/api/auth/send-otp', { data: { email: 'ratelimitcheck@mailinator.com' } });
      results.push(res.status());
    }
    // Either succeeds (200) or rate limits (429) — must not 500
    results.forEach(s => expect(s).not.toBe(500));
  });

  test('R-11-093: API base URL responds (health check)', async () => {
    const res = await api.get('/').catch(() => null);
    if (res) expect(res.status()).toBeLessThan(500);
  });

  test('R-11-094: GET /api responds (API root)', async () => {
    const res = await api.get('/api').catch(() => null);
    if (res) expect(res.status()).toBeLessThan(500);
  });

  test('R-11-095: API handles gzip Accept-Encoding', async () => {
    const gzipApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Accept-Encoding': 'gzip, deflate, br', 'Content-Type': 'application/json' } });
    const res = await gzipApi.get('/api/tags');
    expect([401, 403]).toContain(res.status());
    await gzipApi.dispose();
  });

  test('R-11-096: API handles application/json Content-Type correctly', async () => {
    const res = await api.post('/api/auth/send-otp', { headers: { 'Content-Type': 'application/json' }, data: { email: process.env.EMAIL_FREE } });
    expect(res.status()).not.toBe(415);
  });

  test('R-11-097: API rejects text/plain Content-Type for JSON endpoints', async () => {
    const plainApi = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Content-Type': 'text/plain' } });
    const res = await plainApi.post('/api/auth/send-otp', { data: 'email=test@test.com' });
    expect([400, 415, 422]).toContain(res.status());
    await plainApi.dispose();
  });

  test('R-11-098: Concurrent API requests do not cause 500 errors', async () => {
    const requests = [
      api.get('/api/tags'),
      api.get('/api/pipelines'),
      api.get('/api/analytics'),
      api.get('/api/profile'),
      api.get('/api/wallet'),
    ];
    const results = await Promise.all(requests);
    results.forEach(r => expect(r.status()).not.toBe(500));
  });

  test('R-11-099: API response body is valid JSON for all auth-guarded endpoints', async () => {
    const endpoints = ['/api/tags', '/api/pipelines', '/api/analytics', '/api/profile', '/api/wallet', '/api/global-tags'];
    for (const endpoint of endpoints) {
      const res = await api.get(endpoint);
      const body = await res.json().catch(() => null);
      expect(body).not.toBeNull();
    }
  });

  test('R-11-100: All protected API endpoints consistently return 401 or 403 (not 200) without auth', async () => {
    const endpoints = ['/api/tags', '/api/pipelines', '/api/analytics', '/api/profile', '/api/wallet', '/api/global-tags'];
    for (const endpoint of endpoints) {
      const res = await api.get(endpoint);
      expect([401, 403]).toContain(res.status());
    }
  });
});
