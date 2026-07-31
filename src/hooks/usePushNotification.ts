import { useState, useEffect, useCallback } from 'react';
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../services/pushService';

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const supported = isPushSupported();
      setIsSupported(supported);
      if (supported) {
        try {
          // Check if service worker is actually registered
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
            // No service worker = dev mode, don't show push toggle
            setIsSupported(false);
            return;
          }
          const subscribed = await isPushSubscribed();
          setIsSubscribed(subscribed);
        } catch {
          setIsSupported(false);
        }
      }
    };
    checkStatus();
  }, []);

  const toggle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isSubscribed) {
        await unsubscribeFromPush();
        setIsSubscribed(false);
      } else {
        await subscribeToPush();
        setIsSubscribed(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update notification settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  return { isSupported, isSubscribed, isLoading, error, toggle };
}
