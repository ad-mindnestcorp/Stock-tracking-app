/**
 * RSI-14 calculator using Wilder's smoothing method.
 * Requires at least 15 closing prices (14 periods of change).
 */

export interface RSIResult {
  rsi: number;
  isOverbought: boolean; // RSI > 70
  isOversold: boolean;   // RSI < 30
}

/**
 * Calculate RSI-14 from an array of close prices (chronological order, oldest first).
 * Returns null if not enough data.
 */
export function calculateRSI(closes: number[], period = 14): RSIResult | null {
  if (closes.length < period + 1) return null;

  const changes = closes.slice(1).map((p, i) => p - closes[i]);

  // Seed with simple average of the first period's gains/losses
  let avgGain = changes.slice(0, period).filter((c) => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = changes.slice(0, period).filter((c) => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;

  // Wilder's smoothing over all remaining periods (converges with ~250 trading days of input)
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return { rsi: 100, isOverbought: true, isOversold: false };
  }

  const rs = avgGain / avgLoss;
  const rsi = Math.round((100 - 100 / (1 + rs)) * 100) / 100;

  return {
    rsi,
    isOverbought: rsi > 70,
    isOversold: rsi < 30,
  };
}
