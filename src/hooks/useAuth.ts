import { useState, useEffect, useCallback } from 'react';
import { loginUser, logoutUser } from '../services/authService';
import { saveSessionMeta, clearSessionMeta, migrateOldSession } from '../services/sessionService';
import { supabase } from '../config/supabase';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // SECURITY: Remove any old insecure password storage from localStorage
    migrateOldSession();

    // Use Supabase's built-in session management.
    // Supabase stores a secure refresh token (not password) in localStorage
    // and automatically refreshes the JWT when needed.
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch {
        setAuthState('unauthenticated');
      }
    };

    checkSession();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await loginUser(email, password);
      // Save only non-sensitive metadata (email for display purposes)
      saveSessionMeta(email);
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
    clearSessionMeta();
    setAuthState('unauthenticated');
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { authState, error, login, logout, clearError };
}
