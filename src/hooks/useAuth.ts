import { useState, useEffect, useCallback } from 'react';
import { loginUser, logoutUser } from '../services/authService';
import { getStoredSession, saveSession, clearSession } from '../services/sessionService';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Attempt auto-login on mount
  useEffect(() => {
    const attemptAutoLogin = async () => {
      const stored = getStoredSession();
      if (!stored) {
        setAuthState('unauthenticated');
        return;
      }

      try {
        await loginUser(stored.email, stored.password);
        setAuthState('authenticated');
      } catch {
        // Stored credentials are invalid (password changed, account deleted, etc.)
        clearSession();
        setAuthState('unauthenticated');
      }
    };

    attemptAutoLogin();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await loginUser(email, password);
      saveSession(email, password);
      setAuthState('authenticated');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Even if server logout fails, clear local state
    }
    clearSession();
    setAuthState('unauthenticated');
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { authState, error, login, logout, clearError };
}
