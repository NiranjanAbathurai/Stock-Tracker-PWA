# Stock Tracker PWA — Complete Functional Flow

## App Architecture
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (Auth + PostgreSQL DB) + Netlify Functions (AI)
- **Hosting:** Netlify (static + serverless functions)
- **AI:** Google Gemini API (voice commands + image recognition)

---

## 1. Authentication Flow

### Sign Up
1. User enters username, email, password on `SignUpForm`
2. `authService.signUpUser()` → Supabase `auth.signUp()`
3. Supabase creates user with metadata `{ username }`
4. User redirected to sign-in form

### Sign In
1. User enters email + password on `SignInForm`
2. `useAuth.login()` → `authService.loginUser()` → Supabase `auth.signInWithPassword()`
3. On success: `sessionService.saveSession(email, password)` stores creds in localStorage
4. `authState` changes to `'authenticated'` → renders `AppShell`

### Auto-Login (on app reopen)
1. `useAuth` effect runs → `getStoredSession()` reads localStorage
2. If creds exist → `loginUser(email, password)` re-authenticates
3. If fails → `clearSession()` → show login form

### Logout
1. `logoutUser()` → Supabase `auth.signOut()`
2. `clearSession()` removes localStorage
3. `authState` → `'unauthenticated'`

---

## 2. Home Management Flow

### Load Homes
1. `useHomes` hook → `api.getHomesWithProducts()`
2. Queries Supabase: `homes` table with nested `products(*)` 
3. Filters by `user_id = auth.uid()`
4. Formats data into `HomeItem[]` with expiry calculations

### Add Home
1. User enters home name in `MyHomes` component
2. `api.addHome(name)` → inserts into `homes` table with `user_id`
3. Updates local state

### Delete Home
1. User confirms deletion
2. `api.removeHome(homeId)` → deletes from `homes` (cascade deletes products)
3. Updates local state

### Update Home Name
1. User edits name
2. `api.updateHomeName(homeId, newName)` → updates `homes` table
3. Updates local state

---

## 3. Product Management Flow

### Add Product (Manual)
1. User opens `AddItemSheet` → selects "Manual Entry"
2. Fills: name, category, quantity, expiry date, availability
3. `useHomes.addProduct()` checks for duplicates
4. `api.addProduct(homeId, data)` → inserts into `products` table
5. Updates local state

### Add Product (Camera/Image)
1. User opens `AddItemSheet` → selects "Camera" or "Upload"
2. Image captured/selected → compressed to JPEG (max 1024px, 70% quality)
3. Sent as base64 to `/.netlify/functions/image-to-product`
4. Netlify function → Gemini Vision AI → extracts product details
5. User reviews extracted products → confirms → bulk insert

### Edit Product
1. User opens `EditProductModal`
2. Modifies fields → submits
3. `api.updateProduct(productId, fields)` → updates `products` table
4. Optimistic UI update (reverts on failure)

### Delete Product
1. User confirms deletion via `ThreeDotMenu`
2. `api.removeProduct(productId)` → deletes from `products` table
3. Updates local state

---

## 4. Voice Assistant Flow

### Recording
1. User taps FAB → `VoiceAssistantFAB` opens chat modal
2. Taps mic → `useVoiceAssistant.startRecording()`
3. `MediaRecorder` captures audio from microphone
4. User taps stop → `stopRecording()`

### Processing
1. Audio blob → base64 conversion
2. Sent to `/.netlify/functions/voice-command` with:
   - Audio data + MIME type
   - Home context (names, products, quantities, expiry dates)
   - Conversation history (last 6 messages)
   - Catalog categories
3. Netlify function → Gemini AI with system prompt
4. AI returns: actions[], spokenResponse, userTranscript, needsMoreInfo

### Action Execution
1. Parse actions from AI response
2. For each action:
   - `add` → `onAddProduct(homeId, data)`
   - `delete` → `onDeleteProduct(homeId, productId)`
   - `update_availability` → `onUpdateProduct(homeId, productId, { availability })`
   - `query` → just speak the response (no data modification)
3. Speak response via `speechSynthesis` (TTS)

### Multi-turn Conversation
1. Conversation history stored in `conversationRef`
2. Sent with each request for context
3. Max 6 messages kept

---

## 5. Push Notifications Flow

### Subscribe
1. User toggles notifications in Profile
2. `subscribeToPush()` → requests browser permission
3. Gets `PushSubscription` from service worker
4. Saves endpoint + keys to Supabase `push_subscriptions` table

### Daily Expiry Check (Scheduled)
1. Netlify scheduled function runs at 18:31 UTC (12:01 AM IST)
2. Queries ALL products with expired dates (using service role key)
3. Groups by user → sends email (EmailJS) + push notification (web-push)
4. Cleans up invalid subscriptions

### Receiving Push
1. Service worker (`sw-push.js`) receives push event
2. Shows notification with title, body, icon
3. On click → opens/focuses the app

---

## 6. UI Navigation Flow

### Screens
- **Dashboard** → Overview chart, expiring soon, add item, home selector
- **Inventory** → Full product list with search, category tabs, filters
- **Profile** → User info, homes management, notifications, logout

### Components
- `AppShell` → Main layout (Header + Content + BottomNav + VoiceFAB)
- `Header` → App title + hamburger menu
- `SideDrawer` → Home selection drawer
- `BottomNav` → Tab navigation (Dashboard/Inventory/Profile)
- `VoiceAssistantFAB` → Floating action button for voice

---

## 7. PWA Features

### Install
- `beforeinstallprompt` event captured
- Install banner shown at bottom
- `InstallPage` for users coming from portfolio

### Offline Support
- Service worker caches all static assets
- Supabase API responses cached (NetworkFirst, 24h)
- App works offline with cached data

### Service Worker
- Generated by `vite-plugin-pwa` (Workbox)
- Custom `sw-push.js` imported for push handling
- Auto-update with `skipWaiting` + `clientsClaim`

---

## Key Data Flow Summary

```
User → React UI → Supabase Client (anon key + JWT) → Supabase DB (RLS enforced)
User → React UI → Netlify Function (NO auth) → Gemini AI → Response
Scheduled → Netlify Function (service key) → Supabase DB → Email/Push
```
