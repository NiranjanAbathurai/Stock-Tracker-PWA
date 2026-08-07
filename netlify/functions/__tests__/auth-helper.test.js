import { describe, it, expect, beforeEach, afterAll } from 'vitest';

// We test the rate limiter and validation logic directly
// Auth verification requires Supabase and is tested via integration

// Import the module — vitest handles CJS/ESM interop
import { checkRateLimit, validatePayload, getOriginHeader } from '../auth-helper.js';

describe('checkRateLimit', () => {
  // Each test uses a unique userId to avoid cross-test pollution
  let userId;

  beforeEach(() => {
    userId = `test-user-${Date.now()}-${Math.random()}`;
  });

  it('allows the first request', () => {
    const result = checkRateLimit(userId, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows exactly maxRequests requests', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(userId, 5, 60000);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the request after maxRequests exceeded', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, 5, 60000);
    }
    const blocked = checkRateLimit(userId, 5, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('returns resetIn as positive number when blocked', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId, 5, 60000);
    }
    const blocked = checkRateLimit(userId, 5, 60000);
    expect(blocked.resetIn).toBeGreaterThan(0);
    expect(blocked.resetIn).toBeLessThanOrEqual(60000);
  });

  it('resets after window expires', () => {
    // Use a very short window (1ms) to simulate expiry
    checkRateLimit(userId, 1, 1);

    // Wait a tiny bit for the window to expire
    const start = Date.now();
    while (Date.now() - start < 2) { /* busy wait */ }

    const result = checkRateLimit(userId, 1, 1);
    expect(result.allowed).toBe(true);
  });

  it('tracks different users independently', () => {
    const user1 = `user1-${Date.now()}`;
    const user2 = `user2-${Date.now()}`;

    // Exhaust user1's limit
    for (let i = 0; i < 3; i++) {
      checkRateLimit(user1, 3, 60000);
    }
    const user1Blocked = checkRateLimit(user1, 3, 60000);
    expect(user1Blocked.allowed).toBe(false);

    // user2 should still be allowed
    const user2Result = checkRateLimit(user2, 3, 60000);
    expect(user2Result.allowed).toBe(true);
  });
});

describe('validatePayload', () => {
  it('accepts valid JSON within size limit', () => {
    const event = { body: JSON.stringify({ text: 'hello' }) };
    const result = validatePayload(event, 1024);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects payload exceeding size limit', () => {
    const largeBody = JSON.stringify({ data: 'x'.repeat(2000) });
    const event = { body: largeBody };
    const result = validatePayload(event, 100); // 100 byte limit
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('rejects invalid JSON', () => {
    const event = { body: 'not valid json {{{' };
    const result = validatePayload(event, 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('accepts empty body as valid JSON', () => {
    const event = { body: '{}' };
    const result = validatePayload(event, 1024);
    expect(result.valid).toBe(true);
  });
});

describe('getOriginHeader', () => {
  const originalEnv = process.env.APP_URL;

  beforeEach(() => {
    // Reset env between tests
    delete process.env.APP_URL;
  });

  // Restore after all tests
  afterAll(() => {
    if (originalEnv) process.env.APP_URL = originalEnv;
    else delete process.env.APP_URL;
  });

  it('returns * when APP_URL is not set (dev mode)', () => {
    const event = { headers: { origin: 'http://localhost:5173' } };
    const result = getOriginHeader(event);
    expect(result).toBe('*');
  });

  it('returns the request origin when it matches APP_URL', () => {
    process.env.APP_URL = 'https://myapp.netlify.app';
    // Re-import won't help since module is cached, but getOriginHeader reads env at call time
    const event = { headers: { origin: 'https://myapp.netlify.app' } };
    const result = getOriginHeader(event);
    expect(result).toBe('https://myapp.netlify.app');
  });

  it('returns first allowed origin when request origin does not match', () => {
    process.env.APP_URL = 'https://myapp.netlify.app';
    const event = { headers: { origin: 'https://evil.com' } };
    const result = getOriginHeader(event);
    expect(result).toBe('https://myapp.netlify.app');
  });

  it('supports comma-separated multiple origins', () => {
    process.env.APP_URL = 'https://myapp.netlify.app,http://localhost:5173';
    const event = { headers: { origin: 'http://localhost:5173' } };
    const result = getOriginHeader(event);
    expect(result).toBe('http://localhost:5173');
  });
});
