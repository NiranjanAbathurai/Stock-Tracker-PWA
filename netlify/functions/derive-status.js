/**
 * INVARIANT: Must match src/utils/deriveStatus.ts exactly.
 * Tested in src/utils/__tests__/derive-status-invariant.test.ts
 *
 * Derivation rule:
 *   - 'available' or 'low' → 'Yes'
 *   - 'out_of_stock' → 'No'
 */
function deriveAvailability(status) {
  return status === 'out_of_stock' ? 'No' : 'Yes';
}

function deriveStatusFromAvailability(availability) {
  return availability === 'No' ? 'out_of_stock' : 'available';
}

module.exports = { deriveAvailability, deriveStatusFromAvailability };
