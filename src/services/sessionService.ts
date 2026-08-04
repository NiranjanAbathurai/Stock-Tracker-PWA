/**
 * Session Service — Secure session management using Supabase's built-in auth persistence.
 *
 * SECURITY: We no longer store passwords in localStorage.
 * Supabase automatically stores a secure refresh token in localStorage
 * under its own key. We only need to manage auth state transitions.
 *
 * This file now provides a thin wrapper for any additional session metadata
 * (like "remember me" preference) without storing sensitive credentials.
 */

const SESSION_META_KEY = 'stock-tracker-session-meta';

type SessionMeta = {
  email: string;
  lastLogin: number; // timestamp
};

/**
 * Save non-sensitive session metadata (email for display, last login time).
 * The actual auth token is managed by Supabase internally.
 */
export function saveSessionMeta(email: string): void {
  const meta: SessionMeta = { email, lastLogin: Date.now() };
  localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
}

/**
 * Retrieve session metadata. Returns null if none exist.
 */
export function getSessionMeta(): SessionMeta | null {
  try {
    const stored = localStorage.getItem(SESSION_META_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SessionMeta;
    if (parsed.email) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear session metadata (on logout).
 */
export function clearSessionMeta(): void {
  localStorage.removeItem(SESSION_META_KEY);
}

// ─── Migration: Remove old insecure session data ───
// If the old format exists (with password), remove it immediately
const OLD_STORAGE_KEY = 'stock-tracker-session-auth';

export function migrateOldSession(): void {
  try {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldData) {
      // Remove the insecure password storage immediately
      localStorage.removeItem(OLD_STORAGE_KEY);
      console.info('[Security] Removed legacy password storage from localStorage.');
    }
  } catch {
    // Silently ignore errors during migration
  }
}
