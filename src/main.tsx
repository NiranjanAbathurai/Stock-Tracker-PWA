import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// Register service worker with auto-update on new version.
// `immediate: true` checks for updates on page load.
// `onRegisteredSW` sets up periodic update checks (every 60s).
// When a new SW is found, `onNeedRefresh` calls updateSW(true) which:
//   1. Tells the waiting SW to skipWaiting and become active
//   2. The browser fires 'controllerchange'
//   3. The page reloads with fresh assets from the new SW
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version detected — activate it and reload
    console.log('[SW] New version available, updating...');
    updateSW(true); // true = reloadPage after activation
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
  onRegisteredSW(_swUrl, registration) {
    // Check for updates every 60 seconds (catches deploys while app is open)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
