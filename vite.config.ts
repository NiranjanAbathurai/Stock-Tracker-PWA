import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// @ts-ignore — Node.js built-in, works at build time
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    // Auto-reads version from package.json at build time
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      // Proxy /.netlify/functions to the deployed PWA's own Netlify functions
      '/.netlify/functions': {
        target: 'https://stock-tracker-pwa-nj.netlify.app',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png', 'icons/*.svg', 'sw-push.js'],
      manifest: {
        name: 'Stock Tracker',
        short_name: 'StockTracker',
        description: 'Track your home stock inventory with expiry notifications and AI-powered voice commands',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1db954',
        background_color: '#000000',
        categories: ['lifestyle', 'utilities', 'food'],
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-192x192.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512x512.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
        shortcuts: [
          {
            name: 'Add Item',
            short_name: 'Add',
            url: '/?action=add',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Voice Command',
            short_name: 'Voice',
            url: '/?action=voice',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Import the custom push handler into the generated service worker
        importScripts: ['/sw-push.js'],
        // Force new service worker to activate immediately (no close/reopen needed)
        skipWaiting: true,
        clientsClaim: true,
        // SPA fallback: serve precached index.html for all navigation requests
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/.netlify/, /^\/api/],
        runtimeCaching: [
          {
            // SECURITY: Auth endpoints should never be cached
            urlPattern: /^https:\/\/mskobghlcvvvlljfkbpr\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'supabase-auth-no-cache',
            },
          },
          {
            // Data API: Cache with shorter TTL (1 hour instead of 24)
            urlPattern: /^https:\/\/mskobghlcvvvlljfkbpr\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour (reduced from 24h for fresher data)
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
