import { describe, it, expect, beforeEach, vi } from 'vitest';

// We can't import auth-helper directly (it requires dotenv and supabase at module level).
// Instead, we replicate the pure rate-limit logic for testing.
// This tests the ALGORITHM, not the integration.

// Extracted rate-limit logic (mirrors auth-helper.js lines 59-95)
function createRateLimiter() {
  const store = new Map();

  return function checkRateLimit(userId, maxRequests = 20, windowMs = 60 * 60 * 1000) {
    const now = Date.now();
    const key = userId;

    if (!store.has(key)) {
      store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    const entry = store.get(key);

    // Reset window if expired
    if (now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    // Increment count
    entry.count += 1;

    if (entry.count > maxRequests) {
      const resetIn = windowMs - (now - entry.windowStart);
      return { allowed: false, remaining: 0, resetIn };
    }

    return { allowed: true, remaining: maxRequests - entry.count, resetIn: windowMs - (now - entry.windowStart) };
  };
}

describe('Rate Limiter', () => {
  let checkRateLimit;

  beforeEach(() => {
    checkRateLimit = createRateLimiter();
  });

  it('allows first request', () => {
    const result = checkRateLimit('user-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decrements remaining on each request', () => {
    checkRateLimit('user-1', 5, 60000);
    const result = checkRateLimit('user-1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('blocks after exceeding max requests', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1', 5, 60000);
    }
    const result = checkRateLimit('user-1', 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    // Fill up the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1', 5, 100); // 100ms window
    }

    // Blocked
    expect(checkRateLimit('user-1', 5, 100).allowed).toBe(false);

    // Wait for window to expire
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);

    // Should be allowed again
    const result = checkRateLimit('user-1', 5, 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);

    vi.useRealTimers();
  });

  it('tracks users independently', () => {
    // Fill user-1's limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1', 5, 60000);
    }
    expect(checkRateLimit('user-1', 5, 60000).allowed).toBe(false);

    // user-2 should still be allowed
    const result = checkRateLimit('user-2', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns correct resetIn time', () => {
    vi.useFakeTimers();
    const start = Date.now();

    checkRateLimit('user-1', 5, 60000);

    vi.advanceTimersByTime(10000); // 10 seconds later

    const result = checkRateLimit('user-1', 5, 60000);
    expect(result.resetIn).toBeLessThanOrEqual(50000);
    expect(result.resetIn).toBeGreaterThan(49000);

    vi.useRealTimers();
  });
});
