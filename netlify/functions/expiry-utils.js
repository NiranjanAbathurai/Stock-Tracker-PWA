/**
 * Pure utility functions for expiry date calculations.
 * Extracted for testability — no external dependencies.
 */

/**
 * Check if a product's expiry date is in the past relative to a reference date.
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @param {Date} referenceDate - The date to compare against (typically "today")
 * @returns {boolean}
 */
function isExpired(expiryDate, referenceDate) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return expiry < ref;
}

/**
 * Check if a product expires within N days from a reference date.
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @param {number} daysThreshold - Number of days to look ahead
 * @param {Date} referenceDate - The date to compare against
 * @returns {boolean}
 */
function isExpiringSoon(expiryDate, daysThreshold, referenceDate) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  // Not already expired, but within threshold
  const thresholdDate = new Date(ref);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  return expiry >= ref && expiry <= thresholdDate;
}

/**
 * Format a date string for display in notifications.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date like "Aug 7, 2026"
 */
function formatExpiryDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

module.exports = { isExpired, isExpiringSoon, formatExpiryDate };
