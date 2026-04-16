# Stockvest — Environment & OAuth Setup Guide

This document covers every environment variable the project needs, where to get each value, and how to configure Google OAuth end-to-end.

---

## Table of Contents

1. [Frontend Environment Variables](#1-frontend-environment-variables)
2. [Backend Environment Variables](#2-backend-environment-variables)
3. [Supabase Setup](#3-supabase-setup)
4. [Google OAuth Setup](#4-google-oauth-setup)
5. [Connecting Google OAuth to Supabase](#5-connecting-google-oauth-to-supabase)
6. [Redirect URL Configuration](#6-redirect-url-configuration)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Frontend Environment Variables

File: `stockTrackingApp/.env`

```env
# Backend API base URL
# Use your machine's local IP (not localhost) when testing on a physical device
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000

# Supabase project URL — Supabase Dashboard → Settings → API → Project URL
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anon/public key — Supabase Dashboard → Settings → API → Project API keys → anon public
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** All `EXPO_PUBLIC_` variables are bundled into the client app. Never put secret keys (service role key, etc.) here.

---

## 2. Backend Environment Variables

File: `stockTrackingApp/backend/.env`

```env
# Supabase project URL — same value as EXPO_PUBLIC_SUPABASE_URL above
SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase service role key — Supabase Dashboard → Settings → API → Project API keys → service_role secret
# WARNING: This key bypasses Row Level Security. Never expose it to the client.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Finnhub API key — https://finnhub.io → Dashboard → API key
FINNHUB_API_KEY=your-finnhub-api-key-here

# Twelve Data API key (fallback) — https://twelvedata.com → Dashboard → API key
TWELVE_DATA_API_KEY=your-twelve-data-api-key-here

# Express server port
PORT=3000
```

---

## 3. Supabase Setup

### 3a. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose a name, database password, and region.
4. Wait ~2 minutes for the project to provision.

### 3b. Get your API Keys

1. In the Supabase dashboard, go to **Settings → API**.
2. Copy the following values:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` | **Project URL** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Project API keys → anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project API keys → service_role** (reveal with the eye icon) |

### 3c. Run the Database Schema

1. In the Supabase dashboard, go to **SQL Editor**.
2. Open the file `stockTrackingApp/supabase/schema.sql` from this repo.
3. Paste the entire contents into the SQL Editor and click **Run**.

This creates the `user_stocks`, `alerts_log`, and `push_tokens` tables with all required indexes.

---

## 4. Google OAuth Setup

### 4a. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project dropdown at the top → **New Project**.
3. Give it a name (e.g. "Stockvest") and click **Create**.

### 4b. Configure the OAuth Consent Screen

1. In the left sidebar go to **APIs & Services → OAuth consent screen**.
2. Select **External** → **Create**.
3. Fill in the required fields:
   - **App name**: Stockvest
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the remaining steps (you can skip Scopes for now).
5. Click **Back to Dashboard**.

### 4c. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Set a **Name** (e.g. "Stockvest Web Client").
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   Replace `your-project-ref` with your actual Supabase project reference (the subdomain in your Supabase URL).
6. Click **Create**.
7. A popup shows your credentials — copy both:
   - **Client ID** (looks like `xxxxx.apps.googleusercontent.com`)
   - **Client Secret** (looks like `GOCSPX-xxxxxx`)

---

## 5. Connecting Google OAuth to Supabase

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Find **Google** and click to expand it.
3. Toggle **Enable Sign in with Google** to ON.
4. Paste the **Client ID** and **Client Secret** you copied from Google Cloud Console.
5. Copy the **Callback URL (for OAuth)** shown in the Supabase panel — it should match what you entered in Google Cloud Console:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
6. Click **Save**.

---

## 6. Redirect URL Configuration

After OAuth completes, Supabase redirects back to your app. You must whitelist the app's redirect URL in Supabase.

### In Supabase Dashboard

Go to **Authentication → URL Configuration → Redirect URLs** and add:

| Environment | Redirect URL |
|---|---|
| Production (app store build) | `stocktrackingapp://auth/callback` |
| Development (Expo Go on device) | `exp://192.168.x.x:8081/--/auth/callback` |
| Development (Expo Go on simulator) | `exp://localhost:8081/--/auth/callback` |

> **Tip:** The Expo Go URL changes based on your local IP. When testing on a physical device, replace `192.168.x.x` with the IP shown in your terminal after running `npx expo start`.

### In Google Cloud Console

Return to **APIs & Services → Credentials → your OAuth client** and make sure the **Authorized redirect URIs** list only contains Supabase's callback:
```
https://your-project-ref.supabase.co/auth/v1/callback
```
The app-scheme URLs (`stocktrackingapp://`) go in Supabase only — Google only needs to redirect to Supabase, and Supabase then redirects to your app.

---

## 7. Testing Checklist

### Environment variables
- [ ] `EXPO_PUBLIC_API_URL` points to your backend (correct local IP + port)
- [ ] `EXPO_PUBLIC_SUPABASE_URL` matches your Supabase project URL
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` is the **anon** key (not service role)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in the **backend** `.env` only
- [ ] `FINNHUB_API_KEY` is valid and has API access

### Supabase
- [ ] Database schema has been run (`supabase/schema.sql`)
- [ ] Google provider is enabled with correct Client ID and Secret
- [ ] Redirect URL `stocktrackingapp://auth/callback` is whitelisted

### Google Cloud Console
- [ ] OAuth consent screen is configured
- [ ] Supabase callback URL is in the Authorized redirect URIs list
- [ ] App is not in a restricted publishing state (for testing, add your email as a test user under **OAuth consent screen → Test users**)

### App
- [ ] Run `npx expo start --clear` and test on a device or simulator
- [ ] Email/password sign up creates a user in Supabase **Authentication → Users**
- [ ] "With Google" button opens a browser and returns to the app after authentication
- [ ] After sign in, the Profile tab shows your email address
- [ ] Sign out returns you to the Login screen

---

## Quick Reference

| What | Where |
|---|---|
| Supabase dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) |
| Google Cloud Console | [console.cloud.google.com](https://console.cloud.google.com) |
| Finnhub API keys | [finnhub.io/dashboard](https://finnhub.io/dashboard) |
| Twelve Data API keys | [twelvedata.com/apikey](https://twelvedata.com/apikey) |
| Expo app scheme | `stocktrackingapp` (defined in `app.json → expo.scheme`) |
