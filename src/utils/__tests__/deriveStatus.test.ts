import { describe, it, expect } from 'vitest';
import { deriveAvailability, deriveStatusFromAvailability } from '../deriveStatus';

describe('deriveAvailability', () => {
  it('maps "available" to "Yes"', () => {
    expect(deriveAvailability('available')).toBe('Yes');
  });

  it('maps "low" to "Yes"', () => {
    expect(deriveAvailability('low')).toBe('Yes');
  });

  it('maps "out_of_stock" to "No"', () => {
    expect(deriveAvailability('out_of_stock')).toBe('No');
  });
});

describe('deriveStatusFromAvailability', () => {
  it('maps "Yes" to "available"', () => {
    expect(deriveStatusFromAvailability('Yes')).toBe('available');
  });

  it('maps "No" to "out_of_stock"', () => {
    expect(deriveStatusFromAvailability('No')).toBe('out_of_stock');
  });
});

describe('round-trip consistency', () => {
  it('available → Yes → available', () => {
    const result = deriveStatusFromAvailability(deriveAvailability('available'));
    expect(result).toBe('available');
  });

  it('out_of_stock → No → out_of_stock', () => {
    const result = deriveStatusFromAvailability(deriveAvailability('out_of_stock'));
    expect(result).toBe('out_of_stock');
  });

  it('low → Yes → available (lossy: "low" is not recoverable from availability alone)', () => {
    // This is expected: the reverse derivation can't distinguish "available" from "low"
    // because both map to "Yes". This is by design — availability_status is the source of truth.
    const result = deriveStatusFromAvailability(deriveAvailability('low'));
    expect(result).toBe('available');
  });
});
