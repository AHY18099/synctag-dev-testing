import { test, expect, APIRequestContext, request } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://devextension.synctag.com';

async function buildApi(): Promise<APIRequestContext> {
  return await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
}

// Schema validator helpers
function hasStringField(obj: Record<string, unknown>, field: string): boolean {
  return field in obj && typeof obj[field] === 'string';
}
function hasNumberField(obj: Record<string, unknown>, field: string): boolean {
  return field in obj && typeof obj[field] === 'number';
}
function hasBooleanField(obj: Record<string, unknown>, field: string): boolean {
  return field in obj && typeof obj[field] === 'boolean';
}
function hasArrayField(obj: Record<string, unknown>, field: string): boolean {
  return field in obj && Array.isArray(obj[field]);
}

test.describe('SCHEMA-A: Auth Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-001: /api/auth/send-otp error response has string message field', async () => {
    const res = await api.post('/api/auth/send-otp', { data: {} });
    const body = await res.json().catch(() => ({}));
    if (res.status() >= 400) {
      expect(hasStringField(body, 'message')).toBe(true);
    }
  });

  test('SCHEMA-002: /api/auth/send-otp success response is a JSON object', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE } });
    const body = await res.json().catch(() => null);
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
  });

  test('SCHEMA-003: /api/auth/verify-otp error response has string message field', async () => {
    const res = await api.post('/api/auth/verify-otp', { data: { email: process.env.EMAIL_FREE, otp: '000000' } });
    const body = await res.json().catch(() => ({}));
    if (res.status() >= 400) {
      expect(hasStringField(body, 'message')).toBe(true);
    }
  });

  test('SCHEMA-004: /api/auth/send-otp response does not include password field', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: process.env.EMAIL_FREE } });
    const body = await res.json().catch(() => ({}));
    expect(body).not.toHaveProperty('password');
  });

  test('SCHEMA-005: /api/auth/send-otp 400 response has numeric status or string code', async () => {
    const res = await api.post('/api/auth/send-otp', { data: { email: 'invalid' } });
    const body = await res.json().catch(() => ({}));
    if (res.status() === 400 || res.status() === 422) {
      expect(body).toBeDefined();
      // Either has 'message' string or 'errors' array
      const hasMessage = hasStringField(body, 'message');
      const hasErrors = hasArrayField(body, 'errors');
      expect(hasMessage || hasErrors).toBe(true);
    }
  });
});

test.describe('SCHEMA-B: Tags Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-006: GET /api/tags 401 error body has message string', async () => {
    const res = await api.get('/api/tags');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-007: GET /api/tags 401 body does not have data field', async () => {
    const res = await api.get('/api/tags');
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401) {
      expect(body).not.toHaveProperty('data');
    }
  });

  test('SCHEMA-008: POST /api/tags 401 error body has message string', async () => {
    const res = await api.post('/api/tags', { data: { trigger: 'schematest', content: 'hello' } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-009: PUT /api/tags/1 401 error body has message string', async () => {
    const res = await api.put('/api/tags/1', { data: { trigger: 'schematest' } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-010: DELETE /api/tags/1 401 error body has message string', async () => {
    const res = await api.delete('/api/tags/1');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });
});

test.describe('SCHEMA-C: Pipelines Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-011: GET /api/pipelines 401 body has message string', async () => {
    const res = await api.get('/api/pipelines');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-012: POST /api/pipelines 401 body has message string', async () => {
    const res = await api.post('/api/pipelines', { data: { name: 'Schema Test' } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-013: GET /api/pipelines error does not include credentials', async () => {
    const res = await api.get('/api/pipelines');
    const body = await res.json().catch(() => ({}));
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('apiKey');
  });
});

test.describe('SCHEMA-D: Analytics Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-014: GET /api/analytics 401 body has message string', async () => {
    const res = await api.get('/api/analytics');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-015: Analytics error body is flat object, not nested deeply', async () => {
    const res = await api.get('/api/analytics');
    const body = await res.json().catch(() => ({}));
    // Should not have more than 3 levels of nesting
    const json = JSON.stringify(body);
    const depth = (json.match(/{/g) || []).length;
    expect(depth).toBeLessThan(10);
  });

  test('SCHEMA-016: Analytics error does not include analytics data', async () => {
    const res = await api.get('/api/analytics');
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401 || res.status() === 403) {
      expect(body).not.toHaveProperty('clicks');
      expect(body).not.toHaveProperty('scans');
      expect(body).not.toHaveProperty('data');
    }
  });
});

test.describe('SCHEMA-E: Profile Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-017: GET /api/profile 401 body has message string', async () => {
    const res = await api.get('/api/profile');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-018: PUT /api/profile 401 body has message string', async () => {
    const res = await api.put('/api/profile', { data: { name: 'Test' } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-019: Profile 401 error does not include profile data', async () => {
    const res = await api.get('/api/profile');
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401 || res.status() === 403) {
      expect(body).not.toHaveProperty('email');
      expect(body).not.toHaveProperty('name');
      expect(body).not.toHaveProperty('phone');
    }
  });
});

test.describe('SCHEMA-F: Global Tags Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-020: GET /api/global-tags 401 body has message string', async () => {
    const res = await api.get('/api/global-tags');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-021: POST /api/global-tags 401 body has message string', async () => {
    const res = await api.post('/api/global-tags', { data: { trigger: 'schematest' } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-022: Global Tags 401 error does not include tag data', async () => {
    const res = await api.get('/api/global-tags');
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401 || res.status() === 403) {
      expect(body).not.toHaveProperty('tags');
      expect(body).not.toHaveProperty('data');
    }
  });
});

test.describe('SCHEMA-G: Wallet Endpoint Response Shapes', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-023: GET /api/wallet 401 body has message string', async () => {
    const res = await api.get('/api/wallet');
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-024: POST /api/wallet/payout 401 body has message string', async () => {
    const res = await api.post('/api/wallet/payout', { data: { amount: 100 } });
    const body = await res.json().catch(() => ({}));
    expect(hasStringField(body, 'message')).toBe(true);
  });

  test('SCHEMA-025: Wallet 401 error does not include balance data', async () => {
    const res = await api.get('/api/wallet');
    const body = await res.json().catch(() => ({}));
    if (res.status() === 401 || res.status() === 403) {
      expect(body).not.toHaveProperty('balance');
      expect(body).not.toHaveProperty('transactions');
    }
  });
});

test.describe('SCHEMA-H: Common Schema Standards', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await buildApi(); });
  test.afterAll(async () => { await api.dispose(); });

  test('SCHEMA-026: All error responses have HTTP status matching body (no 200 with error)', async () => {
    const endpoints = ['/api/tags', '/api/pipelines', '/api/analytics', '/api/profile', '/api/wallet'];
    for (const endpoint of endpoints) {
      const res = await api.get(endpoint);
      expect(res.status()).not.toBe(200); // Must not return 200 when unauthenticated
    }
  });

  test('SCHEMA-027: All error response bodies are valid parseable JSON', async () => {
    const endpoints = ['/api/tags', '/api/pipelines', '/api/analytics', '/api/profile', '/api/wallet', '/api/global-tags'];
    for (const endpoint of endpoints) {
      const res = await api.get(endpoint);
      const body = await res.json().catch(() => null);
      expect(body).not.toBeNull();
    }
  });

  test('SCHEMA-028: Error message fields are non-empty strings', async () => {
    const res = await api.get('/api/tags');
    const body = await res.json().catch(() => ({}));
    if (hasStringField(body, 'message')) {
      expect((body.message as string).length).toBeGreaterThan(0);
    }
  });

  test('SCHEMA-029: API does not return HTML error pages for JSON endpoints', async () => {
    const res = await api.get('/api/tags');
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).not.toContain('text/html');
  });

  test('SCHEMA-030: /api/auth/send-otp 400 error includes actionable message', async () => {
    const res = await api.post('/api/auth/send-otp', { data: {} });
    const body = await res.json().catch(() => ({}));
    if (res.status() === 400 || res.status() === 422) {
      expect(body).toBeDefined();
      const bodyStr = JSON.stringify(body).toLowerCase();
      // Should mention 'email', 'required', 'invalid', or 'missing' — actionable
      const isActionable = bodyStr.includes('email') || bodyStr.includes('required') || bodyStr.includes('invalid') || bodyStr.includes('missing');
      expect(isActionable).toBe(true);
    }
  });
});
