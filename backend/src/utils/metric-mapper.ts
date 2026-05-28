/**
 * Centralized Metric Mapper
 * All financial metric extraction, normalization, and mapping logic lives here.
 * Verified field names from official API documentation.
 */

import { DATA_NOT_AVAILABLE } from './normalize-percent';

// ─── Industry Classification ──────────────────────────────────────────────────

export type IndustryType = 
  | 'fintech'
  | 'bank'
  | 'insurance'
  | 'reit'
  | 'technology'
  | 'healthcare'
  | 'energy'
  | 'consumer'
  | 'industrial'
  | 'default';

const FINTECH_KEYWORDS = ['fintech', 'payment', 'digital bank', 'neobank', 'lending', 'credit'];
const BANK_KEYWORDS = ['bank', 'banking', 'savings', 'credit union', 'financial services'];
const INSURANCE_KEYWORDS = ['insurance', 'underwriter', 'reinsurance'];
const REIT_KEYWORDS = ['reit', 'real estate investment', 'property'];

export function classifyIndustry(industry: string | null | undefined): IndustryType {
  if (!industry) return 'default';
  const lower = industry.toLowerCase();
  
  if (FINTECH_KEYWORDS.some(k => lower.includes(k))) return 'fintech';
  if (BANK_KEYWORDS.some(k => lower.includes(k))) return 'bank';
  if (INSURANCE_KEYWORDS.some(k => lower.includes(k))) return 'insurance';
  if (REIT_KEYWORDS.some(k => lower.includes(k))) return 'reit';
  if (lower.includes('tech') || lower.includes('software') || lower.includes('semiconductor')) return 'technology';
  if (lower.includes('health') || lower.includes('pharma') || lower.includes('biotech')) return 'healthcare';
  if (lower.includes('energy') || lower.includes('oil') || lower.includes('gas')) return 'energy';
  if (lower.includes('consumer') || lower.includes('retail')) return 'consumer';
  if (lower.includes('industrial') || lower.includes('aerospace') || lower.includes('defense')) return 'industrial';
  
  return 'default';
}

// Static symbol-to-industry mapping for known fintech/bank stocks
const KNOWN_FINTECH_SYMBOLS = new Set(['SOFI', 'UPST', 'AFRM', 'LC', 'PYPL', 'SQ', 'COIN', 'HOOD', 'NU']);
const KNOWN_BANK_SYMBOLS = new Set(['JPM', 'BAC', 'WFC', 'C', 'USB', 'PNC', 'TFC', 'COF', 'DFS', 'AXP']);

export function getIndustryType(symbol: string, industry?: string | null): IndustryType {
  const upperSymbol = symbol.toUpperCase();
  if (KNOWN_FINTECH_SYMBOLS.has(upperSymbol)) return 'fintech';
  if (KNOWN_BANK_SYMBOLS.has(upperSymbol)) return 'bank';
  return classifyIndustry(industry);
}

// ─── Null-Safe Extraction ─────────────────────────────────────────────────────

export interface ExtractResult<T> {
  value: T | null;
  source: 'finnhub' | 'fmp' | 'computed' | 'unavailable';
  raw?: unknown;
  warning?: string;
}

/**
 * Safely extract a numeric value from an API response.
 * Returns null for undefined, NaN, Infinity, or non-numeric values.
 */
export function safeNumber(value: unknown, fieldName?: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) {
      if (fieldName) console.debug(`[metric-mapper] ${fieldName}: invalid number ${value}`);
      return null;
    }
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isFinite(parsed) || isNaN(parsed)) return null;
    return parsed;
  }
  return null;
}

/**
 * Safely extract a percentage value, normalizing decimals to percent.
 * Values between -1 and 1 are treated as decimals and multiplied by 100.
 */
export function safePercent(value: unknown, fieldName?: string): number | null {
  const num = safeNumber(value, fieldName);
  if (num === null) return null;
  
  // If absolute value is <= 1, treat as decimal and convert to percent
  if (Math.abs(num) <= 1) {
    return Math.round(num * 100 * 100) / 100; // 2 decimal precision
  }
  
  return Math.round(num * 100) / 100;
}

/**
 * Validate a ratio is within expected bounds.
 */
export function validateRatio(value: number | null, min: number, max: number, fieldName?: string): number | null {
  if (value === null) return null;
  if (value < min || value > max) {
    if (fieldName) console.debug(`[metric-mapper] ${fieldName}=${value} outside range [${min}, ${max}]`);
    return null;
  }
  return Math.round(value * 100) / 100;
}

// ─── Finnhub API Field Mappings (verified from docs) ──────────────────────────
// Endpoint: GET /stock/metric?symbol=X&metric=all
// Response structure: { metric: { ... }, series: { ... } }

export interface FinnhubMetricRaw {
  // P/E Ratios
  peTTM?: number;
  peExclExtraTTM?: number;
  peNormalizedAnnual?: number;
  
  // P/B Ratios
  pbAnnual?: number;
  pbQuarterly?: number;
  
  // P/S Ratios
  psTTM?: number;
  psAnnual?: number;
  
  // Enterprise Value Ratios
  currentEv?: number;
  enterpriseValue?: number;
  evToRevenueTTM?: number;
  
  // Profitability
  roeTTM?: number;
  roaTTM?: number;
  roiTTM?: number;
  
  // Margins
  grossMarginTTM?: number;
  operatingMarginTTM?: number;
  netProfitMarginTTM?: number;
  
  // Growth
  revenueGrowthTTMYoy?: number;
  revenueGrowth3Y?: number;
  revenueGrowth5Y?: number;
  epsGrowthTTMYoy?: number;
  
  // Leverage
  totalDebt_totalEquityAnnual?: number;
  totalDebt_totalEquityQuarterly?: number;
  longTermDebt_equityAnnual?: number;
  
  // Liquidity
  currentRatioAnnual?: number;
  currentRatioQuarterly?: number;
  quickRatioAnnual?: number;
  
  // Cash Flow
  freeCashFlowTTM?: number;
  freeCashFlowPerShareTTM?: number;
  cashFlowPerShareTTM?: number;
  
  // Valuation (NOTE: Finnhub does NOT have evToEbitda directly!)
  // currentEv_freeCashFlowTTM is EV/FCF, not EV/EBITDA
  currentEv_freeCashFlowTTM?: number;
  
  // Bank/Financial specific (Finnhub has limited support)
  netInterestMarginTTM?: number;
  bookValuePerShareAnnual?: number;
  tangibleBookValuePerShareAnnual?: number;
}

export function extractFinnhubMetrics(raw: FinnhubMetricRaw | null): Record<string, number | null> {
  if (!raw) return {};
  
  return {
    peRatioTTM: safeNumber(raw.peTTM ?? raw.peExclExtraTTM, 'finnhub.peTTM'),
    pbRatioTTM: safeNumber(raw.pbAnnual ?? raw.pbQuarterly, 'finnhub.pbAnnual'),
    psTTM: safeNumber(raw.psTTM ?? raw.psAnnual, 'finnhub.psTTM'),
    
    roeTTM: safePercent(raw.roeTTM, 'finnhub.roeTTM'),
    roaTTM: safePercent(raw.roaTTM, 'finnhub.roaTTM'),
    
    grossMarginTTM: safePercent(raw.grossMarginTTM, 'finnhub.grossMarginTTM'),
    netProfitMarginTTM: safePercent(raw.netProfitMarginTTM, 'finnhub.netProfitMarginTTM'),
    operatingMarginTTM: safePercent(raw.operatingMarginTTM, 'finnhub.operatingMarginTTM'),
    
    revenueGrowthTTMYoy: safePercent(raw.revenueGrowthTTMYoy, 'finnhub.revenueGrowthTTMYoy'),
    epsGrowthTTMYoy: safePercent(raw.epsGrowthTTMYoy, 'finnhub.epsGrowthTTMYoy'),
    
    debtEquityTTM: validateRatio(safeNumber(raw.totalDebt_totalEquityAnnual ?? raw.totalDebt_totalEquityQuarterly, 'finnhub.debtEquity'), 0, 50, 'finnhub.debtEquity'),
    currentRatioTTM: validateRatio(safeNumber(raw.currentRatioAnnual ?? raw.currentRatioQuarterly, 'finnhub.currentRatio'), 0, 20, 'finnhub.currentRatio'),
    quickRatioTTM: validateRatio(safeNumber(raw.quickRatioAnnual, 'finnhub.quickRatio'), 0, 20, 'finnhub.quickRatio'),
    
    freeCashFlowTTM: safeNumber(raw.freeCashFlowTTM, 'finnhub.freeCashFlowTTM'),
    freeCashFlowPerShareTTM: safeNumber(raw.freeCashFlowPerShareTTM, 'finnhub.freeCashFlowPerShareTTM'),
    
    // Note: Finnhub does NOT provide evToEbitda - use FMP for this
    evFcfTTM: validateRatio(safeNumber(raw.currentEv_freeCashFlowTTM, 'finnhub.evFcfTTM'), -100, 500, 'finnhub.evFcfTTM'),
    
    // Bank-specific
    netInterestMarginTTM: safePercent(raw.netInterestMarginTTM, 'finnhub.netInterestMarginTTM'),
    bookValuePerShare: safeNumber(raw.bookValuePerShareAnnual, 'finnhub.bookValuePerShare'),
    tangibleBookValuePerShare: safeNumber(raw.tangibleBookValuePerShareAnnual, 'finnhub.tangibleBookValuePerShare'),
  };
}

// ─── FMP API Field Mappings (verified from docs) ──────────────────────────────
// Endpoint: GET /key-metrics-ttm/{symbol}
// Endpoint: GET /ratios-ttm/{symbol}

export interface FMPKeyMetricsTTMRaw {
  // Valuation
  peRatioTTM?: number;
  pegRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  priceToBookRatioTTM?: number;
  enterpriseValueOverEBITDATTM?: number;  // This is the correct field name!
  evToSalesTTM?: number;
  evToOperatingCashFlowTTM?: number;
  evToFreeCashFlowTTM?: number;
  
  // Per Share
  revenuePerShareTTM?: number;
  netIncomePerShareTTM?: number;
  operatingCashFlowPerShareTTM?: number;
  freeCashFlowPerShareTTM?: number;
  cashPerShareTTM?: number;
  bookValuePerShareTTM?: number;
  tangibleBookValuePerShareTTM?: number;
  
  // Profitability
  roeTTM?: number;
  roaTTM?: number;
  returnOnCapitalEmployedTTM?: number;
  
  // Debt
  debtToEquityTTM?: number;
  debtToAssetsTTM?: number;
  netDebtToEBITDATTM?: number;
  
  // Liquidity
  currentRatioTTM?: number;
  
  // Other
  interestCoverageTTM?: number;
  dividendYieldTTM?: number;
  payoutRatioTTM?: number;
  
  // Growth (not in key-metrics-ttm, in financial-growth endpoint)
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  epsgrowth?: number;
}

export interface FMPRatiosTTMRaw {
  // Profitability
  grossProfitMarginTTM?: number;
  operatingProfitMarginTTM?: number;
  pretaxProfitMarginTTM?: number;
  netProfitMarginTTM?: number;
  ebitdaMarginTTM?: number;  // Not always present - compute from income statement
  
  // Return
  returnOnAssetsTTM?: number;
  returnOnEquityTTM?: number;
  returnOnCapitalEmployedTTM?: number;
  
  // Liquidity
  currentRatioTTM?: number;
  quickRatioTTM?: number;
  cashRatioTTM?: number;
  
  // Leverage
  debtRatioTTM?: number;
  debtEquityRatioTTM?: number;
  longTermDebtToCapitalizationTTM?: number;
  totalDebtToCapitalizationTTM?: number;
  interestCoverageTTM?: number;
  
  // Efficiency
  assetTurnoverTTM?: number;
  inventoryTurnoverTTM?: number;
  receivablesTurnoverTTM?: number;
  payablesTurnoverTTM?: number;
  
  // Growth
  revenueGrowthTTM?: number;  // This is the field in ratios-ttm!
  
  // Valuation
  priceEarningsRatioTTM?: number;
  priceToBookRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  priceToFreeCashFlowsRatioTTM?: number;
  enterpriseValueMultipleTTM?: number;  // Another name for EV/EBITDA
  priceFairValueTTM?: number;
}

export function extractFMPMetrics(
  keyMetrics: FMPKeyMetricsTTMRaw | null,
  ratios: FMPRatiosTTMRaw | null
): Record<string, number | null> {
  const km = keyMetrics ?? {};
  const rt = ratios ?? {};
  
  return {
    // EV/EBITDA - FMP specific field names (verified)
    evEbitdaTTM: validateRatio(
      safeNumber(km.enterpriseValueOverEBITDATTM ?? rt.enterpriseValueMultipleTTM, 'fmp.evEbitda'),
      -100, 500, 'fmp.evEbitda'
    ),
    
    // P/S
    psTTM: validateRatio(
      safeNumber(km.priceToSalesRatioTTM ?? rt.priceToSalesRatioTTM, 'fmp.psTTM'),
      0, 200, 'fmp.psTTM'
    ),
    
    // P/E
    peRatioTTM: validateRatio(
      safeNumber(km.peRatioTTM ?? rt.priceEarningsRatioTTM, 'fmp.peTTM'),
      -500, 1000, 'fmp.peTTM'
    ),
    
    // P/B
    pbRatioTTM: validateRatio(
      safeNumber(km.priceToBookRatioTTM ?? rt.priceToBookRatioTTM, 'fmp.pbTTM'),
      0, 100, 'fmp.pbTTM'
    ),
    
    // ROE
    roeTTM: safePercent(km.roeTTM ?? rt.returnOnEquityTTM, 'fmp.roeTTM'),
    
    // Margins
    grossMarginTTM: safePercent(rt.grossProfitMarginTTM, 'fmp.grossMarginTTM'),
    netProfitMarginTTM: safePercent(rt.netProfitMarginTTM, 'fmp.netProfitMarginTTM'),
    operatingMarginTTM: safePercent(rt.operatingProfitMarginTTM, 'fmp.operatingMarginTTM'),
    ebitdaMarginTTM: safePercent(rt.ebitdaMarginTTM, 'fmp.ebitdaMarginTTM'),
    
    // Growth - Use ratios-ttm field name
    revenueGrowthTTM: safePercent(rt.revenueGrowthTTM, 'fmp.revenueGrowthTTM'),
    
    // Debt/Equity
    debtEquityTTM: validateRatio(
      safeNumber(km.debtToEquityTTM ?? rt.debtEquityRatioTTM, 'fmp.debtEquityTTM'),
      0, 50, 'fmp.debtEquityTTM'
    ),
    
    // Current Ratio
    currentRatioTTM: validateRatio(
      safeNumber(km.currentRatioTTM ?? rt.currentRatioTTM, 'fmp.currentRatioTTM'),
      0, 20, 'fmp.currentRatioTTM'
    ),
    
    // Quick Ratio
    quickRatioTTM: validateRatio(
      safeNumber(rt.quickRatioTTM, 'fmp.quickRatioTTM'),
      0, 20, 'fmp.quickRatioTTM'
    ),
    
    // FCF
    freeCashFlowPerShareTTM: safeNumber(km.freeCashFlowPerShareTTM, 'fmp.fcfPerShareTTM'),
    
    // Book Value (for banks/fintech)
    bookValuePerShareTTM: safeNumber(km.bookValuePerShareTTM, 'fmp.bookValuePerShareTTM'),
    tangibleBookValuePerShareTTM: safeNumber(km.tangibleBookValuePerShareTTM, 'fmp.tangibleBookValuePerShareTTM'),
    
    // Interest Coverage
    interestCoverageTTM: safeNumber(km.interestCoverageTTM ?? rt.interestCoverageTTM, 'fmp.interestCoverageTTM'),
  };
}

// ─── Metric Display Formatters ────────────────────────────────────────────────

export function formatMetricValue(value: number | null | undefined, type: 'ratio' | 'percent' | 'currency' | 'number' = 'number'): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return DATA_NOT_AVAILABLE;
  }
  
  switch (type) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return value.toFixed(2);
    case 'currency':
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
      return `$${value.toFixed(0)}`;
    default:
      return value.toFixed(2);
  }
}

// ─── Industry-Aware Metric Priorities ─────────────────────────────────────────

export interface MetricPriority {
  primary: string[];   // Most important metrics for this industry
  secondary: string[]; // Supporting metrics
  avoid: string[];     // Metrics less meaningful for this industry
}

export function getMetricPriorities(industryType: IndustryType): MetricPriority {
  switch (industryType) {
    case 'fintech':
    case 'bank':
      return {
        primary: ['pbRatioTTM', 'roeTTM', 'netInterestMarginTTM', 'bookValuePerShare', 'tangibleBookValuePerShare'],
        secondary: ['peRatioTTM', 'debtEquityTTM', 'revenueGrowthTTM'],
        avoid: ['evEbitdaTTM', 'grossMarginTTM'], // Less meaningful for financials
      };
    case 'insurance':
      return {
        primary: ['pbRatioTTM', 'roeTTM', 'combinedRatio'],
        secondary: ['peRatioTTM', 'bookValuePerShare'],
        avoid: ['evEbitdaTTM', 'grossMarginTTM', 'currentRatioTTM'],
      };
    case 'reit':
      return {
        primary: ['dividendYield', 'ffoPerShare', 'pbRatioTTM'],
        secondary: ['debtEquityTTM', 'roeTTM'],
        avoid: ['peRatioTTM', 'evEbitdaTTM'], // Use FFO-based metrics
      };
    case 'technology':
      return {
        primary: ['evEbitdaTTM', 'psTTM', 'grossMarginTTM', 'revenueGrowthTTM'],
        secondary: ['peRatioTTM', 'roeTTM', 'freeCashFlowTTM'],
        avoid: [],
      };
    default:
      return {
        primary: ['peRatioTTM', 'evEbitdaTTM', 'roeTTM', 'revenueGrowthTTM'],
        secondary: ['grossMarginTTM', 'debtEquityTTM', 'currentRatioTTM', 'freeCashFlowTTM'],
        avoid: [],
      };
  }
}

// ─── Combined Metric Extraction with Fallback ─────────────────────────────────

export interface UnifiedMetrics {
  // Valuation
  peRatioTTM: number | null;
  pbRatioTTM: number | null;
  psTTM: number | null;
  evEbitdaTTM: number | null;
  
  // Profitability
  roeTTM: number | null;
  grossMarginTTM: number | null;
  netProfitMarginTTM: number | null;
  ebitdaMarginTTM: number | null;
  
  // Growth
  revenueGrowthTTM: number | null;
  
  // Financial Health
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  freeCashFlowTTM: number | null;
  
  // Source tracking
  sources: Record<string, 'finnhub' | 'fmp' | 'computed' | 'unavailable'>;
}

export function mergeMetrics(
  finnhubMetrics: Record<string, number | null>,
  fmpMetrics: Record<string, number | null>
): UnifiedMetrics {
  const sources: Record<string, 'finnhub' | 'fmp' | 'computed' | 'unavailable'> = {};
  
  function pickWithSource(key: string): number | null {
    if (finnhubMetrics[key] !== null && finnhubMetrics[key] !== undefined) {
      sources[key] = 'finnhub';
      return finnhubMetrics[key];
    }
    if (fmpMetrics[key] !== null && fmpMetrics[key] !== undefined) {
      sources[key] = 'fmp';
      return fmpMetrics[key];
    }
    sources[key] = 'unavailable';
    return null;
  }
  
  // For EV/EBITDA, prefer FMP since Finnhub doesn't have it
  function pickEvEbitda(): number | null {
    if (fmpMetrics.evEbitdaTTM !== null && fmpMetrics.evEbitdaTTM !== undefined) {
      sources.evEbitdaTTM = 'fmp';
      return fmpMetrics.evEbitdaTTM;
    }
    sources.evEbitdaTTM = 'unavailable';
    return null;
  }
  
  return {
    peRatioTTM: pickWithSource('peRatioTTM'),
    pbRatioTTM: pickWithSource('pbRatioTTM'),
    psTTM: pickWithSource('psTTM'),
    evEbitdaTTM: pickEvEbitda(),
    
    roeTTM: pickWithSource('roeTTM'),
    grossMarginTTM: pickWithSource('grossMarginTTM'),
    netProfitMarginTTM: pickWithSource('netProfitMarginTTM'),
    ebitdaMarginTTM: pickWithSource('ebitdaMarginTTM'),
    
    revenueGrowthTTM: pickWithSource('revenueGrowthTTM') ?? pickWithSource('revenueGrowthTTMYoy'),
    
    debtEquityTTM: pickWithSource('debtEquityTTM'),
    currentRatioTTM: pickWithSource('currentRatioTTM'),
    freeCashFlowTTM: pickWithSource('freeCashFlowTTM'),
    
    sources,
  };
}
