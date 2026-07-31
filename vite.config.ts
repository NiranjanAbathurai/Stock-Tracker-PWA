import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      // Proxy /api requests to the local Netlify functions server
      '/api': {
        target: 'https://niranjan-abathurai-portfolio.netlify.app',
        changeOrigin: true,
      },
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
      includeAssets: ['favicon.png', 'icons/*.png', 'sw-push.js'],
      manifest: {
        name: 'Stock Tracker',
        short_name: 'StockTracker',
        description: 'Track your home stock inventory with expiry notifications',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1db954',
        background_color: '#000000',
        icons: [
          {
            src: '/icons/icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Import the custom push handler into the generated service worker
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/mskobghlcvvvlljfkbpr\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
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
