import { useState, useCallback } from 'react';

const ONBOARDING_KEY = 'stock_tracker_onboarding_completed';
const SPOTLIGHT_KEY = 'stock_tracker_spotlight_completed';

/**
 * Hook to manage one-time onboarding tutorial state.
 * Uses localStorage to persist completion across sessions.
 */
export function useOnboarding() {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  const [shouldShowSpotlight, setShouldShowSpotlight] = useState<boolean>(() => {
    // For testing: show spotlight every sign-in (remove SPOTLIGHT_KEY check)
    // For production: uncomment the localStorage check below
    // return !localStorage.getItem(SPOTLIGHT_KEY) && !!localStorage.getItem(ONBOARDING_KEY);
    return !localStorage.getItem(SPOTLIGHT_KEY);
  });

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShouldShowOnboarding(false);
  }, []);

  const completeSpotlight = useCallback(() => {
    localStorage.setItem(SPOTLIGHT_KEY, 'true');
    setShouldShowSpotlight(false);
  }, []);

  const resetSpotlight = useCallback(() => {
    localStorage.removeItem(SPOTLIGHT_KEY);
    setShouldShowSpotlight(true);
  }, []);

  return {
    shouldShowOnboarding,
    completeOnboarding,
    shouldShowSpotlight,
    completeSpotlight,
    resetSpotlight,
  };
}
