/**
 * Timezone utilities for Netlify scheduled functions.
 *
 * Uses the IANA timezone string stored in each user's Supabase metadata
 * (e.g. "Asia/Calcutta", "Australia/Sydney", "America/New_York") to
 * determine the user's current local hour so notifications arrive at
 * the right local time regardless of where the user is.
 */

/**
 * Get the current local hour (0-23) for a given IANA timezone.
 * Falls back to UTC if the timezone string is invalid.
 *
 * @param {string} timezone - IANA timezone (e.g. "Asia/Calcutta")
 * @returns {number} The current hour in the user's local time (0-23)
 */
function getLocalHour(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find(p => p.type === 'hour');
    return parseInt(hourPart.value, 10);
  } catch {
    // Invalid timezone — fall back to UTC
    return new Date().getUTCHours();
  }
}

/**
 * Get today's date string (YYYY-MM-DD) in the user's local timezone.
 *
 * @param {string} timezone - IANA timezone
 * @returns {string} Date string like "2026-10-15"
 */
function getLocalDateString(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA locale formats as YYYY-MM-DD
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Determine the time-of-day label for a given local hour.
 *
 * @param {number} localHour - Hour in 0-23 format
 * @returns {'midday' | 'evening' | null}
 *   Returns null if the hour doesn't match any notification window.
 */
function getTimeLabel(localHour) {
  // Midday window: 11:00 AM (hour 11)
  if (localHour === 11) return 'midday';
  // Evening window: 6:00 PM (hour 18)
  if (localHour === 18) return 'evening';
  return null;
}

/**
 * Check if it's midnight (hour 0) in the user's timezone.
 * Used by expiry-notification to send daily digests at local midnight.
 *
 * @param {string} timezone - IANA timezone
 * @returns {boolean}
 */
function isMidnightLocal(timezone) {
  return getLocalHour(timezone) === 0;
}

/**
 * Extract timezone from a Supabase user object.
 * Falls back to 'Asia/Calcutta' for backward compatibility with existing users
 * who signed up before timezone tracking was added.
 *
 * @param {object} user - Supabase auth user object
 * @returns {string} IANA timezone string
 */
function getUserTimezone(user) {
  return user?.user_metadata?.timezone || user?.raw_user_meta_data?.timezone || 'Asia/Calcutta';
}

module.exports = {
  getLocalHour,
  getLocalDateString,
  getTimeLabel,
  isMidnightLocal,
  getUserTimezone,
};
