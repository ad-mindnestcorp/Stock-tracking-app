/**
 * Deterministic market data aggregator.
 * All numerical financial data must flow through this service — never from AI inference.
 * GPT receives only the verified output of these functions for qualitative interpretation.
 * 
 * Fallback chain: Finnhub → FMP → DATA_NOT_AVAILABLE
 */

import axios from 'axios';
import { getQuote, getCompanyProfile, getWeek52Data, getBasicFinancials, getDailyCandles } from './finnhub.service';
import { normalizePercent, normalizePercentFields, DATA_NOT_AVAILABLE } from '../utils/normalize-percent';
import { getFMPRevenueEstimates, getFMPKeyMetrics, getFMPForwardPSData, getFMPEbitdaMargin, getComprehensiveMetrics } from './fmp.service';
import { getHistoricalPSRange, getValuationBands } from './historical-valuation.service';
import { getCustomerConcentration } from './sec-filings.service';
import { getIndustryType, getMetricPriorities, type IndustryType } from '../utils/metric-mapper';
import { logMetricSources } from '../utils/metrics-logger';

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY ?? '';

const CACHE_TTL_MS = 600_000; // 10 min for derived/aggregated data

// ─── Local TTL cache (separate from research-cache which has fixed 6h TTL) ───
interface LocalCacheEntry { data: unknown; expiresAt: number }
const localCache = new Map<string, LocalCacheEntry>();
function getLocal<T>(key: string): T | null {
  const e = localCache.get(key);
  if (e && Date.now() < e.expiresAt) return e.data as T;
  localCache.delete(key);
  return null;
}
function setLocal(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  localCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface VerifiedFinancials {
  symbol: string;
  companyName: string;
  price: number;
  marketCapB: number | null;        // billions
  sharesOutstanding: number | null;
  peRatioTTM: number | null;
  pbRatioTTM: number | null;
  psTTM: number | null;
  evEbitdaTTM: number | null;
  roeTTM: number | null;
  revenueGrowthTTMYoy: number | null; // as decimal (e.g. 0.15 = 15%)
  grossMarginTTM: number | null;      // as decimal
  netProfitMarginTTM: number | null;
  ebitdaMarginTTM: number | null;     // EBITDA margin for Rule of 40
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  freeCashFlowTTM: number | null;     // absolute value
  hv30: number | null;                // 30-day historical volatility %
  dataCompleteness: number;           // 0-1 fraction of non-null fields
  fetchedAt: string;
}

export interface VerifiedShortInterest {
  symbol: string;
  shortInterestShares: number | null;
  shortInterestPct: number | null;  // % of shares outstanding
  daysToCover: number | null;
  reportDate: string | null;
  available: boolean;
}

export interface VerifiedInsiderOwnership {
  symbol: string;
  totalInsiderPct: number | null;    // aggregate % owned by insiders
  insiderCount: number | null;
  available: boolean;
}

export interface VerifiedRevenueEstimates {
  symbol: string;
  ttmRevenue: number | null;        // millions USD
  currentYearRevenue: number | null;
  nextYearRevenue: number | null;
  currentYearGrowthPct: number | null;
  nextYearGrowthPct: number | null;
  fiscalYearEnd: string | null;
  analystCount: number | null;
  available: boolean;
}

export interface VerifiedEarningsSurprise {
  quarter: string;
  actual: number | null;
  estimate: number | null;
  surprisePct: number | null;
  period: string;
}

export interface VerifiedEarnings {
  symbol: string;
  surprises: VerifiedEarningsSurprise[];
  recentMisses: number;   // count of misses in last 8 quarters
  available: boolean;
}

export interface VerifiedRelativeStrength {
  symbol: string;
  return3m: number | null;    // stock 3-month return %
  spyReturn3m: number | null; // SPY 3-month return %
  rsVsSPY: number | null;     // outperformance vs SPY %
  available: boolean;
}

export interface VerifiedPeerData {
  symbol: string;
  psTTM: number | null;
  evEbitdaTTM: number | null;
  grossMarginTTM: number | null;
  revenueGrowthTTMYoy: number | null;
  marketCapB: number | null;
}

export interface VerifiedVolumeData {
  symbol: string;
  avgVolume30d: number | null;
  currentVolume: number | null;
  volumeRatio: number | null;       // current / avg
  highVolumeDays: number;           // count of days > 2x avg volume in last 30d
  available: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute 30-day annualised historical volatility from close prices. */
export function computeHistoricalVolatility(closes: number[], period = 30): number | null {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  const returns = recent.slice(1).map((c, i) => Math.log(c / recent[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100 * 100) / 100;
}

function dataCompleteness(fields: (unknown | null)[]): number {
  const nonNull = fields.filter(f => f !== null && f !== undefined).length;
  return Math.round((nonNull / fields.length) * 100) / 100;
}

// ─── Short Interest ───────────────────────────────────────────────────────────

export async function getShortInterestData(symbol: string): Promise<VerifiedShortInterest> {
  const key = `verified:shortinterest:${symbol}`;
  const cached = getLocal<VerifiedShortInterest>(key);
  if (cached) return cached;

  const base: VerifiedShortInterest = {
    symbol, shortInterestShares: null, shortInterestPct: null,
    daysToCover: null, reportDate: null, available: false,
  };

  try {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await axios.get(`${BASE_URL}/stock/short-interest`, {
      params: { symbol, from: fromDate, to, token: API_KEY },
      timeout: 8000,
    });

    const data: Array<{ date: string; shortInterest: number; daysShort?: number }> =
      res.data?.data ?? [];

    if (!data.length) {
      setLocal(key, base);
      return base;
    }

    const latest = data[data.length - 1];
    const profile = await getCompanyProfile(symbol);
    const sharesOutstanding = (profile?.shareOutstanding ?? 0) * 1_000_000;

    const shortInterestPct =
      sharesOutstanding > 0
        ? Math.round((latest.shortInterest / sharesOutstanding) * 10000) / 100
        : null;

    const result: VerifiedShortInterest = {
      symbol,
      shortInterestShares: latest.shortInterest,
      shortInterestPct,
      daysToCover: latest.daysShort ?? null,
      reportDate: latest.date,
      available: true,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:shortinterest] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Insider Ownership ────────────────────────────────────────────────────────

export async function getInsiderOwnershipData(symbol: string): Promise<VerifiedInsiderOwnership> {
  const key = `verified:insider:${symbol}`;
  const cached = getLocal<VerifiedInsiderOwnership>(key);
  if (cached) return cached;

  const base: VerifiedInsiderOwnership = {
    symbol, totalInsiderPct: null, insiderCount: null, available: false,
  };

  try {
    const res = await axios.get(`${BASE_URL}/stock/insider-ownership`, {
      params: { symbol, token: API_KEY },
      timeout: 8000,
    });

    const data: Array<{ sharePercent: number; name: string }> = res.data?.data ?? [];
    if (!data.length) {
      setLocal(key, base);
      return base;
    }

    // Sum all insider ownership percentages
    const totalPct = data.reduce((sum, d) => sum + (d.sharePercent ?? 0), 0);
    const result: VerifiedInsiderOwnership = {
      symbol,
      totalInsiderPct: Math.round(totalPct * 100) / 100,
      insiderCount: data.length,
      available: true,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:insider] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Revenue Estimates ────────────────────────────────────────────────────────

export async function getRevenueEstimatesData(symbol: string): Promise<VerifiedRevenueEstimates> {
  const key = `verified:revestimates:${symbol}`;
  const cached = getLocal<VerifiedRevenueEstimates>(key);
  if (cached) return cached;

  const base: VerifiedRevenueEstimates = {
    symbol, ttmRevenue: null, currentYearRevenue: null, nextYearRevenue: null,
    currentYearGrowthPct: null, nextYearGrowthPct: null,
    fiscalYearEnd: null, analystCount: null, available: false,
  };

  try {
    // Try FMP first (more reliable for analyst estimates)
    const fmpEstimates = await getFMPRevenueEstimates(symbol);
    
    if (fmpEstimates.available) {
      // Get TTM revenue from Finnhub for growth calculation
      let ttmRevenue: number | null = null;
      const [profile, financials] = await Promise.all([
        getCompanyProfile(symbol),
        getBasicFinancials(symbol),
      ]);
      
      if (profile?.marketCap && financials) {
        const metricsRaw = (financials as unknown as Record<string, unknown>);
        const ps = (metricsRaw as { psTTM?: number }).psTTM ?? null;
        if (ps && ps > 0) {
          ttmRevenue = Math.round((profile.marketCap / ps) * 10) / 10;
        }
      }

      const nextGrowth = ttmRevenue && fmpEstimates.estimatedRevenueAvg
        ? Math.round(((fmpEstimates.estimatedRevenueAvg - ttmRevenue) / ttmRevenue) * 10000) / 100
        : null;

      const result: VerifiedRevenueEstimates = {
        symbol,
        ttmRevenue,
        currentYearRevenue: fmpEstimates.estimatedRevenueAvg,
        nextYearRevenue: fmpEstimates.estimatedRevenueAvg,
        currentYearGrowthPct: null,
        nextYearGrowthPct: nextGrowth,
        fiscalYearEnd: fmpEstimates.fiscalYear ?? `FY${new Date().getFullYear() + 1}`,
        analystCount: fmpEstimates.numberAnalysts,
        available: true,
      };

      setLocal(key, result);
      return result;
    }

    // Fallback to Finnhub
    const res = await axios.get(`${BASE_URL}/stock/revenue-estimate`, {
      params: { symbol, token: API_KEY },
      timeout: 8000,
    });

    const data: Array<{
      period: string; numberAnalysts: number;
      revenueAvg: number; revenueHigh: number; revenueLow: number;
    }> = res.data?.data ?? [];

    if (!data.length) {
      setLocal(key, base);
      return base;
    }

    const current = data.find(d => d.period === '0') ?? data[0];
    const next = data.find(d => d.period === '1') ?? data[1];

    let ttmRevenue: number | null = null;
    const [profile, financials] = await Promise.all([
      getCompanyProfile(symbol),
      getBasicFinancials(symbol),
    ]);
    if (profile?.marketCap && financials) {
      const metricsRaw = (financials as unknown as Record<string, unknown>);
      const ps = (metricsRaw as { psTTM?: number }).psTTM ?? null;
      if (ps && ps > 0) {
        ttmRevenue = Math.round((profile.marketCap / ps) * 10) / 10;
      }
    }

    const currentRevM = current ? Math.round(current.revenueAvg / 1e6) : null;
    const nextRevM = next ? Math.round(next.revenueAvg / 1e6) : null;

    const currentGrowth =
      ttmRevenue && currentRevM
        ? Math.round(((currentRevM - ttmRevenue) / ttmRevenue) * 10000) / 100
        : null;
    const nextGrowth =
      currentRevM && nextRevM
        ? Math.round(((nextRevM - currentRevM) / currentRevM) * 10000) / 100
        : null;

    const currentYear = new Date().getFullYear();
    const result: VerifiedRevenueEstimates = {
      symbol,
      ttmRevenue,
      currentYearRevenue: currentRevM,
      nextYearRevenue: nextRevM,
      currentYearGrowthPct: currentGrowth,
      nextYearGrowthPct: nextGrowth,
      fiscalYearEnd: `FY${currentYear + 1}`,
      analystCount: next?.numberAnalysts ?? current?.numberAnalysts ?? null,
      available: !!(currentRevM || nextRevM),
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:revestimates] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Earnings Surprises ───────────────────────────────────────────────────────

export async function getEarningsSurprisesData(symbol: string): Promise<VerifiedEarnings> {
  const key = `verified:earnings:${symbol}`;
  const cached = getLocal<VerifiedEarnings>(key);
  if (cached) return cached;

  const base: VerifiedEarnings = { symbol, surprises: [], recentMisses: 0, available: false };

  try {
    const res = await axios.get(`${BASE_URL}/stock/earnings`, {
      params: { symbol, limit: 8, token: API_KEY },
      timeout: 8000,
    });

    const raw: Array<{
      actual: number; estimate: number; period: string;
      quarter: number; surprise: number; surprisePercent: number; year: number;
    }> = res.data ?? [];

    if (!raw.length) {
      setLocal(key, base);
      return base;
    }

    const surprises: VerifiedEarningsSurprise[] = raw.map(e => ({
      quarter: `Q${e.quarter} ${e.year}`,
      actual: e.actual,
      estimate: e.estimate,
      surprisePct: e.surprisePercent != null ? Math.round(e.surprisePercent * 100) / 100 : null,
      period: e.period,
    }));

    const recentMisses = surprises.filter(
      s => s.surprisePct !== null && s.surprisePct < -2,
    ).length;

    const result: VerifiedEarnings = { symbol, surprises, recentMisses, available: true };
    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:earnings] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Relative Strength vs SPY ─────────────────────────────────────────────────

export async function getRelativeStrengthData(symbol: string): Promise<VerifiedRelativeStrength> {
  const key = `verified:rs:${symbol}`;
  const cached = getLocal<VerifiedRelativeStrength>(key);
  if (cached) return cached;

  const base: VerifiedRelativeStrength = {
    symbol, return3m: null, spyReturn3m: null, rsVsSPY: null, available: false,
  };

  try {
    const [symbolData, spyData] = await Promise.all([
      getWeek52Data(symbol),
      getWeek52Data('SPY'),
    ]);

    if (!symbolData?.closes || !spyData?.closes) {
      setLocal(key, base);
      return base;
    }

    const DAYS_3M = 63;
    const sC = symbolData.closes;
    const spyC = spyData.closes;

    const symbolReturn3m =
      sC.length >= DAYS_3M
        ? Math.round(((sC[sC.length - 1] / sC[sC.length - DAYS_3M] - 1) * 100) * 100) / 100
        : null;
    const spyReturn3m =
      spyC.length >= DAYS_3M
        ? Math.round(((spyC[spyC.length - 1] / spyC[spyC.length - DAYS_3M] - 1) * 100) * 100) / 100
        : null;

    const result: VerifiedRelativeStrength = {
      symbol,
      return3m: symbolReturn3m,
      spyReturn3m,
      rsVsSPY:
        symbolReturn3m !== null && spyReturn3m !== null
          ? Math.round((symbolReturn3m - spyReturn3m) * 100) / 100
          : null,
      available: symbolReturn3m !== null && spyReturn3m !== null,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:rs] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Volume Patterns ──────────────────────────────────────────────────────────

export async function getVolumePatternData(symbol: string): Promise<VerifiedVolumeData> {
  const key = `verified:volume:${symbol}`;
  const cached = getLocal<VerifiedVolumeData>(key);
  if (cached) return cached;

  const base: VerifiedVolumeData = {
    symbol, avgVolume30d: null, currentVolume: null, volumeRatio: null,
    highVolumeDays: 0, available: false,
  };

  try {
    const candles = await getDailyCandles(symbol, 60);
    const quote = await getQuote(symbol);

    if (!candles || candles.volume.length < 5) {
      setLocal(key, base);
      return base;
    }

    const recentVolumes = candles.volume.slice(-30).filter(v => v > 0);
    const avgVolume30d =
      recentVolumes.length > 0
        ? Math.round(recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length)
        : null;

    const currentVolume = quote.volume ?? null;
    const volumeRatio =
      avgVolume30d && currentVolume
        ? Math.round((currentVolume / avgVolume30d) * 100) / 100
        : null;

    const highVolumeDays = avgVolume30d
      ? recentVolumes.filter(v => v > avgVolume30d * 2).length
      : 0;

    const result: VerifiedVolumeData = {
      symbol,
      avgVolume30d,
      currentVolume,
      volumeRatio,
      highVolumeDays,
      available: avgVolume30d !== null,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:volume] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Peer Metrics ─────────────────────────────────────────────────────────────

export async function getPeerMetricsData(peers: string[]): Promise<Map<string, VerifiedPeerData>> {
  const results = new Map<string, VerifiedPeerData>();
  if (!peers.length) return results;

  const settled = await Promise.allSettled(
    peers.map(async (p) => {
      const [profile, financials, quote] = await Promise.all([
        getCompanyProfile(p),
        getBasicFinancials(p),
        getQuote(p),
      ]);
      const marketCapB = profile?.marketCap ? profile.marketCap / 1000 : null;
      const f = financials as unknown as Record<string, unknown> | null;
      const psTTMRaw = (f as { psTTM?: number } | null)?.psTTM ?? null;
      return {
        symbol: p,
        psTTM: psTTMRaw,
        evEbitdaTTM: financials?.evEbitdaTTM ?? null,
        grossMarginTTM: financials?.grossMarginTTM ?? null,
        revenueGrowthTTMYoy: financials?.revenueGrowthTTMYoy ?? null,
        marketCapB,
      } as VerifiedPeerData;
    }),
  );

  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      results.set(peers[i], outcome.value);
    }
  });

  return results;
}

// ─── Historical P/S Range (deterministic) ─────────────────────────────────────

export interface HistoricalPSData {
  symbol: string;
  currentPS: number | null;
  min3y: number | null;
  max3y: number | null;
  avg3y: number | null;
  percentile: number | null;
  dataPoints: number;
  available: boolean;
}

export async function getHistoricalPSData(symbol: string, currentPS: number | null, marketCapB: number | null): Promise<HistoricalPSData> {
  const key = `verified:historical_ps:${symbol}`;
  const cached = getLocal<HistoricalPSData>(key);
  if (cached) return cached;

  const base: HistoricalPSData = {
    symbol, currentPS, min3y: null, max3y: null, avg3y: null,
    percentile: null, dataPoints: 0, available: false,
  };

  if (!currentPS || !marketCapB) {
    setLocal(key, base);
    return base;
  }

  try {
    const histRange = await getHistoricalPSRange(symbol, currentPS, marketCapB);
    
    const result: HistoricalPSData = {
      symbol,
      currentPS,
      min3y: histRange.min3y,
      max3y: histRange.max3y,
      avg3y: histRange.avg3y,
      percentile: histRange.percentile,
      dataPoints: histRange.dataPoints,
      available: histRange.available,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:historical_ps] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Customer Concentration (SEC filings only) ────────────────────────────────

export interface CustomerConcentrationFiling {
  symbol: string;
  concentrationPct: string | null;
  topCustomers: Array<{
    rank: string;
    revenuePct: string;
    trend: 'Rising' | 'Stable' | 'Falling' | 'Unknown';
  }>;
  source: string | null;
  available: boolean;
}

export async function getCustomerConcentrationData(symbol: string): Promise<CustomerConcentrationFiling> {
  const key = `verified:customer_concentration:${symbol}`;
  const cached = getLocal<CustomerConcentrationFiling>(key);
  if (cached) return cached;

  const base: CustomerConcentrationFiling = {
    symbol, concentrationPct: null, topCustomers: [], source: null, available: false,
  };

  try {
    const secData = await getCustomerConcentration(symbol);
    
    const result: CustomerConcentrationFiling = {
      symbol,
      concentrationPct: secData.concentrationPct,
      topCustomers: secData.topCustomers,
      source: secData.source,
      available: secData.available,
    };

    setLocal(key, result, CACHE_TTL_MS * 24 * 7); // Cache for 1 week
    return result;
  } catch (err) {
    console.warn(`[market-data:customer_concentration] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── Valuation Bands (for asymmetry analysis) ─────────────────────────────────

export interface AsymmetryValuationData {
  symbol: string;
  currentPrice: number;
  bearCasePrice: number | null;
  bearCaseDownside: number | null;
  fairValuePrice: number | null;
  bullCasePrice: number | null;
  bullCaseUpside: number | null;
  available: boolean;
}

export async function getAsymmetryValuationData(
  symbol: string,
  currentPrice: number,
  currentPS: number | null,
  revenuePerShare: number | null,
): Promise<AsymmetryValuationData> {
  const key = `verified:asymmetry_valuation:${symbol}`;
  const cached = getLocal<AsymmetryValuationData>(key);
  if (cached) return cached;

  const base: AsymmetryValuationData = {
    symbol, currentPrice, bearCasePrice: null, bearCaseDownside: null,
    fairValuePrice: null, bullCasePrice: null, bullCaseUpside: null, available: false,
  };

  if (!currentPS || !revenuePerShare) {
    setLocal(key, base);
    return base;
  }

  try {
    const bands = await getValuationBands(symbol, currentPrice, currentPS, revenuePerShare);
    
    const result: AsymmetryValuationData = {
      symbol,
      currentPrice,
      bearCasePrice: bands.bearCasePrice,
      bearCaseDownside: bands.bearCaseDownside,
      fairValuePrice: bands.fairValuePrice,
      bullCasePrice: bands.bullCasePrice,
      bullCaseUpside: bands.bullCaseUpside,
      available: bands.available,
    };

    setLocal(key, result);
    return result;
  } catch (err) {
    console.warn(`[market-data:asymmetry_valuation] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setLocal(key, base);
    return base;
  }
}

// ─── All-in-one verified financials bundle ────────────────────────────────────
// Implements: Finnhub → FMP → DATA_NOT_AVAILABLE fallback chain
// Industry-aware: prioritizes different metrics for fintech/banks vs tech vs default

export async function getVerifiedFinancials(symbol: string): Promise<VerifiedFinancials> {
  const key = `verified:financials:${symbol}`;
  const cached = getLocal<VerifiedFinancials>(key);
  if (cached) return cached;

  // Fetch all base data in parallel
  const [quote, profile, financials, week52] = await Promise.all([
    getQuote(symbol),
    getCompanyProfile(symbol),
    getBasicFinancials(symbol),
    getWeek52Data(symbol),
  ]);

  // Determine industry type for metric prioritization
  const industryType = getIndustryType(symbol, profile?.industry);
  const priorities = getMetricPriorities(industryType);
  
  console.log(`[market-data] ${symbol} — industry: ${industryType}, profile.industry: ${profile?.industry ?? 'unknown'}`);

  // Track metric sources for logging
  const sources: Record<string, 'finnhub' | 'fmp' | 'computed' | 'unavailable'> = {};

  // Extract Finnhub metrics first
  let psTTM = financials?.psTTM ?? null;
  let peRatioTTM = financials?.peRatioTTM ?? null;
  let pbRatioTTM = financials?.pbRatioTTM ?? null;
  let evEbitdaTTM = financials?.evEbitdaTTM ?? null;
  let roeTTM = financials?.roeTTM ?? null;
  // Prefer freeCashFlowAnnual (per API docs); fall back to freeCashFlowTTM
  let freeCashFlowTTM = financials?.freeCashFlowAnnual ?? financials?.freeCashFlowTTM ?? null;
  let debtEquityTTM = financials?.debtEquityTTM ?? null;
  let currentRatioTTM = financials?.currentRatioTTM ?? null;
  let revenueGrowthTTMYoy = financials?.revenueGrowthTTMYoy ?? null;
  let grossMarginTTM = financials?.grossMarginTTM ?? null;
  let netProfitMarginTTM = financials?.netProfitMarginTTM ?? null;

  // Record Finnhub sources
  if (peRatioTTM !== null) sources.peRatioTTM = 'finnhub';
  if (pbRatioTTM !== null) sources.pbRatioTTM = 'finnhub';
  if (psTTM !== null) sources.psTTM = 'finnhub';
  if (evEbitdaTTM !== null) sources.evEbitdaTTM = 'finnhub';
  if (roeTTM !== null) sources.roeTTM = 'finnhub';
  if (freeCashFlowTTM !== null) sources.freeCashFlowTTM = 'finnhub';
  if (debtEquityTTM !== null) sources.debtEquityTTM = 'finnhub';
  if (currentRatioTTM !== null) sources.currentRatioTTM = 'finnhub';
  if (revenueGrowthTTMYoy !== null) sources.revenueGrowthTTMYoy = 'finnhub';
  if (grossMarginTTM !== null) sources.grossMarginTTM = 'finnhub';
  if (netProfitMarginTTM !== null) sources.netProfitMarginTTM = 'finnhub';

  // FMP COMPREHENSIVE FALLBACK: Use stable API endpoints for all 8 target metrics
  const needsFMPFallback = evEbitdaTTM === null || peRatioTTM === null ||
    roeTTM === null || freeCashFlowTTM === null || debtEquityTTM === null ||
    revenueGrowthTTMYoy === null || grossMarginTTM === null || currentRatioTTM === null;

  if (needsFMPFallback) {
    try {
      const comprehensive = await getComprehensiveMetrics(symbol);

      if (comprehensive.available) {
        if (peRatioTTM === null && comprehensive.peRatio !== null) {
          peRatioTTM = comprehensive.peRatio;
          sources.peRatioTTM = 'fmp';
        }
        if (evEbitdaTTM === null && comprehensive.evEbitda !== null) {
          evEbitdaTTM = comprehensive.evEbitda;
          sources.evEbitdaTTM = 'fmp';
        }
        if (roeTTM === null && comprehensive.roe !== null) {
          roeTTM = comprehensive.roe;
          sources.roeTTM = 'fmp';
        }
        if (currentRatioTTM === null && comprehensive.currentRatio !== null) {
          currentRatioTTM = comprehensive.currentRatio;
          sources.currentRatioTTM = 'fmp';
        }
        if (debtEquityTTM === null && comprehensive.debtEquity !== null) {
          debtEquityTTM = comprehensive.debtEquity;
          sources.debtEquityTTM = 'fmp';
        }
        if (grossMarginTTM === null && comprehensive.grossMargin !== null) {
          grossMarginTTM = comprehensive.grossMargin;
          sources.grossMarginTTM = 'fmp';
        }
        if (revenueGrowthTTMYoy === null && comprehensive.revenueGrowth !== null) {
          revenueGrowthTTMYoy = comprehensive.revenueGrowth;
          sources.revenueGrowthTTMYoy = 'fmp';
        }
        if (freeCashFlowTTM === null && comprehensive.freeCashFlow !== null) {
          freeCashFlowTTM = comprehensive.freeCashFlow;
          sources.freeCashFlowTTM = 'fmp';
        }
      }
    } catch (err) {
      console.warn(`[market-data] ${symbol} FMP comprehensive fallback failed: ${err instanceof Error ? err.message : err}`);
    }

    // Secondary fallback to legacy getFMPKeyMetrics for remaining gaps
    const stillMissingCritical = evEbitdaTTM === null || psTTM === null ||
      netProfitMarginTTM === null;

    if (stillMissingCritical) {
      try {
        const fmpMetrics = await getFMPKeyMetrics(symbol);

        if (fmpMetrics.available) {
          if (evEbitdaTTM === null && fmpMetrics.evToEbitda !== null) {
            evEbitdaTTM = fmpMetrics.evToEbitda;
            sources.evEbitdaTTM = 'fmp';
          }
          if (psTTM === null && fmpMetrics.priceToSalesRatio !== null) {
            psTTM = fmpMetrics.priceToSalesRatio;
            sources.psTTM = 'fmp';
          }
          if (netProfitMarginTTM === null && fmpMetrics.netProfitMargin !== null) {
            netProfitMarginTTM = fmpMetrics.netProfitMargin;
            sources.netProfitMarginTTM = 'fmp';
          }
        }
      } catch (err) {
        console.warn(`[market-data] ${symbol} FMP legacy fallback failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Mark unavailable metrics
  if (evEbitdaTTM === null) sources.evEbitdaTTM = 'unavailable';
  if (psTTM === null) sources.psTTM = 'unavailable';
  if (roeTTM === null) sources.roeTTM = 'unavailable';
  if (debtEquityTTM === null) sources.debtEquityTTM = 'unavailable';
  if (grossMarginTTM === null) sources.grossMarginTTM = 'unavailable';
  if (netProfitMarginTTM === null) sources.netProfitMarginTTM = 'unavailable';
  if (revenueGrowthTTMYoy === null) sources.revenueGrowthTTMYoy = 'unavailable';
  if (freeCashFlowTTM === null) sources.freeCashFlowTTM = 'unavailable';
  if (currentRatioTTM === null) sources.currentRatioTTM = 'unavailable';

  // Log metric sources
  logMetricSources(symbol, sources);

  // Fetch EBITDA margin from FMP (computed from income statements)
  let ebitdaMarginTTM: number | null = null;
  
  // Skip EBITDA margin for fintech/banks (not meaningful)
  if (!priorities.avoid.includes('evEbitdaTTM')) {
    try {
      const fmpEbitda = await getFMPEbitdaMargin(symbol);
      if (fmpEbitda.available && fmpEbitda.ebitdaMarginTTM !== null) {
        ebitdaMarginTTM = fmpEbitda.ebitdaMarginTTM;
        sources.ebitdaMarginTTM = 'fmp';
      }
    } catch (err) {
      console.warn(`[market-data] ${symbol} EBITDA margin fetch failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const hv30 = week52?.closes ? computeHistoricalVolatility(week52.closes, 30) : null;
  const marketCapB = profile?.marketCap ? Math.round(profile.marketCap / 10) / 100 : null;

  const fields = [
    peRatioTTM, evEbitdaTTM, roeTTM,
    revenueGrowthTTMYoy, grossMarginTTM,
    debtEquityTTM, currentRatioTTM,
  ];

  const result: VerifiedFinancials = {
    symbol,
    companyName: profile?.name ?? symbol,
    price: quote.currentPrice ?? 0,
    marketCapB,
    sharesOutstanding: profile?.shareOutstanding ?? null,
    peRatioTTM,
    pbRatioTTM,
    psTTM,
    evEbitdaTTM,
    roeTTM,
    revenueGrowthTTMYoy,
    grossMarginTTM,
    netProfitMarginTTM,
    ebitdaMarginTTM,
    debtEquityTTM,
    currentRatioTTM,
    freeCashFlowTTM,
    hv30,
    dataCompleteness: dataCompleteness(fields),
    fetchedAt: new Date().toISOString(),
  };

  // Log summary
  const availableCount = Object.values(sources).filter(s => s !== 'unavailable').length;
  const unavailableMetrics = Object.entries(sources)
    .filter(([, s]) => s === 'unavailable')
    .map(([k]) => k);
  
  console.log(`[market-data] ${symbol} — ${availableCount}/${Object.keys(sources).length} metrics available`);
  if (unavailableMetrics.length > 0) {
    console.log(`[market-data] ${symbol} — unavailable: ${unavailableMetrics.join(', ')}`);
  }

  setLocal(key, result);
  return result;
}
