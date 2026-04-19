/**
 * Stockvest design system — matches Figma designs.
 * Primary accent: lime yellow-green (#CCFF00)
 *
 * Both LightColors and DarkColors are exported so the ThemeContext
 * can swap the entire palette based on the device color scheme.
 */

import { Platform } from 'react-native';

export type AppColors = typeof LightColors;

export const LightColors = {
  primary: '#CCFF00',       // lime yellow-green (buttons, accents)
  onPrimary: '#1A1A2E',     // text ON lime elements (always dark for contrast)
  background: '#FFFFFF',
  surface: '#F5F5F5',       // input / chip backgrounds
  cardBg: '#FFFFFF',
  dark: '#1A1A2E',          // dark accent — used for dark cards / tab bar in light mode
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  positive: '#22C55E',      // gains, buy
  negative: '#EF4444',      // losses, sell
  warning: '#F59E0B',
  border: '#E5E7EB',
  tabBar: '#1A1A2E',
  tabBarActive: '#CCFF00',
  tabBarInactive: '#6B7280',

  // Alert type colours
  alert52wHigh: '#8B5CF6',
  alert52wLow: '#F59E0B',
  alertRsiOB: '#EF4444',
  alertRsiOS: '#22C55E',

  // Legacy compat (used by useThemeColor hook)
  lightPalette: {
    text: '#1A1A2E',
    background: '#FFFFFF',
    tint: '#CCFF00',
    icon: '#6B7280',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#CCFF00',
  },
  darkPalette: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#CCFF00',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#CCFF00',
  },
};

export const DarkColors: AppColors = {
  primary: '#CCFF00',
  onPrimary: '#1A1A2E',     // stays dark — contrast on lime
  background: '#0F0F18',    // very dark navy
  surface: '#1A1A2E',       // slightly lighter dark (was `dark` in light mode)
  cardBg: '#1E1E2E',
  dark: '#1A1A2E',          // retained for dark-card elements (MarketSummary etc.)
  textPrimary: '#F0F0F0',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  positive: '#22C55E',
  negative: '#EF4444',
  warning: '#F59E0B',
  border: '#2D2D44',
  tabBar: '#0A0A14',
  tabBarActive: '#CCFF00',
  tabBarInactive: '#6B7280',

  alert52wHigh: '#8B5CF6',
  alert52wLow: '#F59E0B',
  alertRsiOB: '#EF4444',
  alertRsiOS: '#22C55E',

  lightPalette: LightColors.lightPalette,
  darkPalette: LightColors.darkPalette,
};

/** Kept for backward-compatibility — defaults to light theme. */
export const Colors = LightColors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 50,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
