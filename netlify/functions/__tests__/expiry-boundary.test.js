import { describe, it, expect } from 'vitest';
import { isExpired, isExpiringSoon, formatExpiryDate } from '../expiry-utils.js';

describe('isExpired', () => {
  const today = new Date('2026-08-07');

  it('returns true for yesterday', () => {
    expect(isExpired('2026-08-06', today)).toBe(true);
  });

  it('returns false for today (not yet expired)', () => {
    expect(isExpired('2026-08-07', today)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    expect(isExpired('2026-08-08', today)).toBe(false);
  });

  it('returns false for null/empty expiry', () => {
    expect(isExpired(null, today)).toBe(false);
    expect(isExpired('', today)).toBe(false);
  });

  it('handles year boundary correctly', () => {
    expect(isExpired('2025-12-31', new Date('2026-01-01'))).toBe(true);
    expect(isExpired('2026-01-01', new Date('2026-01-01'))).toBe(false);
  });
});

describe('isExpiringSoon', () => {
  const today = new Date('2026-08-07');

  it('returns true for items expiring within threshold', () => {
    expect(isExpiringSoon('2026-08-09', 3, today)).toBe(true); // 2 days away, threshold 3
  });

  it('returns true for items expiring exactly on threshold day', () => {
    expect(isExpiringSoon('2026-08-10', 3, today)).toBe(true); // 3 days away, threshold 3
  });

  it('returns false for items expiring beyond threshold', () => {
    expect(isExpiringSoon('2026-08-11', 3, today)).toBe(false); // 4 days away, threshold 3
  });

  it('returns false for already expired items', () => {
    expect(isExpiringSoon('2026-08-06', 3, today)).toBe(false);
  });

  it('returns true for items expiring today (within 0-day threshold)', () => {
    expect(isExpiringSoon('2026-08-07', 3, today)).toBe(true);
  });

  it('returns false for null/empty expiry', () => {
    expect(isExpiringSoon(null, 3, today)).toBe(false);
    expect(isExpiringSoon('', 3, today)).toBe(false);
  });
});

describe('formatExpiryDate', () => {
  it('formats a valid date', () => {
    const result = formatExpiryDate('2026-08-07');
    expect(result).toContain('Aug');
    expect(result).toContain('7');
    expect(result).toContain('2026');
  });

  it('returns "Unknown" for empty input', () => {
    expect(formatExpiryDate('')).toBe('Unknown');
    expect(formatExpiryDate(null)).toBe('Unknown');
  });
});
