# EAS Secrets Setup Guide

This guide walks you through adding the necessary secrets to your EAS (Expo Application Services) project for environment-specific configurations.

## What You Need to Add

Three secrets are required in your EAS project dashboard. These secrets store the Supabase anon keys for each environment and are automatically injected during builds.

### Secrets to Create

| Secret Name | Description | Value |
|---|---|---|
| `DEV_SUPABASE_ANON_KEY` | Development Supabase public key | Your dev project's anon key |
| `STAGING_SUPABASE_ANON_KEY` | Staging Supabase public key | Your staging project's anon key |
| `PROD_SUPABASE_ANON_KEY` | Production Supabase public key | Your prod project's anon key |

## How to Add Secrets to EAS

### Step 1: Go to EAS Dashboard

1. Open [EAS Dashboard](https://expo.dev) in your browser
2. Sign in with your Expo account
3. Select your project "Stockvest"

### Step 2: Navigate to Secrets

1. Click on **Settings** (gear icon)
2. In the left sidebar, click **Secrets**

### Step 3: Create Each Secret

For each secret in the table above:

1. Click the **+ New Secret** button
2. In the **Name** field, enter the exact secret name (e.g., `DEV_SUPABASE_ANON_KEY`)
3. In the **Value** field, paste your Supabase anon key:
   - For development: Go to your dev Supabase project → Settings → API → Copy the "anon | public" key
   - For staging: Go to your staging Supabase project → Settings → API → Copy the "anon | public" key
   - For production: Go to your prod Supabase project → Settings → API → Copy the "anon | public" key
4. Click **Create Secret**
5. Repeat for the other two secrets

### Step 4: Verify Configuration

Your `eas.json` file already references these secrets:

**Development Build**
```bash
eas build --profile development
```
- Will use `$DEV_SUPABASE_ANON_KEY`
- API URL: `http://localhost:3000`

**Preview/Staging Build**
```bash
eas build --profile preview
```
- Will use `$STAGING_SUPABASE_ANON_KEY`
- API URL: `https://staging-api.yourapp.com`

**Production Build**
```bash
eas build --profile production
```
- Will use `$PROD_SUPABASE_ANON_KEY`
- API URL: `https://api.yourapp.com`

## How to Get Supabase Anon Keys

For each Supabase project:

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Settings** → **API**
4. Under "Project API keys", copy the "anon | public" key (this is safe to expose in builds)
5. Use this value in the corresponding EAS Secret

## Local Development

For local development, use your `.env` file:

```env
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key-here
```

See `.env.example` for the full template.

## Testing Your Configuration

After adding secrets, test each environment:

```bash
# Test development build
eas build --profile development --platform ios

# Test staging build
eas build --profile preview --platform ios

# Test production build (requires app signing)
eas build --profile production --platform ios
```

You can verify the environment variables are correctly injected by checking the build logs in the EAS dashboard.

## Troubleshooting

### Build fails with "Secret not found"
- Verify the secret name exactly matches the name in `eas.json` (case-sensitive)
- Make sure you created the secret in EAS Dashboard
- Try clearing the build cache and rebuilding

### Environment variables not showing in app
- Check that the build profile matches what you're building
- Verify the secret value is not empty or corrupted
- Restart the app after the build completes

### Need to update a secret value
- Go to EAS Dashboard → Secrets
- Click the secret you want to update
- Click **Edit** and paste the new value
- Click **Save**
- Rebuild the app with `eas build --profile <profile-name>`
