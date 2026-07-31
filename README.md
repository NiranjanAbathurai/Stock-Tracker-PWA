# Stock Tracker PWA

A Progressive Web App for tracking home stock inventory with expiry notifications. Installable on Android and iOS.

## Features

- 📱 **Installable PWA** — Add to home screen on Android & iOS
- 🔔 **Push Notifications** — Get notified when products expire
- 🔐 **Persistent Login** — Auto-login on app open (no sign-in screen every time)
- 📦 **Stock Management** — Track products across multiple homes
- 🏷️ **Categorized Catalog** — Organized stock types and products
- 📴 **Offline Support** — View cached data when offline
- ⏰ **Daily Expiry Check** — Automated cron job at midnight IST

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **PWA:** vite-plugin-pwa (Workbox)
- **Backend:** Supabase (Auth, Database, RLS)
- **Notifications:** Web Push API + EmailJS
- **Deployment:** Netlify (with Scheduled Functions)

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `VITE_VAPID_PUBLIC_KEY` — VAPID public key for push notifications

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment (Netlify)

1. Connect this repo to a new Netlify site
2. Set environment variables in Netlify dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_SECRET_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
3. Deploy — the cron job will automatically run daily

## Database Setup

Run this SQL in your Supabase SQL editor to create the push subscriptions table:

```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

## Project Structure

```
├── public/
│   ├── sw-push.js          # Push notification service worker
│   └── icons/              # PWA icons (192x192, 512x512)
├── src/
│   ├── App.tsx             # Root component with auth routing
│   ├── config/supabase.ts  # Supabase client
│   ├── services/           # API & business logic
│   ├── hooks/              # React hooks (useAuth, useHomes, usePush)
│   ├── components/         # UI components
│   └── types/              # TypeScript types
├── netlify/
│   └── functions/          # Serverless functions (cron job)
├── netlify.toml            # Netlify deployment config
└── vite.config.ts          # Vite + PWA plugin config
```
