/**
 * Analytics — thin wrapper around Mixpanel.
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('stock_viewed', { symbol: 'AAPL' });
 *
 * To activate: set EXPO_PUBLIC_MIXPANEL_TOKEN in your .env file.
 * Get your token from mixpanel.com → your project → Settings → Project Token.
 */

import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';

// All defined event names — extend this union as the app grows
export type AnalyticsEvent =
  // Auth
  | 'sign_up'
  | 'sign_in'
  | 'sign_in_google'
  | 'sign_out'
  // Watchlist
  | 'stock_added'
  | 'stock_removed'
  // Navigation
  | 'stock_viewed'
  | 'tab_changed'
  // Alerts
  | 'alert_read'
  | 'alerts_cleared'
  // Search
  | 'search_submitted'
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'first_value_viewed'
  // AI Research
  | 'ai_research_free_used'
  // Subscription / Paywall
  | 'paywall_viewed'
  | 'subscription_started'
  | 'subscription_restored';

let mp: Mixpanel | null = null;

export async function initAnalytics(): Promise<void> {
  if (!TOKEN) return;
  mp = new Mixpanel(TOKEN, /* trackAutomaticEvents */ true);
  await mp.init();
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!mp) return;
  mp.identify(userId);
  if (traits) mp.getPeople().set(traits);
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (!mp) return;
  mp.track(event, props ?? {});
}

export function reset(): void {
  if (!mp) return;
  mp.reset();
}
