export type AnalyticsEvent =
  | 'sign_up'
  | 'sign_in'
  | 'sign_in_google'
  | 'sign_out'
  | 'stock_added'
  | 'stock_removed'
  | 'stock_viewed'
  | 'tab_changed'
  | 'alert_read'
  | 'alerts_cleared'
  | 'search_submitted';

export async function initAnalytics(): Promise<void> {}
export function identify(_userId: string, _traits?: Record<string, unknown>): void {}
export function track(_event: AnalyticsEvent, _props?: Record<string, unknown>): void {}
export function reset(): void {}
