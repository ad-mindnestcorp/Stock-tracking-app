---
name: Stockvest Alert App
overview: Build the Stockvest MVP core — the Node.js/Express backend with Finnhub API integration, RSI engine, cron-based alert scheduler, and the mobile screens that consume live data (Home, Watchlist, Stock Detail, Alerts). Auth screens are deferred.
todos:
  - id: supabase-schema
    content: Create Supabase project and run schema SQL (user_stocks, alerts_log, push_tokens tables)
    status: completed
  - id: backend-core
    content: Scaffold Node.js/Express TypeScript backend — Finnhub service (quotes + 52W OHLC), RSI-14 calculator, alert checker with deduplication, node-cron scheduler
    status: completed
  - id: backend-routes
    content: Build REST API routes — POST/GET/DELETE /api/stocks, GET/PATCH /api/alerts, GET /api/market/quote/:symbol, POST /api/push-token
    status: completed
  - id: mobile-tabs
    content: Set up Expo Router tab navigator (skip auth guard for now — use hardcoded dev user), Figma-styled bottom nav
    status: completed
  - id: home-screen
    content: "Build Home screen: market index card + Trending/Top Gainer/Loser/Most Active tabs pulling live data from Finnhub via backend"
    status: completed
  - id: watchlist-screen
    content: Build Watchlist screen — add stock by symbol, live price badges, RSI/52W alert indicator chips, swipe to delete
    status: completed
  - id: stock-detail
    content: Build Stock Detail screen — live price, OHLC chart with time range selector, RSI stat, 52W high/low bar, Add to Watchlist button
    status: completed
  - id: alerts-screen
    content: Build Alerts screen showing triggered alert log with type badges (RSI_OB, RSI_OS, 52W_H, 52W_L) and mark-as-read
    status: completed
  - id: push-notifications
    content: Wire up Expo push token registration on mobile and Expo Push API calls from backend scheduler
    status: completed
isProject: false
---

# Stockvest MVP — Build Plan (Phase 1: Finnhub + Core Engine)

## Tech Stack

- **Mobile**: React Native + Expo Go + Expo Router + TypeScript
- **Backend**: Node.js + Express + TypeScript (in `/backend` subfolder)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Stock Data**: Finnhub API (primary), Twelve Data (fallback)
- **Notifications**: Expo Push Notifications
- **Background Jobs**: `node-cron` (every 5 min)

---

## Design System (from Figma)

- **App name**: Stockvest (candlestick icon + lime highlight on "t")
- **Primary accent**: `#D4F500` (lime yellow-green)
- **Background**: `#FFFFFF`
- **Negative/red**: `#E53935`
- **Positive/green**: `#22C55E`
- **Dark text**: `#1A1A2E`
- **Buttons**: 50px border radius, full-width, lime for primary / outline for secondary
- **Cards**: 12–16px border radius, white with soft shadow
- **Bottom tab**: Home, Watchlist (star), Alerts (pie-chart icon → bell), Transactions (clipboard), Profile

---

## Screens — Phase 1 Focus

- **Home** — `app/(tabs)/index.tsx` — market index card + Trending/Gainers/Losers tabs (live Finnhub data)
- **Watchlist** — `app/(tabs)/watchlist.tsx` — add stocks by symbol, live prices, alert indicator chips
- **Stock Detail** — `app/stock/[symbol].tsx` — price chart, RSI stat, 52W high/low, Add to Watchlist
- **Alerts** — `app/(tabs)/alerts.tsx` — triggered alerts with RSI/52W badges, mark-read

> Auth screens (Splash, Login, Register, Forgot Password) and Profile are deferred to Phase 2.

---

## Supabase Schema

```sql
-- user_stocks (watchlist)
CREATE TABLE user_stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  company_name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- alerts_log
CREATE TABLE alerts_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL,  -- '52w_high' | '52w_low' | 'rsi_overbought' | 'rsi_oversold'
  message TEXT,
  price DECIMAL,
  rsi DECIMAL,
  is_read BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- push_tokens
CREATE TABLE push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  UNIQUE(user_id, token)
);
```

---

## Backend Structure (`/backend`)

```
backend/
├── src/
│   ├── index.ts                 # Express server entry
│   ├── routes/
│   │   ├── stocks.ts            # POST/GET/DELETE watchlist
│   │   ├── alerts.ts            # GET alerts, PATCH mark-read
│   │   └── push-token.ts        # POST register token
│   ├── services/
│   │   ├── finnhub.service.ts   # Fetch quotes + 52w data
│   │   ├── rsi.service.ts       # RSI-14 calculation
│   │   ├── alert.service.ts     # Check conditions, avoid duplicates
│   │   └── scheduler.service.ts # node-cron every 5 min
│   └── lib/
│       ├── supabase.ts          # Supabase admin client
│       └── expo-push.ts         # Send push via Expo API
├── package.json
└── tsconfig.json
```

### Backend API Endpoints

- `POST /api/stocks` — add stock to watchlist
- `GET /api/stocks` — get user's watchlist
- `DELETE /api/stocks/:symbol` — remove from watchlist
- `GET /api/alerts` — get user's alert history
- `PATCH /api/alerts/:id/read` — mark alert read
- `POST /api/push-token` — register Expo push token
- `GET /api/market/quote/:symbol` — get live quote

---

## Cron Logic (every 5 min)

```
For each user_stock:
  1. Fetch 1Y daily OHLC from Finnhub
  2. Calculate 52-week high/low
  3. Calculate RSI-14 from close prices
  4. Check: price >= 52W high → alert
  5. Check: price <= 52W low → alert
  6. Check: RSI > 70 → alert (overbought)
  7. Check: RSI < 30 → alert (oversold)
  8. If new condition (deduplicated by alert_type+symbol+day):
     → Insert into alerts_log
     → Send Expo push notification
```

---

## Mobile File Structure

```
app/
├── _layout.tsx              # Root layout (auth guard)
├── index.tsx                # Splash screen
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (tabs)/
│   ├── _layout.tsx          # Bottom tab navigator
│   ├── index.tsx            # Home
│   ├── watchlist.tsx        # Watchlist
│   ├── alerts.tsx           # Alerts
│   ├── transactions.tsx     # Alert history (by date)
│   └── profile.tsx          # Profile
└── stock/
    └── [symbol].tsx         # Stock detail

components/
├── ui/
│   ├── button.tsx
│   ├── input.tsx
│   └── card.tsx
├── stock-list-item.tsx
├── alert-badge.tsx
├── market-chart.tsx
└── ...

lib/
├── supabase.ts              # Supabase browser client
├── api.ts                   # Calls to Express backend
└── notifications.ts         # Expo push token registration
```

---

## Environment Variables

**Mobile** (`.env`):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` (backend base URL)

**Backend** (`.env`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINNHUB_API_KEY`
- `TWELVE_DATA_API_KEY`

---

## Implementation Order — Phase 1

1. Supabase schema (user_stocks, alerts_log, push_tokens)
2. Backend: Express scaffold + Supabase admin client + Finnhub service (quote + candles)
3. Backend: RSI-14 calculator + 52W high/low logic
4. Backend: Alert checker with deduplication + node-cron scheduler
5. Backend: REST routes (stocks, alerts, market quote)
6. Backend: Expo Push notification sender
7. Mobile: Tab navigator (no auth guard, dev user hardcoded temporarily)
8. Mobile: Home screen consuming `/api/market` endpoints
9. Mobile: Watchlist screen + Stock Detail screen
10. Mobile: Alerts screen + push token registration

> Phase 2 (later): Auth screens, Profile, Transactions history
