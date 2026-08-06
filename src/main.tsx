import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// ─── Force reload when a new service worker takes control ───
// This is the nuclear option: whenever a new SW activates and takes control,
// reload the page immediately so the user always gets fresh assets.
// This fires AFTER skipWaiting succeeds, guaranteeing the new SW serves the reload.
let refreshing = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return; // Prevent infinite reload loops
    refreshing = true;
    console.log('[SW] New service worker active — reloading for fresh content');
    window.location.reload();
  });
}

// Register service worker with auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version detected — tell the waiting SW to activate immediately
    console.log('[SW] New version available, activating...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
  onRegisteredSW(_swUrl, registration) {
    // Check for updates every 30 seconds (faster detection of deploys)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 30 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
