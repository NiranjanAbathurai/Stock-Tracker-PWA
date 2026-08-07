// Type declarations for netlify/functions/derive-status.js
// This file lives in src/types/ (not netlify/functions/) to avoid Netlify
// treating .d.ts files as serverless functions.
declare module '../../../netlify/functions/derive-status' {
  import type { AvailabilityStatus } from './index';
  export function deriveAvailability(status: AvailabilityStatus): 'Yes' | 'No';
  export function deriveStatusFromAvailability(availability: 'Yes' | 'No'): AvailabilityStatus;
}
