const STORAGE_KEY = 'stock-tracker-session-auth';

type StoredSession = {
  email: string;
  password: string;
};

/**
 * Save user credentials to localStorage for auto-login on next app open.
 */
export function saveSession(email: string, password: string): void {
  const session: StoredSession = { email, password };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Retrieve stored credentials. Returns null if none exist.
 */
export function getStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredSession;
    if (parsed.email && parsed.password) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear stored session (on logout or auth failure).
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
