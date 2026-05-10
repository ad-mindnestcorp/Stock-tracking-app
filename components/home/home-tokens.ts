/**
 * Local design tokens for the rebuilt Home screen.
 * Intentionally NOT wired into constants/theme.ts so the rest of the app
 * (Watchlist, Alerts, etc.) keeps its existing lime/light theme.
 */

export const HOME = {
  bg: '#0a0a0a',
  card: '#161616',
  cardElevated: '#1e1e1e',
  border: '#2a2a2a',
  borderSoft: '#1e1e1e',
  separator: '#141414',

  textPrimary: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#444444',

  accent: '#4a7eff',
  positive: '#26d98e',
  negative: '#ff4d4d',

  // Heatmap shades
  heatmapStrongGreen: '#1a5c30',
  heatmapLightGreen: '#0f3520',
  heatmapLightRed: '#3a1a1a',
  heatmapStrongRed: '#5c1a1a',

  badgeEarningsBg: '#1a2a1a',
  badgeMacroBg: '#1a1a3a',
  badgeRedBg: '#2a1a1a',

  radius: { card: 12, button: 8, pill: 16 } as const,
} as const;

export function getHeatmapColor(changePercent: number | null | undefined): string {
  if (changePercent == null || !Number.isFinite(changePercent)) return HOME.borderSoft;
  if (changePercent > 1) return HOME.heatmapStrongGreen;
  if (changePercent > 0) return HOME.heatmapLightGreen;
  if (changePercent > -1) return HOME.heatmapLightRed;
  return HOME.heatmapStrongRed;
}

export function getChangeColor(changePercent: number | null | undefined): string {
  if (changePercent == null) return HOME.textSecondary;
  return changePercent >= 0 ? HOME.positive : HOME.negative;
}
