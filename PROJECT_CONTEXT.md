# PROJECT_CONTEXT.md

> AI-optimized reference for **Stockvest** — a stock monitoring mobile app.  
> Last updated: May 2026. Read this before touching any code.

---

## 1. Application Overview

**Stockvest** is a React Native / Expo mobile app that lets users:

- Build a personal **watchlist** of stocks
- Receive **push notifications** when a watched stock hits a 52-week high/low or an RSI overbought/oversold signal
- View live **market data** (quotes, candles, indexes, sector heatmaps, top movers, earnings calendar, market news)

The system has two parts:

| Part | Stack | Role |
|------|-------|------|
| **Mobile app** | Expo SDK 54, React Native, Expo Router, TanStack Query | UI + auth + data display |
| **Backend** | Express 4, TypeScript, Node.js | Market data proxy, alert engine, push delivery |

---

## 2. Folder Structure

```
stockTrackingApp/
├── app/                    # Expo Router screens and layouts
│   ├── _layout.tsx         # Root layout — providers, Sentry, deep-link handler
│   ├── index.tsx           # Splash / auth redirect gate
│   ├── (auth)/             # Login, signup, forgot-password screens
│   ├── (tabs)/             # Bottom-tab screens: home, watchlist, alerts, transactions, profile
│   └── stock/[symbol].tsx  # Dynamic stock detail screen
├── components/             # Reusable RN UI components
│   ├── home/               # Home-screen widgets (heatmap, movers, news, earnings)
│   └── ui/                 # Generic primitives (collapsible, icon-symbol)
├── context/                # React contexts: auth, theme
├── hooks/                  # Data hooks wrapping React Query + API clients
├── lib/                    # Core utilities: api client, supabase, i18n, analytics, sentry, schemas, caching
├── constants/              # Shared design tokens / theme
├── locales/                # i18next JSON translations (en.json)
├── backend/                # Express backend (separate Node process)
│   └── src/
│       ├── index.ts        # Entry — app, middleware, route mounts, startup tasks
│       ├── routes/         # HTTP route handlers
│       ├── services/       # Business logic, market data, alert engine, scheduler
│       └── lib/            # Supabase admin client, Expo Push client
├── supabase/
│   └── schema.sql          # Authoritative DB DDL + RLS policies
├── __tests__/              # Jest unit tests
├── __mocks__/              # Jest mocks
└── scripts/                # Dev utility scripts
```

---

## 3. Entry Points & App Flow

### Mobile

| File | Role |
|------|------|
| `package.json` → `"main": "expo-router/entry"` | Expo bootstraps from here |
| `app/_layout.tsx` | Root component: initialises Sentry, i18n, analytics; wraps with `ErrorBoundary > ThemeProvider > QueryClientProvider > AuthProvider`; handles OAuth deep links |
| `app/index.tsx` | Redirects to `/(auth)/login` or `/(tabs)` based on session |

**Provider stack (outermost → innermost):**
```
Sentry.wrap(App)
  └─ ErrorBoundary
       └─ ThemeProvider
            └─ QueryClientProvider
                 └─ AuthProvider
                      └─ RootLayout (Stack navigator)
```

### Backend

| File | Role |
|------|------|
| `backend/src/index.ts` | Express `listen()` → mounts routers → starts scheduler → pre-warms caches |

---

## 4. All API Routes

Base URL: `http://localhost:3000` (configured via `EXPO_PUBLIC_API_URL`).

| Method | Path | Handler file |
|--------|------|-------------|
| GET | `/health` | `backend/src/index.ts` |
| **Stocks / Watchlist** | | |
| GET | `/api/stocks` | `backend/src/routes/stocks.ts` |
| GET | `/api/stocks/search?q=` | `backend/src/routes/stocks.ts` |
| POST | `/api/stocks` | `backend/src/routes/stocks.ts` |
| DELETE | `/api/stocks/:symbol` | `backend/src/routes/stocks.ts` |
| **Alerts** | | |
| GET | `/api/alerts` | `backend/src/routes/alerts.ts` |
| PATCH | `/api/alerts/:id/read` | `backend/src/routes/alerts.ts` |
| PATCH | `/api/alerts/read-all` | `backend/src/routes/alerts.ts` |
| **Market Data** | | |
| GET | `/api/market/quote/:symbol` | `backend/src/routes/market.ts` |
| GET | `/api/market/detail/:symbol` | `backend/src/routes/market.ts` |
| GET | `/api/market/candles/:symbol` | `backend/src/routes/market.ts` |
| GET | `/api/market/indexes` | `backend/src/routes/market.ts` |
| GET | `/api/market/sectors` | `backend/src/routes/market.ts` |
| GET | `/api/market/unusual-volume` | `backend/src/routes/market.ts` |
| GET | `/api/market/home` | `backend/src/routes/market.ts` |
| **Push Tokens** | | |
| POST | `/api/push-token` | `backend/src/routes/push-token.ts` |
| DELETE | `/api/push-token` | `backend/src/routes/push-token.ts` |
| POST | `/api/push-token/trigger-check` | `backend/src/routes/push-token.ts` (dev: manual alert trigger) |

All routes identify the user via the `x-user-id` request header (sent by `lib/api.ts`).

---

## 5. Service / Architecture Patterns

**No controller/repository layer** — routes call services and Supabase directly.

```
HTTP Request
    │
    ▼
Route Handler (routes/*.ts)
    ├── Supabase DB ops (via backend/src/lib/supabase.ts)
    └── Domain Services (services/*.ts)
            ├── finnhub.service.ts   — quotes, profiles, candles, week-52
            ├── polygon.service.ts   — unusual volume (uses Yahoo Finance internally)
            ├── rsi.service.ts       — RSI calculation
            ├── dma.service.ts       — 50/200-day moving averages
            ├── momentum.service.ts  — composite momentum score
            ├── support-resistance.service.ts — S/R levels
            ├── alert.service.ts     — alert evaluation + persistence + push dispatch
            └── scheduler.service.ts — node-cron wrapper
```

**Mobile client** mirrors this via:
- `lib/api.ts` — typed wrappers: `marketApi`, `watchlistApi`, `alertsApi`, `pushApi`
- `lib/finnhub-direct.ts` — direct Finnhub calls from device (news, economic calendar endpoints)
- `hooks/use-*.ts` — TanStack Query hooks consumed by screens

---

## 6. Database Schema

**Provider:** Supabase (Postgres). DDL: `supabase/schema.sql`.

### Tables

**`user_stocks`** — watchlist entries

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → `auth.users(id)` | ON DELETE CASCADE |
| `symbol` | TEXT | Ticker (e.g. `AAPL`) |
| `company_name` | TEXT | Optional |
| `added_at` | TIMESTAMPTZ | default `now()` |

UNIQUE constraint on `(user_id, symbol)`.

**`alerts_log`** — fired alert history

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `auth.users(id)` | CASCADE |
| `symbol` | TEXT | |
| `alert_type` | TEXT | CHECK IN (`52w_high`, `52w_low`, `rsi_overbought`, `rsi_oversold`) |
| `message` | TEXT | Human-readable alert text |
| `price` | DECIMAL | Price at time of alert |
| `rsi` | DECIMAL | RSI value (nullable) |
| `week52_high` | DECIMAL | Nullable |
| `week52_low` | DECIMAL | Nullable |
| `is_read` | BOOLEAN | default `false` |
| `triggered_at` | TIMESTAMPTZ | default `now()` |

**`push_tokens`** — Expo push tokens per user

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `auth.users(id)` | CASCADE |
| `token` | TEXT | Expo push token |
| `created_at` | TIMESTAMPTZ | |

UNIQUE on `(user_id, token)`.

### RLS

All three tables have RLS **enabled**. Client-side policies restrict to `auth.uid() = user_id`. The **backend uses the service-role key**, which bypasses RLS entirely.

---

## 7. Authentication / Authorization Flow

```
User                 Mobile App                   Supabase Auth            Backend
  │                      │                              │                      │
  │── enter credentials ─►│                              │                      │
  │                       │── signInWithPassword ────────►│                      │
  │                       │◄─ session (JWT) ─────────────│                      │
  │                       │                              │                      │
  │                       │── stores session in SecureStore                     │
  │                       │                              │                      │
  │                       │── API request (x-user-id: <uuid>) ─────────────────►│
  │                       │                              │           reads from DB as service-role
  │                       │◄──────────────────────────── response ◄─────────────│
```

**Auth mechanisms:**
- Email/password via `supabase.auth.signInWithPassword` (`app/(auth)/login.tsx`)
- Email confirmation, password recovery, PKCE OAuth, and implicit-flow tokens all handled in `app/_layout.tsx` via `useOAuthDeepLink()`
- Session persisted with `expo-secure-store` (chunked, 2KB limit chunks) — `lib/supabase.ts`
- `context/auth.tsx` exposes `session`, `user`, `signOut` via `onAuthStateChange`

**Backend user identity:**
- Route handlers call `getUserId(req)` → reads `req.headers['x-user-id']` → falls back to `DEV_USER_ID`
- **No JWT verification on the backend.** This is a known security gap (see §14).

---

## 8. External APIs & Integrations

| Service | SDK / Method | Config key | Files |
|---------|-------------|-----------|-------|
| **Finnhub** | REST via `axios` | `FINNHUB_API_KEY` | `backend/src/services/finnhub.service.ts` |
| **Finnhub (direct)** | REST via `fetch` | `EXPO_PUBLIC_FINNHUB_API_KEY` | `lib/finnhub-direct.ts` |
| **Yahoo Finance** | `yahoo-finance2` npm | none (public) | `backend/src/services/finnhub.service.ts` (fallback for candles/volume), `backend/src/services/polygon.service.ts` (unusual volume) |
| **Supabase** | `@supabase/supabase-js` | `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` | `lib/supabase.ts` (client) |
| **Supabase Admin** | service-role client | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `backend/src/lib/supabase.ts` |
| **Expo Push** | `expo-server-sdk` | Expo infra (no key needed) | `backend/src/lib/expo-push.ts` |
| **Sentry** | `@sentry/react-native` | `EXPO_PUBLIC_SENTRY_DSN` | `lib/sentry.ts` |
| **Mixpanel** | `mixpanel-react-native` | `EXPO_PUBLIC_MIXPANEL_TOKEN` | `lib/analytics.ts` |

> `POLYGON_API_KEY` and `TWELVE_DATA_API_KEY` appear in `backend/.env.example` but are **not used** in current code. Their intended endpoints are served by Yahoo Finance instead.

---

## 9. Cron Jobs & Scheduled Tasks

Defined in `backend/src/services/scheduler.service.ts`.

| Schedule | Expression | Action |
|----------|-----------|--------|
| Every 5 min, weekdays | `*/5 * * * * 1-5` | `runAllAlertChecks()` |

**Alert check flow:**
1. Fetch all `(user_id, symbol)` rows from `user_stocks`
2. For each pair: fetch quote + week-52 data (Finnhub/Yahoo), calculate RSI
3. Evaluate four conditions: 52w high, 52w low, RSI > 70, RSI < 30
4. **24-hour cooldown**: skip if same alert fired within last 24h (`isDuplicate`)
5. Insert into `alerts_log`, fetch user's push tokens, send Expo push notification
6. 300ms delay between stocks (Finnhub rate limiting)

**Manual trigger:** `POST /api/push-token/trigger-check` (dev only) runs the same flow immediately.

---

## 10. Environment Variables

### Frontend (`.env` / `app.json`)

| Variable | Used in | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_API_URL` | `lib/api.ts` | Backend base URL |
| `EXPO_PUBLIC_SUPABASE_URL` | `lib/supabase.ts` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` | Supabase anon key |
| `EXPO_PUBLIC_FINNHUB_API_KEY` | `lib/finnhub-direct.ts` | Direct Finnhub from device |
| `EXPO_PUBLIC_SENTRY_DSN` | `lib/sentry.ts` | Sentry error tracking |
| `EXPO_PUBLIC_MIXPANEL_TOKEN` | `lib/analytics.ts` | Analytics |

### Backend (`backend/.env`)

| Variable | Used in | Purpose |
|----------|---------|---------|
| `PORT` | `backend/src/index.ts` | Server port (default 3000) |
| `SUPABASE_URL` | `backend/src/lib/supabase.ts` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/src/lib/supabase.ts` | Admin DB access |
| `FINNHUB_API_KEY` | `backend/src/services/finnhub.service.ts` | Market data |
| `DEV_USER_ID` | `backend/src/routes/*.ts` | Fallback user ID in development |

---

## 11. State Management, Caching & Storage

### Mobile State

| Mechanism | What it manages | Config file |
|-----------|----------------|-------------|
| **TanStack Query** | All server state (market data, watchlist, alerts) | `lib/query-client.ts` |
| **AsyncStorage persistence** | Query cache survives app restarts (key: `STOCKVEST_QUERY_CACHE`) | `lib/query-client.ts` |
| **React Context (auth)** | Supabase session, `user`, `signOut` | `context/auth.tsx` |
| **React Context (theme)** | Dark/light mode preference | `context/theme-context.tsx` |
| **SecureStore** | Supabase session token storage | `lib/supabase.ts` |

### Backend Cache (In-Memory)

All in `backend/src/services/finnhub.service.ts` — a simple `Map<string, {data, expiresAt}>`:

| Data type | TTL |
|-----------|-----|
| Quote | 60s |
| Candles (intraday) | 5 min |
| Candles (daily) | 10 min |
| Week-52 data | 10 min |
| Company profile | 24h |
| Yahoo volume | 5 min |

Unusual volume has its own module-level cache in `polygon.service.ts` (~5 min).

---

## 12. Important Business Logic

### Alert Engine (core feature)

- **Location:** `backend/src/services/alert.service.ts`
- **Trigger:** `scheduler.service.ts` every 5 min on weekdays
- **Conditions evaluated:** 52w high (within 0.5%), 52w low (within 0.5%), RSI ≥ 70 (overbought), RSI ≤ 30 (oversold)
- **Deduplication:** 24-hour cooldown per (user, symbol, alert_type)
- **Delivery:** Writes to `alerts_log` → fetches `push_tokens` → calls Expo Push API

### Watchlist

- Stored in `user_stocks` table; enriched with live quotes and technical indicators when fetched via `GET /api/stocks`
- `stocks.ts` route calls `getQuote`, `calculateRSI`, `calculateDMA`, `calculateMomentumScore`, `calculateSupportResistance` per symbol

### Market Home Feed

- `GET /api/market/home` aggregates: market indexes, top movers, sector heatmap, earnings today, market news
- Used by `hooks/use-home-data.ts` → `components/home/` widgets

---

## 13. Request Lifecycle (API call end-to-end)

```
User action (e.g. "add stock to watchlist")
    │
    ▼
hooks/use-watchlist.ts (useMutation via TanStack Query)
    │
    ▼
lib/api.ts → watchlistApi.add(symbol)
    │  → GET /api/stocks (with x-user-id header)
    ▼
backend/src/routes/stocks.ts → getUserId(req)
    │  → supabase.from('user_stocks').insert(...)
    │  → getQuote(symbol)         [finnhub.service.ts → in-memory cache → Finnhub REST]
    │  → calculateRSI(closes)     [rsi.service.ts]
    │  → calculateDMA(closes)     [dma.service.ts]
    │  → calculateMomentumScore() [momentum.service.ts]
    ▼
JSON response → TanStack Query cache updated → UI re-renders
```

---

## 14. Known Technical Debt & Risky Areas

| Risk | Location | Detail |
|------|---------|--------|
| **No backend auth verification** | All route files | `x-user-id` header is trusted without JWT verification. Any caller can impersonate any user. Needs a Supabase JWT middleware before production. |
| **Backend has no error middleware** | `backend/src/index.ts` | Unhandled errors surface as 500 with stack trace. |
| **No rate limiting** | `backend/src/index.ts` | No `express-rate-limit` or API gateway. Finnhub key can be exhausted. |
| **In-memory cache lost on restart** | `finnhub.service.ts` | All cache entries reset on server restart. No Redis or persistent cache. |
| **Sequential alert processing** | `alert.service.ts` | All user-stock pairs processed one-by-one. Scales poorly if watchlists grow large. |
| **Stale env vars in `.env.example`** | `backend/.env.example` | `POLYGON_API_KEY` and `TWELVE_DATA_API_KEY` are documented but unused — code uses Yahoo Finance instead. Misleading for new developers. |
| **No CI/CD pipeline** | root | No `.github/workflows` or other CI config. Linting and tests are local-only. |
| **No Docker** | root | No `Dockerfile` or compose file for reproducible backend deployment. |
| **Direct Finnhub from device** | `lib/finnhub-direct.ts` | API key is embedded in mobile bundle (`EXPO_PUBLIC_*`). Key is visible to any user who decompiles the app. |

---

## 15. Coding Conventions & Patterns

- **TypeScript** throughout — strict mode, path alias `@/` maps to root
- **Expo Router** file-based routing; group routes with `(auth)`, `(tabs)` convention
- **Zod schemas** for form validation — `lib/schemas.ts`
- **React Hook Form** + Zod resolver in auth screens
- **Named exports** preferred; default exports only for Expo Router screens
- **TanStack Query** for all async data — no local state for server data
- **i18next** with `useTranslation()` hook; string keys in `locales/en.json`
- **Mixpanel** event tracking via `trackEvent()` in `lib/analytics.ts`
- **Toast** notifications via `react-native-toast-message` (`lib/toast.ts`)
- Backend services are pure functions / classes with no Express dependency (testable in isolation)
- `node-cron` scheduling isolated in `scheduler.service.ts`; alert logic lives in `alert.service.ts`

---

## 16. CI/CD, Deployment & Infrastructure

| Area | Status |
|------|-------|
| **CI/CD** | None in-repo (no `.github/workflows`) |
| **Mobile deployment** | Expo EAS (`projectId` in `app.json`); `expo-updates` for OTA |
| **Backend deployment** | Not documented; no Dockerfile or compose |
| **Database** | Supabase hosted Postgres; schema managed via `supabase/schema.sql` manually applied |
| **Tests** | Jest (`jest-expo` preset); run with `npm test` from root |
| **Linting** | ESLint (`eslint-config-expo`); run with `npm run lint` |

---

## 17. Running & Deploying

### Prerequisites

- Node.js 20+, npm/yarn
- Expo CLI (`npm install -g expo-cli`) and the **Expo Go** app on your device, or a simulator
- A Supabase project with `supabase/schema.sql` applied
- Both `.env` files populated from their `.env.example` templates

### Start the Backend

```bash
cd backend
npm install          # first time only
npm run dev          # ts-node-dev with hot reload (development)
# or
npm run build && npm start   # compile → run dist/index.js (production-like)
```

Backend listens on `http://localhost:3000` by default (`PORT` env var overrides).  
The scheduler and cache pre-warming start automatically on `listen()`.

### Run the Mobile App

```bash
# from repo root
npm install          # first time only

npx expo start       # opens Expo dev server — scan QR with Expo Go
npx expo run:ios     # run on iOS simulator (requires Xcode)
npx expo run:android # run on Android emulator (requires Android Studio)
npx expo start --web # run in browser (limited functionality)
```

Set `EXPO_PUBLIC_API_URL` in `.env` to point at your running backend (e.g. `http://192.168.x.x:3000` for a physical device on the same Wi-Fi).

### Tests & Linting

```bash
npm test             # run Jest once
npm run test:watch   # Jest in watch mode
npm run test:coverage
npm run lint         # ESLint via expo lint
```

### Deploy the Mobile App (EAS)

```bash
npm install -g eas-cli
eas login
eas build --platform ios      # build iOS binary
eas build --platform android  # build Android binary
eas submit                    # submit to App Store / Play Store
eas update                    # push an OTA update (no store review needed)
```

EAS project ID and update URL are configured in `app.json`.

### Deploy the Backend

No Docker or CI is configured. Recommended approach:

1. `npm run build` in `backend/` to compile TypeScript to `dist/`
2. Copy `dist/`, `package.json`, and `.env` to the server
3. `npm install --omit=dev && npm start`
4. Use a process manager (`pm2`, `systemd`) to keep it alive and restart on crash

---

## 18. Key File Index (Quick Reference)

| Purpose | File |
|---------|------|
| Root app shell & providers | `app/_layout.tsx` |
| Auth screens | `app/(auth)/login.tsx`, `signup.tsx`, `forgot-password.tsx` |
| Home tab | `app/(tabs)/index.tsx` |
| Stock detail | `app/stock/[symbol].tsx` |
| Supabase client (mobile) | `lib/supabase.ts` |
| Supabase admin client (backend) | `backend/src/lib/supabase.ts` |
| REST API client (mobile) | `lib/api.ts` |
| Direct Finnhub client (mobile) | `lib/finnhub-direct.ts` |
| React Query config + persistence | `lib/query-client.ts` |
| Auth context | `context/auth.tsx` |
| Backend entry | `backend/src/index.ts` |
| Alert engine | `backend/src/services/alert.service.ts` |
| Cron scheduler | `backend/src/services/scheduler.service.ts` |
| Finnhub + Yahoo Finance service | `backend/src/services/finnhub.service.ts` |
| Push notification sender | `backend/src/lib/expo-push.ts` |
| DB schema + RLS | `supabase/schema.sql` |
| Theme tokens | `constants/theme.ts` |
| i18n translations | `locales/en.json` |
