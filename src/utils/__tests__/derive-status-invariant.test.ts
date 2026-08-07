import { describe, it, expect } from 'vitest';
import { deriveAvailability, deriveStatusFromAvailability } from '../deriveStatus';
// Vitest CJS interop — imports the CJS module
// eslint-disable-next-line @typescript-eslint/no-require-imports
import serverModule from '../../../netlify/functions/derive-status';

const ALL_STATUSES = ['available', 'low', 'out_of_stock'] as const;
const ALL_AVAILABILITIES = ['Yes', 'No'] as const;

describe('derive-status invariant: client and server implementations agree', () => {
  describe('deriveAvailability', () => {
    it.each(ALL_STATUSES)('deriveAvailability("%s") produces identical output', (status) => {
      expect(deriveAvailability(status)).toBe(serverModule.deriveAvailability(status));
    });
  });

  describe('deriveStatusFromAvailability', () => {
    it.each(ALL_AVAILABILITIES)('deriveStatusFromAvailability("%s") produces identical output', (avail) => {
      expect(deriveStatusFromAvailability(avail)).toBe(serverModule.deriveStatusFromAvailability(avail));
    });
  });
});
