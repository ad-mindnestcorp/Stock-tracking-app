/**
 * Structured Metrics Logger
 * Logs API responses, field mappings, and validation results to the logs folder.
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGS_DIR = path.join(__dirname, '../../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export interface MetricLogEntry {
  timestamp: string;
  symbol: string;
  source: 'finnhub' | 'fmp' | 'computed';
  endpoint: string;
  rawFields: Record<string, unknown>;
  mappedFields: Record<string, number | null>;
  validationWarnings: string[];
  success: boolean;
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOGS_DIR, `metrics-${date}.log`);
}

function formatLogEntry(entry: MetricLogEntry): string {
  return JSON.stringify(entry, null, 0) + '\n';
}

/**
 * Log a metric extraction result to the daily log file.
 */
export function logMetricExtraction(entry: MetricLogEntry): void {
  try {
    const logPath = getLogFilePath();
    fs.appendFileSync(logPath, formatLogEntry(entry));
  } catch (err) {
    console.warn('[metrics-logger] Failed to write log:', err);
  }
}

/**
 * Log a raw API response for debugging.
 */
export function logApiResponse(
  symbol: string,
  source: 'finnhub' | 'fmp',
  endpoint: string,
  response: unknown,
  error?: Error
): void {
  const entry: MetricLogEntry = {
    timestamp: new Date().toISOString(),
    symbol,
    source,
    endpoint,
    rawFields: typeof response === 'object' && response !== null ? response as Record<string, unknown> : { raw: response },
    mappedFields: {},
    validationWarnings: error ? [error.message] : [],
    success: !error,
  };
  
  logMetricExtraction(entry);
}

/**
 * Log field mapping results with source tracking.
 */
export function logFieldMapping(
  symbol: string,
  source: 'finnhub' | 'fmp',
  rawFields: Record<string, unknown>,
  mappedFields: Record<string, number | null>,
  warnings: string[] = []
): void {
  const entry: MetricLogEntry = {
    timestamp: new Date().toISOString(),
    symbol,
    source,
    endpoint: source === 'finnhub' ? '/stock/metric' : '/key-metrics-ttm',
    rawFields: filterRelevantFields(rawFields),
    mappedFields,
    validationWarnings: warnings,
    success: Object.values(mappedFields).some(v => v !== null),
  };
  
  logMetricExtraction(entry);
}

/**
 * Filter out irrelevant fields for cleaner logs.
 */
function filterRelevantFields(raw: Record<string, unknown>): Record<string, unknown> {
  const relevantKeys = [
    'peTTM', 'peExclExtraTTM', 'pbAnnual', 'psTTM', 'roeTTM', 'roaTTM',
    'grossMarginTTM', 'netProfitMarginTTM', 'revenueGrowthTTMYoy',
    'totalDebt_totalEquityAnnual', 'currentRatioAnnual', 'freeCashFlowTTM',
    'currentEv_freeCashFlowTTM', 'evToEbitdaTTM', 'enterpriseValueOverEBITDATTM',
    'priceToSalesRatioTTM', 'priceToBookRatioTTM', 'debtToEquityTTM',
    'grossProfitMarginTTM', 'revenueGrowthTTM', 'debtEquityRatioTTM',
    'enterpriseValueMultipleTTM',
  ];
  
  const filtered: Record<string, unknown> = {};
  for (const key of relevantKeys) {
    if (key in raw && raw[key] !== undefined) {
      filtered[key] = raw[key];
    }
  }
  return filtered;
}

/**
 * Log validation failure for a specific metric.
 */
export function logValidationFailure(
  symbol: string,
  fieldName: string,
  rawValue: unknown,
  reason: string
): void {
  const entry: MetricLogEntry = {
    timestamp: new Date().toISOString(),
    symbol,
    source: 'computed',
    endpoint: 'validation',
    rawFields: { [fieldName]: rawValue },
    mappedFields: { [fieldName]: null },
    validationWarnings: [`${fieldName}: ${reason} (raw: ${JSON.stringify(rawValue)})`],
    success: false,
  };
  
  logMetricExtraction(entry);
}

/**
 * Log a summary of metric sources for a symbol.
 */
export function logMetricSources(
  symbol: string,
  sources: Record<string, 'finnhub' | 'fmp' | 'computed' | 'unavailable'>
): void {
  const unavailable = Object.entries(sources)
    .filter(([, src]) => src === 'unavailable')
    .map(([key]) => key);
  
  if (unavailable.length > 0) {
    console.log(`[metrics] ${symbol} — unavailable: ${unavailable.join(', ')}`);
  }
  
  const fromFMP = Object.entries(sources)
    .filter(([, src]) => src === 'fmp')
    .map(([key]) => key);
  
  if (fromFMP.length > 0) {
    console.debug(`[metrics] ${symbol} — FMP fallback: ${fromFMP.join(', ')}`);
  }
}
