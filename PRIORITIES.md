# Stockvest — Priority Backlog

## P0 — Critical / Security (must fix before any public release)

| # | Item | Description |
|---|------|-------------|
| P0-1 | **Backend auth trust model** | The API trusts the `x-user-id` header sent from the client, allowing any caller to spoof another user's data. Replace with server-side JWT verification via Supabase Auth before exposing the backend publicly. |
| P0-2 | **Unprotected `/trigger-check` endpoint** | `POST /api/push-token/trigger-check` runs the full alert scheduler with zero authentication, making it trivially abusable for DoS or excessive Finnhub API costs. Add auth middleware or remove the endpoint from production builds. |
| P0-3 | **`DEV_USER_ID` fallback in production** | The backend falls back to `'dev-user'` when no user ID is present, which can silently expose or corrupt data if deployed publicly without environment guards. Ensure this fallback is compile-gated to development only. |

---

## P1 — High / Product Correctness (fix soon, breaks UX or onboarding)

| # | Item | Description |
|---|------|-------------|  
| P1-1 | **README is still the Expo template** | `README.md` contains the default `create-expo-app` boilerplate and says nothing about Stockvest, the backend, or required environment variables. Replace it with a project-specific overview pointing to `SETUP.md`. |
| P1-2 | **Google sign-in missing from login screen** | `SETUP.md` documents Google OAuth as part of the login flow, but `login.tsx` has no Google button — only `signup.tsx` implements it. Either add Google to login or update the documentation to reflect the current flow. |
| P1-3 | **Twelve Data API key documented but never used** | `SETUP.md`, `backend/.env.example`, and `backend/.env` all reference `TWELVE_DATA_API_KEY`, but no backend TypeScript code calls Twelve Data — only Finnhub is used. Remove the key from all env files and docs, or implement the intended fallback. |
| P1-4 | **Scheduler runs all day, not market hours** | The cron expression `*/5 * * * 1-5` fires every 5 minutes all day on weekdays. Comments in the code claim it respects US market hours (9:30–4 ET), but no time filter is applied, wasting Finnhub quota and firing off-hours alerts. |

---

## P2 — Medium / UX & Completeness (meaningful gaps, prioritize after P1)

| # | Item | Description |
|---|------|-------------|
| P2-1 | **Watchlist RSI / 52W proximity chips missing** | The internal build plan and `Instructions.md` describe small indicator chips on each watchlist row showing RSI and 52W proximity status, but the current UI has no such chips. Implement or formally descope this feature. |
| P2-2 | **No swipe-to-delete on watchlist** | The plan specifies swipe-to-delete; the current implementation uses a trash icon and long-press confirmation only. Add `react-native-gesture-handler` swipe actions or update the spec to match reality. |
| P2-3 | **`transactions.tsx` route name is misleading** | The "History" tab uses a file and route named `transactions`, implying brokerage transactions, but it actually shows alert history grouped by date. Rename to `history.tsx` / route `history` for clarity. |
| P2-4 | **EAS store submission credentials empty** | `eas.json` has empty `appleId`, `ascAppId`, `appleTeamId`, and `serviceAccountKeyPath` fields. Fill these in and document the EAS submit workflow in `SETUP.md` before targeting production store releases. |

---

## P3 — Low / Polish (quality-of-life, defer until stable)

| # | Item | Description |
|---|------|-------------|
| P3-1 | **Developer Tools block visible in production** | The "Trigger Alert Check Now" button and developer section in `profile.tsx` are always rendered. Gate them behind `__DEV__` or a feature flag so they are stripped from production builds. |
| P3-2 | **No FK or RLS in the Supabase schema** | `supabase/schema.sql` lacks a foreign key from `user_id` to `auth.users` and contains no Row Level Security policies. Document why (service-role-only access) or add policies to prevent accidental anon-key exposure. |
| P3-3 | **Splash screen shows fake stock data** | The decorative `MOCK_STOCKS` percentages on `app/index.tsx` display fabricated price changes as if they were live. Replace with a static design or real data to avoid misleading users during first launch. |
| P3-4 | **Internal plan file is out of sync with code** | `.cursor/plans/stockvest_alert_app_5d78aa5d.plan.md` still marks items like "auth deferred" as pending even though auth is implemented, and references Twelve Data which was never built. Archive or update the plan to reflect current state. |
