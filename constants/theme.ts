/**
 * Stockvest design system — matches Figma designs.
 * Primary accent: lime yellow-green (#CCFF00)
 */

import { Platform } from 'react-native';

export const Colors = {
  primary: '#CCFF00',       // lime yellow-green (buttons, accents)
  background: '#FFFFFF',
  surface: '#F5F5F5',       // card backgrounds
  dark: '#1A1A2E',          // primary text, tab bar bg
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  positive: '#22C55E',      // gains, buy, positive
  negative: '#EF4444',      // losses, sell, negative
  warning: '#F59E0B',
  border: '#E5E7EB',
  cardBg: '#FFFFFF',
  tabBar: '#1A1A2E',
  tabBarActive: '#CCFF00',
  tabBarInactive: '#6B7280',

  // Alert type colors
  alert52wHigh: '#8B5CF6',    // purple
  alert52wLow: '#F59E0B',     // amber
  alertRsiOB: '#EF4444',      // red (overbought)
  alertRsiOS: '#22C55E',      // green (oversold)

  // Light/dark palette for legacy compatibility
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
