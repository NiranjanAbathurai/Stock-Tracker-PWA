import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// Register service worker with auto-reload on new version
// When a new SW is detected, it immediately reloads the page to serve fresh assets
registerSW({
  onNeedRefresh() {
    // New version available — reload immediately (no user prompt)
    window.location.reload();
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
