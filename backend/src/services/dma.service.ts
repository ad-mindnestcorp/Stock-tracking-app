export interface DMAResult {
  ma50: number | null;
  ma200: number | null;
  ma50Trend: 'green' | 'red' | null;
  ma200Trend: 'green' | 'red' | null;
}

/**
 * Calculate 50-day and 200-day simple moving averages from an array of
 * closing prices (chronological order, oldest first) and compare them to
 * the current price to determine trend direction.
 *
 * Returns null for an MA when there are not enough data points (< 200 closes
 * → ma200 / ma200Trend are null; < 50 closes → both are null).
 */
export function calculateDMA(closes: number[], currentPrice: number): DMAResult {
  const ma50 =
    closes.length >= 50
      ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50
      : null;
  const ma200 =
    closes.length >= 200
      ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
      : null;

  return {
    ma50,
    ma200,
    ma50Trend: ma50 !== null ? (currentPrice > ma50 ? 'green' : 'red') : null,
    ma200Trend: ma200 !== null ? (currentPrice > ma200 ? 'green' : 'red') : null,
  };
}
