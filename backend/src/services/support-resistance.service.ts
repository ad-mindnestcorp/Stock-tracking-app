export type SRSignal = 'near_support' | 'near_resistance' | null;

export interface SRResult {
  support: number;
  resistance: number;
  signal: SRSignal;
}

const DEFAULT_THRESHOLD = 0.03; // 3%

export function calculateSupportResistance(
  recentLows: number[],
  recentHighs: number[],
  currentPrice: number,
  threshold = DEFAULT_THRESHOLD
): SRResult {
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);
  const signal: SRSignal =
    currentPrice <= support * (1 + threshold)
      ? 'near_support'
      : currentPrice >= resistance * (1 - threshold)
        ? 'near_resistance'
        : null;
  return { support, resistance, signal };
}
