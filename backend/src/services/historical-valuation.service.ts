/**
 * Historical Valuation Service
 * Computes historical P/S, P/E, and other valuation ranges from market cap and revenue history.
 * Data is cached aggressively to avoid repeated API calls.
 */

import { getFMPHistoricalMarketCap, getFMPIncomeStatements } from './fmp.service';
import { DATA_NOT_AVAILABLE } from '../utils/normalize-percent';

const CACHE_TTL_MS = 86400_000; // 24 hours for historical valuation data

interface LocalCacheEntry { data: unknown; expiresAt: number }
const histValCache = new Map<string, LocalCacheEntry>();

function getCached<T>(key: string): T | null {
  const e = histValCache.get(key);
  if (e && Date.now() < e.expiresAt) return e.data as T;
  histValCache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  histValCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface HistoricalPSRange {
  symbol: string;
  currentPS: number | null;
  min3y: number | null;
  max3y: number | null;
  avg3y: number | null;
  percentile: number | null; // Current P/S percentile vs 3-year range (0-100)
  dataPoints: number; // Number of historical P/S points computed
  available: boolean;
}

interface HistoricalDataPoint {
  date: string;
  marketCap: number;
  revenue: number;
  ps: number;
}

// ─── Helper: Compute percentile ──────────────────────────────────────────────

function computePercentile(value: number, sortedValues: number[]): number {
  if (!sortedValues.length) return 50;
  const below = sortedValues.filter(v => v < value).length;
  return Math.round((below / sortedValues.length) * 100);
}

// ─── Historical P/S Range ─────────────────────────────────────────────────────

/**
 * Compute TTM (Trailing Twelve Months) revenue from quarterly income statements.
 * This is more accurate than using single quarterly revenue values.
 */
function computeTTMRevenue(
  statements: Array<{ date: string; revenue: number | null; fiscalQuarter: string | null }>,
  asOfDate: Date,
): number | null {
  // Get last 4 quarters up to the asOfDate
  const relevantStatements = statements
    .filter(s => s.revenue && s.revenue > 0 && new Date(s.date) <= asOfDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  if (relevantStatements.length < 4) return null;

  return relevantStatements.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
}

/**
 * Find closest market cap to a given date, with configurable tolerance.
 */
function findClosestMarketCap(
  marketCapHistory: Array<{ date: string; marketCap: number | null }>,
  targetDate: Date,
  maxDaysDiff = 45,
): { marketCap: number; date: string } | null {
  let closest: { marketCap: number; date: string; diff: number } | null = null;

  for (const mc of marketCapHistory) {
    if (!mc.marketCap || mc.marketCap <= 0) continue;
    
    const mcDate = new Date(mc.date);
    const daysDiff = Math.abs((mcDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= maxDaysDiff && (!closest || daysDiff < closest.diff)) {
      closest = { marketCap: mc.marketCap, date: mc.date, diff: daysDiff };
    }
  }

  return closest ? { marketCap: closest.marketCap, date: closest.date } : null;
}

export async function getHistoricalPSRange(
  symbol: string,
  currentPS: number | null,
  currentMarketCapB: number | null,
): Promise<HistoricalPSRange> {
  const key = `historical:ps_range:${symbol}`;
  const cached = getCached<HistoricalPSRange>(key);
  if (cached) return cached;

  const base: HistoricalPSRange = {
    symbol,
    currentPS,
    min3y: null,
    max3y: null,
    avg3y: null,
    percentile: null,
    dataPoints: 0,
    available: false,
  };

  if (!currentPS || !currentMarketCapB) {
    setCached(key, base);
    return base;
  }

  try {
    // Fetch 4 years of data to ensure 3 complete years of TTM computations
    const [marketCapHistory, incomeStatements] = await Promise.all([
      getFMPHistoricalMarketCap(symbol, 4),
      getFMPIncomeStatements(symbol, 4),
    ]);

    if (!marketCapHistory.length || incomeStatements.length < 4) {
      console.warn(`[historical-valuation:ps_range] ${symbol} — insufficient historical data (mcap=${marketCapHistory.length}, statements=${incomeStatements.length})`);
      setCached(key, base);
      return base;
    }

    // Compute historical P/S using TTM revenue at each quarter-end
    const dataPoints: HistoricalDataPoint[] = [];
    const processedDates = new Set<string>();

    // Sort statements by date descending for TTM computation
    const sortedStatements = [...incomeStatements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Process each quarterly statement as a potential P/S data point
    for (let i = 0; i < sortedStatements.length - 3; i++) {
      const statement = sortedStatements[i];
      const statementDate = new Date(statement.date);
      const dateKey = statement.date.substring(0, 7); // YYYY-MM for deduplication
      
      // Skip if already processed this month
      if (processedDates.has(dateKey)) continue;
      processedDates.add(dateKey);

      // Compute TTM revenue as of this statement date
      const ttmRevenue = computeTTMRevenue(sortedStatements, statementDate);
      if (!ttmRevenue || ttmRevenue <= 0) continue;

      // Find market cap closest to the statement date
      const mcapData = findClosestMarketCap(marketCapHistory, statementDate, 45);
      if (!mcapData) continue;

      // Compute P/S
      const ps = mcapData.marketCap / ttmRevenue;
      
      // Sanity check: P/S should be in reasonable range
      if (ps <= 0 || ps > 200) {
        console.warn(`[historical-valuation:ps_range] ${symbol} — skipping invalid P/S=${ps} for ${statement.date}`);
        continue;
      }

      dataPoints.push({
        date: statement.date,
        marketCap: mcapData.marketCap,
        revenue: ttmRevenue,
        ps: Math.round(ps * 100) / 100,
      });
    }

    if (dataPoints.length < 4) {
      console.warn(`[historical-valuation:ps_range] ${symbol} — insufficient matched data points (${dataPoints.length})`);
      setCached(key, base);
      return base;
    }

    // Sort by date and take most recent 12 quarters (3 years)
    dataPoints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentPoints = dataPoints.slice(0, 12);

    const psValues = recentPoints.map(d => d.ps).sort((a, b) => a - b);
    const min3y = Math.round(psValues[0] * 100) / 100;
    const max3y = Math.round(psValues[psValues.length - 1] * 100) / 100;
    const avg3y = Math.round((psValues.reduce((a, b) => a + b, 0) / psValues.length) * 100) / 100;
    const percentile = computePercentile(currentPS, psValues);

    console.log(`[historical-valuation:ps_range] ${symbol} — computed from ${recentPoints.length} data points: min=${min3y}, max=${max3y}, avg=${avg3y}, percentile=${percentile}`);

    const result: HistoricalPSRange = {
      symbol,
      currentPS,
      min3y,
      max3y,
      avg3y,
      percentile,
      dataPoints: recentPoints.length,
      available: true,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[historical-valuation:ps_range] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}

// ─── Valuation Bands (for asymmetry analysis) ─────────────────────────────────

export interface ValuationBands {
  symbol: string;
  metric: 'ps' | 'pe';
  currentPrice: number;
  currentMultiple: number | null;
  
  // Downside scenarios - DETERMINISTIC: based on historical data only
  bearCaseMultiple: number | null; // Historical min
  bearCasePrice: number | null;
  bearCaseDownside: number | null; // % from current (negative)
  
  // Upside scenarios - DETERMINISTIC: based on historical data only
  bullCaseMultiple: number | null; // Historical max
  bullCasePrice: number | null;
  bullCaseUpside: number | null; // % from current (positive)
  
  // Base case - DETERMINISTIC: historical average
  fairValueMultiple: number | null; // Historical avg
  fairValuePrice: number | null;
  fairValueDeviation: number | null; // % current price deviates from fair value
  
  // Risk/Reward metrics - DETERMINISTIC
  riskRewardRatio: number | null; // upside / abs(downside)
  
  available: boolean;
}

/**
 * Compute deterministic valuation bands based ONLY on historical data.
 * NO GPT inference allowed. All price targets derived from:
 * - Historical P/S minimum → Bear case floor
 * - Historical P/S average → Fair value
 * - Historical P/S maximum → Bull case ceiling
 */
export async function getValuationBands(
  symbol: string,
  currentPrice: number,
  currentPS: number | null,
  revenuePerShare: number | null,
): Promise<ValuationBands> {
  const key = `historical:valuation_bands:${symbol}`;
  const cached = getCached<ValuationBands>(key);
  if (cached) return cached;

  const base: ValuationBands = {
    symbol,
    metric: 'ps',
    currentPrice,
    currentMultiple: currentPS,
    bearCaseMultiple: null,
    bearCasePrice: null,
    bearCaseDownside: null,
    bullCaseMultiple: null,
    bullCasePrice: null,
    bullCaseUpside: null,
    fairValueMultiple: null,
    fairValuePrice: null,
    fairValueDeviation: null,
    riskRewardRatio: null,
    available: false,
  };

  if (!currentPS || !revenuePerShare || revenuePerShare <= 0) {
    console.warn(`[historical-valuation:valuation_bands] ${symbol} — missing currentPS or revenuePerShare`);
    setCached(key, base);
    return base;
  }

  try {
    // Get historical P/S range - this is our deterministic source of truth
    const histRange = await getHistoricalPSRange(symbol, currentPS, null);

    if (!histRange.available || !histRange.min3y || !histRange.max3y || !histRange.avg3y) {
      console.warn(`[historical-valuation:valuation_bands] ${symbol} — historical P/S range unavailable`);
      setCached(key, base);
      return base;
    }

    // DETERMINISTIC VALUATION BANDS
    // Bear case: Historical minimum P/S (no artificial discount - use actual trough)
    const bearMultiple = histRange.min3y;
    
    // Fair value: Historical average P/S
    const fairMultiple = histRange.avg3y;
    
    // Bull case: Historical maximum P/S (no artificial premium - use actual peak)
    const bullMultiple = histRange.max3y;

    // Compute price targets based on current revenue per share
    const bearPrice = Math.round(bearMultiple * revenuePerShare * 100) / 100;
    const fairPrice = Math.round(fairMultiple * revenuePerShare * 100) / 100;
    const bullPrice = Math.round(bullMultiple * revenuePerShare * 100) / 100;

    // Compute percentage changes from current price
    const bearDownside = Math.round(((bearPrice - currentPrice) / currentPrice) * 100 * 100) / 100;
    const bullUpside = Math.round(((bullPrice - currentPrice) / currentPrice) * 100 * 100) / 100;
    const fairDeviation = Math.round(((currentPrice - fairPrice) / fairPrice) * 100 * 100) / 100;

    // Compute risk/reward ratio (upside / abs(downside))
    // Only compute if both are meaningful
    const riskRewardRatio = bearDownside < 0 && bullUpside > 0
      ? Math.round((bullUpside / Math.abs(bearDownside)) * 100) / 100
      : null;

    console.log(`[historical-valuation:valuation_bands] ${symbol} — DETERMINISTIC bands: bear=$${bearPrice} (${bearDownside}%), fair=$${fairPrice}, bull=$${bullPrice} (+${bullUpside}%), R/R=${riskRewardRatio}`);

    const result: ValuationBands = {
      symbol,
      metric: 'ps',
      currentPrice,
      currentMultiple: currentPS,
      bearCaseMultiple: bearMultiple,
      bearCasePrice: bearPrice,
      bearCaseDownside: bearDownside,
      bullCaseMultiple: bullMultiple,
      bullCasePrice: bullPrice,
      bullCaseUpside: bullUpside,
      fairValueMultiple: fairMultiple,
      fairValuePrice: fairPrice,
      fairValueDeviation: fairDeviation,
      riskRewardRatio,
      available: true,
    };

    setCached(key, result);
    return result;
  } catch (err) {
    console.warn(`[historical-valuation:valuation_bands] ${symbol} — ${err instanceof Error ? err.message : err}`);
    setCached(key, base);
    return base;
  }
}
