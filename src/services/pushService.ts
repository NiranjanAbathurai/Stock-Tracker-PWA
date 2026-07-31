import { supabase } from '../config/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a base64 string to a Uint8Array (needed for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported and permission is granted.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get the current push subscription state.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

/**
 * Subscribe to push notifications and save subscription to Supabase.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key is not configured.');
  }

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.');
  }

  // Get push subscription from service worker
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  // Extract subscription details
  const subscriptionJSON = subscription.toJSON();
  const endpoint = subscriptionJSON.endpoint!;
  const p256dh = subscriptionJSON.keys!.p256dh;
  const auth = subscriptionJSON.keys!.auth;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not logged in');

  // Save to Supabase (don't fail if table doesn't exist yet)
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
      }, { onConflict: 'user_id,endpoint' });

    if (error) {
      console.warn('Could not save push subscription to DB:', error.message);
    }
  } catch (err) {
    console.warn('Push subscription DB save failed:', err);
  }

  return true;
}

/**
 * Unsubscribe from push notifications and remove from Supabase.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    // Try to remove from Supabase (don't fail if table doesn't exist)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      }
    } catch (err) {
      console.warn('Could not remove push subscription from DB:', err);
    }
  }

  return true;
}
