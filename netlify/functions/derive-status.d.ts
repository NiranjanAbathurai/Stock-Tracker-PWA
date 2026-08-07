import type { AvailabilityStatus } from '../../src/types';
export function deriveAvailability(status: AvailabilityStatus): 'Yes' | 'No';
export function deriveStatusFromAvailability(availability: 'Yes' | 'No'): AvailabilityStatus;
