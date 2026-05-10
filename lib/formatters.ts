/**
 * Number / time formatters for the Home screen and shared market UI.
 * Rules per the feature guide:
 *   - Price < $1,000     →  $X.XX           (e.g. $48.72)
 *   - Price ≥ $1,000     →  $X,XXX.XX       (e.g. $1,224.40)
 *   - % change           →  +X.XX% / −X.XX% (always signed; minus uses U+2212)
 *   - Volume / cap       →  abbreviated with K / M / B / T
 *   - Null / NaN price   →  "--"
 */

const MINUS = '\u2212';

export function formatPrice(value: number | null | undefined, currency = '$'): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1000) {
    return `${currency}${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${currency}${value.toFixed(2)}`;
}

/** Same as formatPrice but without the currency symbol (for tighter layouts). */
export function formatNumberCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toFixed(2);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (value > 0) return `+${value.toFixed(digits)}%`;
  if (value < 0) return `${MINUS}${Math.abs(value).toFixed(digits)}%`;
  return `0.00%`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(0);
}

/** Unix seconds → "2h ago" / "3d ago" */
export function formatTimeAgo(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return '';
  const diffMs = Date.now() - unixSeconds * 1000;
  if (diffMs < 0) return 'just now';
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.floor(day / 30);
  return `${month}mo ago`;
}

/** Map Finnhub earnings hour codes to human labels. */
export function earningsHourLabel(hour: string | null | undefined): string {
  if (hour === 'bmo') return 'Before Open';
  if (hour === 'amc') return 'After Close';
  if (hour === 'dmh') return 'During Hours';
  return 'TBD';
}
