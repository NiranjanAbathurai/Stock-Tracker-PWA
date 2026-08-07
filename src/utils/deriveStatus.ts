import type { AvailabilityStatus } from '../types';

/**
 * INVARIANT: This derivation must be consistent across client and server.
 *   - 'available' or 'low' → 'Yes'
 *   - 'out_of_stock' → 'No'
 *
 * The Netlify functions duplicate this logic in CJS at netlify/functions/derive-status.js.
 * Tests assert both implementations produce identical output.
 */
export function deriveAvailability(status: AvailabilityStatus): 'Yes' | 'No' {
  return status === 'out_of_stock' ? 'No' : 'Yes';
}

export function deriveStatusFromAvailability(availability: 'Yes' | 'No'): AvailabilityStatus {
  return availability === 'No' ? 'out_of_stock' : 'available';
}
