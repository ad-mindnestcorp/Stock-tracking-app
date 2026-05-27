/**
 * Financial Modeling Prep (FMP) API Service
 * Provides analyst estimates, forward metrics, and financial data not available from Finnhub.
 */

import axios from 'axios';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const FMP_KEY = process.env.FMP_KEY ?? '';

const CACHE_TTL_MS = 3600_000; // 1 hour for FMP data

interface LocalCacheEntry { data: unknown; expiresAt: number }
const fmpCache = new Map<string, LocalCacheEntry>();

function getCached<T>(key: string): T | null {
  const e = fmpCache.get(key);
  if (e && Date.now() < e.expiresAt) return e.data as T;
  fmpCache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  fmpCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FMPRevenueEstimates {
  symbol: string;
  estimatedRevenueAvg: number | null; // millions USD
  estimatedRevenueLow: number | null;
  estimatedRevenueHigh: number | null;
  numberAnalysts: number | null;
  fiscalYear: string | null;
  fiscalQuarter: string | null;
  available: boolean;
}

export interface FMPAnalystEstimates {
  symbol: string;
  targetPrice: number | null;
  estimatedEbitda: number | null;
  estimatedNetIncome: number | null;
  numberAnalysts: number | null;
  fiscalYear: string | null;
  available: boolean;
}

export interface FMPKeyMetrics {
  symbol: string;
  evToEbitda: number | null;
  priceToSalesRatio: number | null;
  returnOnEquity: number | null;
  revenuePerShare: number | null;
  freeCashFlowPerShare: number | null;
  debtToEquity: number | null;
  grossProfitMargin: number | null;
  netProfitMargin: number | null;
  revenueGrowth: number | null;
  date: string | null;
  available: boolean;
}

export interface FMPAnalystEstimatesFull {
  symbol: string;
  estimatedEbitdaAvg: number | null;
  estimatedEbitdaLow: number | null;
  estimatedEbitdaHigh: number | null;
  estimatedNetIncomeAvg: number | null;
  estimatedEpsAvg: number | null;
  numberAnalysts: number | null;
  fiscalYear: string | null;
  available: boolean;
}

export interface FMPHistoricalMarketCap {
  symbol: string;
  marketCap: number | null; // USD
  date: string;
}

export interface FMPIncomeStatement {
  symbol: string;
  revenue: number | null; // USD
  grossProfit: number | null;
  operatingIncome: number | null;
  ebitda: number | null; // EBITDA from income statement
  netIncome: number | null;
  date: string;
  fiscalYear: string;
  fiscalQuarter: string | null;
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

function validateRatio(value: number | null, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (isNaN(value) || !isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function validatePercent(value: number | null): number | null {
  return validateRatio(value, -500, 1000); // -500% to 1000%
}

// Helper to check if fiscal data is stale (for future use)
function isFiscalDataStale(date: string): boolean {
  const dataDate = new Date(date);
  const now = new Date();
  const monthsDiff = (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsDiff > 6; // Stale if older than 6 months (2 quarters)
}

// Export for potential external use
export { isFiscalDataStale };

// ─── Revenue Estimates ────────────────────────────────────────────────────────

export async function getFMPRevenueEstimates(symbol: string): Promise<FMPRevenueEstimates> {
  const key = `fmp:revenue_estimates:${symbol}`;
  const cached = getCached<FMPRevenueEstimates>(key);
  if (cached) return cached;

  const base: FMPRevenueEstimates = {
    symbol,
    estimatedRevenueAvg: null,
    estimatedRevenueLow: null,
    estimatedRevenueHigh: null,
    numberAnalysts: null,
    fiscalYear: null,
    fiscalQuarter: null,
    available: false,
  };

  if (!FMP_KEY) {
    console.warn('[fmp:revenue_estimates] FMP_KEY not configured');
    setCached(key, base);
    return base;
  }

  try {
    const res = await axios.get(`${FMP_BASE_URL}/analyst-estimates/${symbol}`, {
      params: { apikey: FMP_KEY, limit: 4 },
      timeout: 8000,
    });

    const data: {
      date: string;
      estimatedRevenueAvg: number;
      estimatedRevenueLow: number;
      estimatedRevenueHigh: number;
      numberAnalystEstimatedRevenue: number;
    }[] = res.data ?? [];

    if (!data.length) {
      setCached(key, base);
      return base;
    }

    // Get most recent forward estimate
    const latest = data[0];
    const fiscalDate = new Date(latest.date);

    const result: FMPRevenueEstimates = {
      symbol,
      estimatedRevenueAvg: latest.estimatedRevenueAvg ? Math.round(latest.estimatedRevenueAvg / 1e6) : null,
      estimatedRevenueLow: latest.estimatedRevenueLow ? Math.round(latest.estimatedRevenueLow / 1e6) : null,
      estimatedRevenueHigh: latest.estimatedRevenueHigh ? Math.round(latest.estimatedRevenueHigh / 1e6) : null,
      numberAnalysts: latest.numberAnalystEstimatedRevenue ?? null,
      fiscalYear: fiscalDate.getFullYear().toString(),
      fiscalQuarter: `Q${Math.ceil((fiscalDate.getMonth() + 1) / 3)}`,
      available: !!latest.estimatedRevenueAvg,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:revenue_estimates] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Key Metrics ──────────────────────────────────────────────────────────────

export async function getFMPKeyMetrics(symbol: string): Promise<FMPKeyMetrics> {
  const key = `fmp:key_metrics:${symbol}`;
  const cached = getCached<FMPKeyMetrics>(key);
  if (cached) return cached;

  const base: FMPKeyMetrics = {
    symbol,
    evToEbitda: null,
    priceToSalesRatio: null,
    returnOnEquity: null,
    revenuePerShare: null,
    freeCashFlowPerShare: null,
    debtToEquity: null,
    grossProfitMargin: null,
    netProfitMargin: null,
    revenueGrowth: null,
    date: null,
    available: false,
  };

  if (!FMP_KEY) {
    console.warn('[fmp:key_metrics] FMP_KEY not configured');
    setCached(key, base);
    return base;
  }

  try {
    // Fetch both key-metrics-ttm and ratios-ttm for comprehensive coverage
    const [metricsRes, ratiosRes] = await Promise.all([
      axios.get(`${FMP_BASE_URL}/key-metrics-ttm/${symbol}`, {
        params: { apikey: FMP_KEY },
        timeout: 8000,
      }),
      axios.get(`${FMP_BASE_URL}/ratios-ttm/${symbol}`, {
        params: { apikey: FMP_KEY },
        timeout: 8000,
      }).catch(() => ({ data: [] })), // Fallback if ratios endpoint fails
    ]);

    const metricsData: {
      evToEbitdaTTM: number;
      priceToSalesRatioTTM: number;
      roeTTM: number;
      revenuePerShareTTM: number;
      freeCashFlowPerShareTTM: number;
      debtToEquityTTM: number;
    }[] = metricsRes.data ?? [];

    const ratiosData: {
      grossProfitMarginTTM?: number;
      netProfitMarginTTM?: number;
      revenueGrowthTTM?: number;
    }[] = ratiosRes.data ?? [];

    if (!metricsData.length) {
      setCached(key, base);
      return base;
    }

    const metrics = metricsData[0];
    const ratios = ratiosData[0] ?? {};

    const result: FMPKeyMetrics = {
      symbol,
      evToEbitda: validateRatio(metrics.evToEbitdaTTM, -100, 500),
      priceToSalesRatio: validateRatio(metrics.priceToSalesRatioTTM, 0, 200),
      returnOnEquity: validatePercent(metrics.roeTTM),
      revenuePerShare: metrics.revenuePerShareTTM ?? null,
      freeCashFlowPerShare: metrics.freeCashFlowPerShareTTM ?? null,
      debtToEquity: validateRatio(metrics.debtToEquityTTM, 0, 20),
      grossProfitMargin: validatePercent(ratios.grossProfitMarginTTM ?? null),
      netProfitMargin: validatePercent(ratios.netProfitMarginTTM ?? null),
      revenueGrowth: validatePercent(ratios.revenueGrowthTTM ?? null),
      date: new Date().toISOString().split('T')[0],
      available: true,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:key_metrics] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Forward EBITDA Estimates ─────────────────────────────────────────────────

export async function getFMPAnalystEstimatesFull(symbol: string): Promise<FMPAnalystEstimatesFull> {
  const key = `fmp:analyst_estimates_full:${symbol}`;
  const cached = getCached<FMPAnalystEstimatesFull>(key);
  if (cached) return cached;

  const base: FMPAnalystEstimatesFull = {
    symbol,
    estimatedEbitdaAvg: null,
    estimatedEbitdaLow: null,
    estimatedEbitdaHigh: null,
    estimatedNetIncomeAvg: null,
    estimatedEpsAvg: null,
    numberAnalysts: null,
    fiscalYear: null,
    available: false,
  };

  if (!FMP_KEY) {
    console.warn('[fmp:analyst_estimates_full] FMP_KEY not configured');
    setCached(key, base);
    return base;
  }

  try {
    const res = await axios.get(`${FMP_BASE_URL}/analyst-estimates/${symbol}`, {
      params: { apikey: FMP_KEY, limit: 4 },
      timeout: 8000,
    });

    const data: {
      date: string;
      estimatedEbitdaAvg: number;
      estimatedEbitdaLow: number;
      estimatedEbitdaHigh: number;
      estimatedNetIncomeAvg: number;
      estimatedEpsAvg: number;
      numberAnalystsEstimatedEps: number;
    }[] = res.data ?? [];

    if (!data.length) {
      setCached(key, base);
      return base;
    }

    // Get most recent forward estimate (first item is typically next fiscal year)
    const latest = data[0];
    const fiscalDate = new Date(latest.date);

    const result: FMPAnalystEstimatesFull = {
      symbol,
      estimatedEbitdaAvg: latest.estimatedEbitdaAvg ?? null,
      estimatedEbitdaLow: latest.estimatedEbitdaLow ?? null,
      estimatedEbitdaHigh: latest.estimatedEbitdaHigh ?? null,
      estimatedNetIncomeAvg: latest.estimatedNetIncomeAvg ?? null,
      estimatedEpsAvg: latest.estimatedEpsAvg ?? null,
      numberAnalysts: latest.numberAnalystsEstimatedEps ?? null,
      fiscalYear: fiscalDate.getFullYear().toString(),
      available: !!(latest.estimatedEbitdaAvg || latest.estimatedNetIncomeAvg),
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:analyst_estimates_full] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Enterprise Value ─────────────────────────────────────────────────────────

export interface FMPEnterpriseValue {
  symbol: string;
  enterpriseValue: number | null;
  marketCap: number | null;
  date: string | null;
  available: boolean;
}

export async function getFMPEnterpriseValue(symbol: string): Promise<FMPEnterpriseValue> {
  const key = `fmp:enterprise_value:${symbol}`;
  const cached = getCached<FMPEnterpriseValue>(key);
  if (cached) return cached;

  const base: FMPEnterpriseValue = {
    symbol,
    enterpriseValue: null,
    marketCap: null,
    date: null,
    available: false,
  };

  if (!FMP_KEY) {
    console.warn('[fmp:enterprise_value] FMP_KEY not configured');
    setCached(key, base);
    return base;
  }

  try {
    const res = await axios.get(`${FMP_BASE_URL}/enterprise-values/${symbol}`, {
      params: { apikey: FMP_KEY, limit: 1 },
      timeout: 8000,
    });

    const data: {
      date: string;
      enterpriseValue: number;
      marketCapitalization: number;
    }[] = res.data ?? [];

    if (!data.length) {
      setCached(key, base);
      return base;
    }

    const latest = data[0];

    const result: FMPEnterpriseValue = {
      symbol,
      enterpriseValue: latest.enterpriseValue ?? null,
      marketCap: latest.marketCapitalization ?? null,
      date: latest.date ?? null,
      available: !!latest.enterpriseValue,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:enterprise_value] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Historical Market Cap ────────────────────────────────────────────────────

export async function getFMPHistoricalMarketCap(symbol: string, years = 5): Promise<FMPHistoricalMarketCap[]> {
  const key = `fmp:historical_mcap:${symbol}:${years}`;
  const cached = getCached<FMPHistoricalMarketCap[]>(key);
  if (cached) return cached;

  if (!FMP_KEY) {
    console.warn('[fmp:historical_mcap] FMP_KEY not configured');
    return [];
  }

  try {
    const res = await axios.get(`${FMP_BASE_URL}/historical-market-capitalization/${symbol}`, {
      params: { apikey: FMP_KEY, limit: years * 365 },
      timeout: 10000,
    });

    const data: { date: string; marketCap: number }[] = res.data ?? [];

    if (!data.length) {
      setCached(key, []);
      return [];
    }

    // Sample quarterly to reduce data volume
    const quarterly = data.filter((_, i) => i % 63 === 0).slice(0, years * 4);

    const result = quarterly.map(d => ({
      symbol,
      marketCap: d.marketCap,
      date: d.date,
    }));

    setCached(key, result, CACHE_TTL_MS * 24); // Cache for 24 hours
    return result;
  } catch (err) {
    console.warn(`[fmp:historical_mcap] ${symbol} — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── Income Statement (for revenue history) ───────────────────────────────────

export async function getFMPIncomeStatements(symbol: string, years = 5): Promise<FMPIncomeStatement[]> {
  const key = `fmp:income_statements:${symbol}:${years}`;
  const cached = getCached<FMPIncomeStatement[]>(key);
  if (cached) return cached;

  if (!FMP_KEY) {
    console.warn('[fmp:income_statements] FMP_KEY not configured');
    return [];
  }

  try {
    const res = await axios.get(`${FMP_BASE_URL}/income-statement/${symbol}`, {
      params: { apikey: FMP_KEY, limit: years * 4 }, // Quarterly data
      timeout: 10000,
    });

    const data: {
      date: string;
      revenue: number;
      grossProfit: number;
      operatingIncome: number;
      ebitda: number;
      netIncome: number;
      calendarYear: string;
      period: string;
    }[] = res.data ?? [];

    if (!data.length) {
      setCached(key, []);
      return [];
    }

    const result = data.map(d => ({
      symbol,
      revenue: d.revenue,
      grossProfit: d.grossProfit,
      operatingIncome: d.operatingIncome,
      ebitda: d.ebitda ?? null,
      netIncome: d.netIncome,
      date: d.date,
      fiscalYear: d.calendarYear,
      fiscalQuarter: d.period,
    }));

    setCached(key, result, CACHE_TTL_MS * 24); // Cache for 24 hours
    return result;
  } catch (err) {
    console.warn(`[fmp:income_statements] ${symbol} — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── EBITDA Margin (for Rule of 40) ───────────────────────────────────────────

export interface FMPEbitdaMargin {
  symbol: string;
  ebitdaMarginTTM: number | null; // as decimal (e.g., 0.25 = 25%)
  ttmEbitda: number | null;
  ttmRevenue: number | null;
  available: boolean;
}

export async function getFMPEbitdaMargin(symbol: string): Promise<FMPEbitdaMargin> {
  const key = `fmp:ebitda_margin:${symbol}`;
  const cached = getCached<FMPEbitdaMargin>(key);
  if (cached) return cached;

  const base: FMPEbitdaMargin = {
    symbol,
    ebitdaMarginTTM: null,
    ttmEbitda: null,
    ttmRevenue: null,
    available: false,
  };

  if (!FMP_KEY) {
    setCached(key, base);
    return base;
  }

  try {
    // Get last 4 quarters of income statements for TTM calculation
    const statements = await getFMPIncomeStatements(symbol, 1);

    if (statements.length < 4) {
      setCached(key, base);
      return base;
    }

    // Sum last 4 quarters for TTM values
    const last4 = statements.slice(0, 4);
    const ttmRevenue = last4.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
    const ttmEbitda = last4.reduce((sum, s) => sum + (s.ebitda ?? 0), 0);

    if (ttmRevenue <= 0) {
      setCached(key, base);
      return base;
    }

    const ebitdaMarginTTM = ttmEbitda / ttmRevenue;

    // Validate: EBITDA margin should be between -100% and 100%
    if (ebitdaMarginTTM < -1 || ebitdaMarginTTM > 1) {
      console.warn(`[fmp:ebitda_margin] ${symbol} — invalid EBITDA margin: ${Math.round(ebitdaMarginTTM * 100)}%`);
      setCached(key, base);
      return base;
    }

    const result: FMPEbitdaMargin = {
      symbol,
      ebitdaMarginTTM: Math.round(ebitdaMarginTTM * 10000) / 10000, // 4 decimal precision
      ttmEbitda,
      ttmRevenue,
      available: true,
    };

    console.log(`[fmp:ebitda_margin] ${symbol} — TTM EBITDA Margin: ${Math.round(ebitdaMarginTTM * 100)}%`);
    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:ebitda_margin] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Forward P/S and EV/EBITDA Data (integrated) ──────────────────────────────

export interface FMPForwardPSData {
  symbol: string;
  currentMarketCap: number | null; // USD
  currentEV: number | null; // USD - Enterprise Value
  nextYearRevenue: number | null; // USD
  currentYearRevenue: number | null; // USD
  ttmRevenue: number | null; // USD
  nextYearEbitda: number | null; // USD
  forwardPS: number | null;
  ttmPS: number | null;
  forwardEvEbitda: number | null;
  analystCount: number | null;
  fiscalYear: string | null;
  available: boolean;
}

export async function getFMPForwardPSData(symbol: string, currentMarketCapB: number | null): Promise<FMPForwardPSData> {
  const key = `fmp:forward_ps:${symbol}`;
  const cached = getCached<FMPForwardPSData>(key);
  if (cached) return cached;

  const base: FMPForwardPSData = {
    symbol,
    currentMarketCap: currentMarketCapB ? currentMarketCapB * 1e9 : null,
    currentEV: null,
    nextYearRevenue: null,
    currentYearRevenue: null,
    ttmRevenue: null,
    nextYearEbitda: null,
    forwardPS: null,
    ttmPS: null,
    forwardEvEbitda: null,
    analystCount: null,
    fiscalYear: null,
    available: false,
  };

  if (!FMP_KEY || !currentMarketCapB) {
    setCached(key, base);
    return base;
  }

  try {
    // Fetch all required data in parallel
    const [revenueEstimates, ebitdaEstimates, enterpriseValue, incomeStatements] = await Promise.all([
      getFMPRevenueEstimates(symbol),
      getFMPAnalystEstimatesFull(symbol),
      getFMPEnterpriseValue(symbol),
      getFMPIncomeStatements(symbol, 1),
    ]);

    if (!revenueEstimates.available && !ebitdaEstimates.available) {
      setCached(key, base);
      return base;
    }

    const marketCapUSD = currentMarketCapB * 1e9;
    const evUSD = enterpriseValue.enterpriseValue ?? marketCapUSD; // Fallback to market cap if EV unavailable
    const nextYearRevenueUSD = revenueEstimates.estimatedRevenueAvg ? revenueEstimates.estimatedRevenueAvg * 1e6 : null;
    const ttmRevenueUSD = incomeStatements.length > 0 ? incomeStatements.slice(0, 4).reduce((sum, s) => sum + (s.revenue ?? 0), 0) : null;
    const nextYearEbitdaUSD = ebitdaEstimates.estimatedEbitdaAvg ?? null;

    const forwardPS = nextYearRevenueUSD && nextYearRevenueUSD > 0
      ? Math.round((marketCapUSD / nextYearRevenueUSD) * 100) / 100
      : null;

    const ttmPS = ttmRevenueUSD && ttmRevenueUSD > 0
      ? Math.round((marketCapUSD / ttmRevenueUSD) * 100) / 100
      : null;

    // Compute Forward EV/EBITDA
    const forwardEvEbitda = nextYearEbitdaUSD && nextYearEbitdaUSD > 0
      ? Math.round((evUSD / nextYearEbitdaUSD) * 100) / 100
      : null;

    const result: FMPForwardPSData = {
      symbol,
      currentMarketCap: marketCapUSD,
      currentEV: evUSD,
      nextYearRevenue: nextYearRevenueUSD,
      currentYearRevenue: revenueEstimates.estimatedRevenueAvg ? revenueEstimates.estimatedRevenueAvg * 1e6 : null,
      ttmRevenue: ttmRevenueUSD,
      nextYearEbitda: nextYearEbitdaUSD,
      forwardPS: validateRatio(forwardPS, 0, 200),
      ttmPS: validateRatio(ttmPS, 0, 200),
      forwardEvEbitda: validateRatio(forwardEvEbitda, -100, 500),
      analystCount: revenueEstimates.numberAnalysts ?? ebitdaEstimates.numberAnalysts,
      fiscalYear: revenueEstimates.fiscalYear ?? ebitdaEstimates.fiscalYear,
      available: forwardPS !== null || forwardEvEbitda !== null,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[fmp:forward_ps] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}
