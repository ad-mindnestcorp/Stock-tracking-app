function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculates a Momentum Score (0–100) combining:
 *   - RSI          (40%): strength indicator, used directly as 0–100
 *   - Price Trend  (30%): 7-day % change, normalized from [-15%, +15%] to [0, 100]
 *   - Volume       (30%): relative volume normalized from [0, 3x] to [0, 100]
 *
 * Returns null if RSI is unavailable or closes has fewer than 8 data points.
 */
export function calculateMomentum(
  rsi: number | null,
  closes: number[],
  relativeVolume: number | null,
): number | null {
  if (rsi === null || closes.length < 8) return null;

  const currentClose = closes[closes.length - 1];
  const closeSevenDaysAgo = closes[closes.length - 8];
  const changePct = ((currentClose - closeSevenDaysAgo) / closeSevenDaysAgo) * 100;

  const rsiScore = rsi;
  const trendScore = clamp(((changePct + 15) / 30) * 100, 0, 100);
  const volumeScore = relativeVolume != null ? clamp((relativeVolume / 3) * 100, 0, 100) : 50;

  return Math.round(rsiScore * 0.4 + trendScore * 0.3 + volumeScore * 0.3);
}
