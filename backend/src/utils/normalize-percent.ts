/**
 * Centralized percentage normalization utility.
 * Ensures consistent handling of percent values across all modules.
 */

export const DATA_NOT_AVAILABLE = 'DATA_NOT_AVAILABLE';

export interface NormalizeResult {
  value: number | null;
  display: string;
  valid: boolean;
  warning?: string;
}

/**
 * Normalize a percentage value to consistent format.
 * 
 * Rules:
 * - If abs(value) <= 1 → treat as decimal, multiply by 100
 * - Otherwise treat as already-percent
 * - Reject values outside -1000% to 1000%
 * - Return DATA_NOT_AVAILABLE if invalid
 */
export function normalizePercent(
  value: number | null | undefined,
  fieldName?: string,
): NormalizeResult {
  if (value === null || value === undefined || !isFinite(value)) {
    return {
      value: null,
      display: DATA_NOT_AVAILABLE,
      valid: false,
      warning: fieldName ? `${fieldName}: value is null or invalid` : undefined,
    };
  }

  let normalized: number;

  // If absolute value is <= 1, treat as decimal and convert to percent
  if (Math.abs(value) <= 1) {
    normalized = value * 100;
  } else {
    normalized = value;
  }

  // Validate range: -1000% to 1000%
  if (normalized < -1000 || normalized > 1000) {
    return {
      value: null,
      display: DATA_NOT_AVAILABLE,
      valid: false,
      warning: fieldName 
        ? `${fieldName}=${normalized}% is outside valid range [-1000%, 1000%]`
        : `Value ${normalized}% is outside valid range [-1000%, 1000%]`,
    };
  }

  // Round to 1 decimal place
  const rounded = Math.round(normalized * 10) / 10;

  return {
    value: rounded,
    display: `${rounded}%`,
    valid: true,
  };
}

/**
 * Format a normalized percent value for display.
 * Returns DATA_NOT_AVAILABLE if null.
 */
export function formatPercent(value: number | null | undefined): string {
  const result = normalizePercent(value);
  return result.display;
}

/**
 * Normalize and validate multiple percent fields.
 * Returns sanitized values and collected warnings.
 */
export function normalizePercentFields(
  fields: Record<string, number | null | undefined>,
): { sanitized: Record<string, number | null>; warnings: string[] } {
  const sanitized: Record<string, number | null> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const result = normalizePercent(value, key);
    sanitized[key] = result.value;
    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  return { sanitized, warnings };
}

/**
 * Check if a percent value is within valid range after normalization.
 */
export function isValidPercent(value: number | null | undefined): boolean {
  return normalizePercent(value).valid;
}
