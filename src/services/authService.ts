import { supabase } from '../config/supabase';

/**
 * Get the user's IANA timezone string (e.g. "Asia/Calcutta", "Australia/Sydney").
 * Falls back to "UTC" if the browser doesn't support Intl.
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function signUpUser(username: string, email: string, password: string) {
  const timezone = getBrowserTimezone();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, timezone },
    },
  });

  if (error) throw error;
  return data;
}

export async function loginUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Update timezone on every login (user may have moved or changed device)
  const timezone = getBrowserTimezone();
  try {
    await supabase.auth.updateUser({ data: { timezone } });
  } catch {
    // Non-critical — don't block login if timezone update fails
  }

  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
