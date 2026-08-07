# Stock Tracker PWA

A Progressive Web App for tracking home stock inventory with expiry notifications. Installable on Android and iOS.

## Features

- 📱 **Installable PWA** — Add to home screen on Android & iOS
- 🔔 **Push Notifications** — Get notified when products expire
- 🔐 **Persistent Login** — Auto-login on app open (no sign-in screen every time)
- 📦 **Stock Management** — Track products across multiple homes
- 🏷️ **Categorized Catalog** — Organized stock types and products
- 📴 **Offline Caching** — Previously loaded data viewable offline via service worker cache (full offline mode planned)
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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React App                             │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Dashboard   │    │  Inventory   │    │   Profile    │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  useHomes() hook │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  HomesContext   │  (single source of    │
│                    │  (state mgmt)  │   truth, optimistic)  │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   homeApi.ts    │  (ownership checks,   │
│                    │                 │   derive-status sync) │
│                    └────────┬────────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Supabase (RLS)  │  (DB-level security)
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
     │ Netlify Funcs │ │  Web Push │ │   EmailJS   │
     │ (AI, cron)    │ │  (VAPID)  │ │ (expiry)    │
     └───────────────┘ └───────────┘ └─────────────┘
```

### Key Design Decisions

- **Single fetch, shared state** — `HomesContext` fetches once; all screens share the same data via `useHomes()` hook
- **Optimistic updates** — Mutations update UI immediately, rollback on API failure
- **Defense-in-depth security** — Client-side ownership checks + Supabase RLS policies
- **Status derivation invariant** — `derive-status.js` (server) and `deriveStatus.ts` (client) must always agree; tested by `derive-status-invariant.test.ts`
- **AI provider chain** — Groq (primary, free) → Gemini (fallback) with automatic failover

See [`CONVENTIONS.md`](CONVENTIONS.md) for detailed patterns and conventions.

## Project Structure

```
├── public/
│   ├── sw-push.js          # Push notification service worker
│   ├── offline.html        # Offline fallback page
│   └── icons/              # PWA icons (SVG + PNG, 192x192, 512x512)
├── src/
│   ├── App.tsx             # Root component with auth routing
│   ├── contexts/           # React contexts (HomesContext — single source of truth)
│   ├── hooks/              # Custom hooks (useHomes, useAuth, useVoiceAssistant)
│   ├── services/           # API layer (homeApi with ownership checks)
│   ├── config/             # Supabase client, categories
│   ├── components/         # UI components (screens, dashboard, inventory, profile, ui)
│   ├── utils/              # Pure functions (deriveStatus)
│   └── types/              # TypeScript type definitions
├── netlify/
│   └── functions/          # Serverless functions (AI, cron, auth-helper, derive-status)
├── plans/
│   ├── migrations/         # SQL migrations (run in Supabase SQL Editor)
│   └── security-audit.md   # Security audit report
├── scripts/                # Build scripts (icon generation, version bump)
├── netlify.toml            # Netlify config (headers, redirects, schedules)
└── vite.config.ts          # Vite + PWA plugin config
```

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + Vite build
npm run test         # Run tests in watch mode
npm run test:ci      # Run tests once (CI)
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
node scripts/generate-icons.js  # Generate PNG icons from SVG
```
