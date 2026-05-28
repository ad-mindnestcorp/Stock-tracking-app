import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinanceClass = require('yahoo-finance2').default as new (opts?: Record<string, unknown>) => {
  historical: (
    symbol: string,
    opts: { period1: Date; period2: Date; interval: string }
  ) => Promise<Array<{ close: number; high: number; low: number; volume?: number }>>;
  quote: (symbol: string) => Promise<{
    regularMarketVolume?: number;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    regularMarketPreviousClose?: number;
    regularMarketOpen?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
  }>;
};

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY ?? '';

/** Lazy singleton — created once to suppress the deprecation notice every call */
let _yf: InstanceType<typeof YahooFinanceClass> | null = null;
function getYF(): InstanceType<typeof YahooFinanceClass> {
  if (!_yf) _yf = new YahooFinanceClass({ suppressNotices: ['ripHistorical'], validation: { logErrors: false } });
  return _yf;
}

// ─── In-memory TTL cache ──────────────────────────────────────────────────────
// Avoids hammering Finnhub on every page load; quotes refresh every 60s,
// profiles every 24h (they almost never change), candles every 5 min.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const TTL = {
  QUOTE: 60_000,              // 60 s  — live price data
  VOLUME: 60_000,             // 60 s  — intraday volume
  PROFILE: 86_400_000,        // 24 h  — company info
  CANDLES_INTRADAY: 300_000,  // 5 min
  CANDLES_DAILY: 600_000,     // 10 min
  WEEK52: 600_000,            // 10 min
};

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume?: number;
}

export interface CandleData {
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  logo: string;
  exchange: string;
  industry: string;
  marketCap: number;
  shareOutstanding: number;
}

export interface Week52Data {
  high52w: number;
  low52w: number;
  closes: number[]; // last 14+ close prices for RSI
  avgVolume?: number; // 30-day average daily volume
  recentHighs?: number[]; // last 30 candle highs for support/resistance
  recentLows?: number[];  // last 30 candle lows for support/resistance
}

/** Fetch current trading volume from Yahoo Finance (cached 60 s) */
async function getVolumeFromYahoo(symbol: string): Promise<number | undefined> {
  const key = `volume:yahoo:${symbol}`;
  const cached = getCached<number>(key);
  if (cached !== null) return cached;

  try {
    const result = await getYF().quote(symbol);
    const volume = result?.regularMarketVolume;
    if (volume != null) setCached(key, volume, TTL.VOLUME);
    return volume;
  } catch (err) {
    console.warn(`[yahoo:volume] ${symbol} — failed to fetch:`, err);
    return undefined;
  }
}

/** Fetch real-time quote for a symbol (cached 60 s) */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const key = `quote:${symbol}`;
  const cached = getCached<StockQuote>(key);
  if (cached) return cached;

  const res = await axios.get(`${BASE_URL}/quote`, {
    params: { symbol, token: API_KEY },
    timeout: 8000,
  });
  const d = res.data;
  let volume: number | undefined = d.v != null && d.v > 0 ? d.v : undefined;
  if (volume == null) {
    volume = await getVolumeFromYahoo(symbol);
  }

  const quote: StockQuote = {
    symbol,
    currentPrice: d.c,
    change: d.d,
    changePercent: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    previousClose: d.pc,
    volume,
  };
  setCached(key, quote, TTL.QUOTE);
  return quote;
}

/**
 * Fetch a real-time quote from Yahoo Finance.
 * Used as a fallback for symbols Finnhub free tier can't price (e.g. ^VIX).
 * yahoo-finance2 returns regularMarketChangePercent as a plain percentage (e.g. 0.83 for +0.83%).
 */
export async function getYahooQuote(
  yahooSymbol: string,
  displaySymbol: string
): Promise<StockQuote | null> {
  const key = `quote:yahoo:${yahooSymbol}`;
  const cached = getCached<StockQuote>(key);
  if (cached) return cached;

  try {
    const r = await getYF().quote(yahooSymbol);
    const price = r?.regularMarketPrice;
    if (price == null || price === 0) return null;

    const quote: StockQuote = {
      symbol: displaySymbol,
      currentPrice: price,
      change: r.regularMarketChange ?? 0,
      changePercent: r.regularMarketChangePercent ?? 0,
      high: r.regularMarketDayHigh ?? 0,
      low: r.regularMarketDayLow ?? 0,
      open: r.regularMarketOpen ?? 0,
      previousClose: r.regularMarketPreviousClose ?? 0,
      volume: r.regularMarketVolume,
    };
    setCached(key, quote, TTL.QUOTE);
    return quote;
  } catch (err) {
    console.warn(`[yahoo:quote] ${yahooSymbol} — failed:`, err);
    return null;
  }
}

/** Fetch daily candles for the past N days (cached 10 min) */
export async function getDailyCandles(symbol: string, days = 365): Promise<CandleData | null> {
  const key = `candles:daily:${symbol}:${days}`;
  const cached = getCached<CandleData>(key);
  if (cached) return cached;

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 24 * 60 * 60;

    const res = await axios.get(`${BASE_URL}/stock/candle`, {
      params: { symbol, resolution: 'D', from, to, token: API_KEY },
      timeout: 10000,
    });

    if (res.data?.s !== 'ok') return null;

    const candles: CandleData = {
      timestamps: res.data.t,
      open: res.data.o,
      high: res.data.h,
      low: res.data.l,
      close: res.data.c,
      volume: res.data.v,
    };
    setCached(key, candles, TTL.CANDLES_DAILY);
    return candles;
  } catch {
    return null;
  }
}

/** Fetch intraday candles for 1D chart (5-min resolution, cached 5 min) */
export async function getIntradayCandles(symbol: string): Promise<CandleData | null> {
  const key = `candles:intraday:${symbol}`;
  const cached = getCached<CandleData>(key);
  if (cached) return cached;

  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 24 * 60 * 60;

    const res = await axios.get(`${BASE_URL}/stock/candle`, {
      params: { symbol, resolution: '5', from, to, token: API_KEY },
      timeout: 10000,
    });

    if (res.data?.s !== 'ok') return null;

    const candles: CandleData = {
      timestamps: res.data.t,
      open: res.data.o,
      high: res.data.h,
      low: res.data.l,
      close: res.data.c,
      volume: res.data.v,
    };
    setCached(key, candles, TTL.CANDLES_INTRADAY);
    return candles;
  } catch {
    return null;
  }
}

/** Fetch company profile (cached 24 h) */
export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const key = `profile:${symbol}`;
  const cached = getCached<CompanyProfile>(key);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/stock/profile2`, {
      params: { symbol, token: API_KEY },
      timeout: 8000,
    });
    const d = res.data;
    if (!d.name) return null;
    const profile: CompanyProfile = {
      symbol,
      name: d.name,
      logo: d.logo,
      exchange: d.exchange,
      industry: d.finnhubIndustry,
      marketCap: d.marketCapitalization,
      shareOutstanding: d.shareOutstanding,
    };
    setCached(key, profile, TTL.PROFILE);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Fetch the last N daily close prices from Yahoo Finance.
 * Used for sparklines on symbols where Finnhub free tier blocks /stock/candle
 * (e.g. ETFs and BTC-USD). Cached 10 min.
 */
export async function getYahooDailyCloses(
  yahooSymbol: string,
  days = 30
): Promise<number[] | null> {
  const key = `yahoo:closes:${yahooSymbol}:${days}`;
  const cached = getCached<number[]>(key);
  if (cached) return cached;

  try {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const rows = await getYF().historical(yahooSymbol, {
      period1,
      period2,
      interval: '1d',
    });
    if (!rows || rows.length === 0) return null;
    const closes = rows.map((r) => r.close).filter((c) => c != null);
    if (closes.length === 0) return null;
    setCached(key, closes, TTL.CANDLES_DAILY);
    return closes;
  } catch {
    return null;
  }
}

/** Fetch daily OHLC from Yahoo Finance as a fallback (no API key needed) */
async function getDailyDataFromYahoo(symbol: string, days = 365): Promise<Week52Data | null> {
  try {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const period2 = new Date();
    const rows = await getYF().historical(symbol, { period1, period2, interval: '1d' });
    if (!rows || rows.length < 15) return null;

    const closes  = rows.map((r) => r.close).filter((c) => c != null);
    const highs   = rows.map((r) => r.high).filter((h) => h != null);
    const lows    = rows.map((r) => r.low).filter((l) => l != null);
    const volumes = rows.map((r) => r.volume).filter((v): v is number => v != null);
    if (closes.length < 15) return null;

    const last30Volumes = volumes.slice(-30);
    const avgVolume = last30Volumes.length > 0
      ? last30Volumes.reduce((sum, v) => sum + v, 0) / last30Volumes.length
      : undefined;

    return {
      high52w: Math.max(...highs),
      low52w:  Math.min(...lows),
      closes,
      avgVolume,
      recentHighs: highs.slice(-30),
      recentLows:  lows.slice(-30),
    };
  } catch {
    return null;
  }
}

/** Derive 52-week high/low and close prices from daily candle data (cached 10 min).
 *  Tries Finnhub first; falls back to Yahoo Finance if candles are unavailable. */
export async function getWeek52Data(symbol: string): Promise<Week52Data | null> {
  const key = `week52:${symbol}`;
  const cached = getCached<Week52Data>(key);
  if (cached) return cached;

  // Try Finnhub candles first; on failure (free-tier 403) fall back to Yahoo Finance
  const candles = await getDailyCandles(symbol, 365);
  let result: Week52Data | null = null;

  if (candles && candles.close.length >= 15) {
    const last30Vols = candles.volume.slice(-30).filter((v) => v != null && v > 0);
    const avgVolume = last30Vols.length > 0
      ? last30Vols.reduce((sum, v) => sum + v, 0) / last30Vols.length
      : undefined;
    result = {
      high52w: Math.max(...candles.high),
      low52w:  Math.min(...candles.low),
      closes:  candles.close,
      avgVolume,
      recentHighs: candles.high.slice(-30),
      recentLows:  candles.low.slice(-30),
    };
  } else {
    result = await getDailyDataFromYahoo(symbol);
  }

  if (!result) return null;

  setCached(key, result, TTL.WEEK52);
  return result;
}

/**
 * Fetch quotes for multiple symbols concurrently in batches of 10.
 * Cache hits are free; only uncached symbols count against the rate limit.
 * Returns a map of symbol → StockQuote.
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((symbol) => getQuote(symbol))
    );
    settled.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        result.set(batch[idx], outcome.value);
      } else {
        console.error(`Failed to fetch quote for ${batch[idx]}:`, outcome.reason);
      }
    });
    // Small pause between batches to stay within 60 req/min on Finnhub free tier.
    // 10 concurrent requests per batch → ~6 batches for 30 symbols → 6 × 150 ms = ~1 s pause total.
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return result;
}

export interface SymbolSearchResult {
  symbol: string;
  description: string;
  type: string;
}

/** Search for stock symbols matching a query (cached 30 s) */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const key = `search:${query.toLowerCase()}`;
  const cached = getCached<SymbolSearchResult[]>(key);
  if (cached) return cached;

  const res = await axios.get(`${BASE_URL}/search`, {
    params: { q: query, token: API_KEY },
    timeout: 8000,
  });

  const results: SymbolSearchResult[] = (res.data.result ?? [])
    .filter((r: { type: string }) => r.type === 'Common Stock' || r.type === 'EQS')
    .slice(0, 10)
    .map((r: { symbol: string; description: string; type: string }) => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
    }));

  setCached(key, results, 30_000);
  return results;
}

export interface BasicFinancials {
  peRatioTTM: number | null;
  pbRatioTTM: number | null;
  psTTM: number | null;
  evEbitdaTTM: number | null;
  evFcfTTM: number | null;
  roeTTM: number | null;
  revenueGrowthTTMYoy: number | null;
  grossMarginTTM: number | null;
  netProfitMarginTTM: number | null;
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  freeCashFlowTTM: number | null;
  freeCashFlowAnnual: number | null;
  _rawMetricKeys?: string[];
}

/**
 * Fetch basic financial metrics from Finnhub (cached 10 min)
 * 
 * Finnhub API field names (verified from docs):
 * - peTTM: P/E ratio
 * - roeTTM: Return on Equity (as decimal or percent — normalize via safePercent)
 * - currentRatioAnnual: Current ratio
 * - grossMarginTTM: Gross margin (as decimal)
 * - revenueGrowthTTMYoy: Revenue growth YoY (as decimal)
 * - freeCashFlowAnnual: Free cash flow (absolute value) — preferred over freeCashFlowTTM
 * - totalDebtToEquityAnnual: Debt/Equity ratio
 * - evToEbitdaTTM: EV/EBITDA (available on some plans)
 * - currentEv_freeCashFlowTTM: EV/FCF
 */
export async function getBasicFinancials(symbol: string): Promise<BasicFinancials | null> {
  const key = `metrics:${symbol}`;
  const cached = getCached<BasicFinancials>(key);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/stock/metric`, {
      params: { symbol, metric: 'all', token: API_KEY },
      timeout: 8000,
    });
    const m = res.data?.metric;
    if (!m) return null;

    // Log raw metric keys for debugging
    const rawKeys = Object.keys(m).filter(k => m[k] !== null && m[k] !== undefined);
    console.debug(`[finnhub:metrics] ${symbol} — available fields: ${rawKeys.slice(0, 15).join(', ')}${rawKeys.length > 15 ? '...' : ''}`);

    // Safe extraction with validation
    const safeNum = (val: unknown, field: string): number | null => {
      if (val === null || val === undefined) return null;
      if (typeof val !== 'number' || !isFinite(val) || isNaN(val)) {
        console.debug(`[finnhub:metrics] ${symbol}.${field}: invalid value ${val}`);
        return null;
      }
      return val;
    };

    // For percentage fields stored as decimals (e.g., 0.15 = 15%)
    const safePercent = (val: unknown, field: string): number | null => {
      const num = safeNum(val, field);
      if (num === null) return null;
      // Finnhub stores margins/returns as decimals, normalize to percent display value
      // but keep as decimal internally for consistency
      return num;
    };

    // EV/EBITDA is in the quarterly series, not the flat metric object
    const evEbitdaSeries = res.data?.series?.quarterly?.evEbitdaTTM;
    const evEbitdaFromSeries = Array.isArray(evEbitdaSeries) && evEbitdaSeries.length > 0
      ? safeNum(evEbitdaSeries[0].v, 'series.evEbitdaTTM')
      : null;

    // FCF per share TTM is in the quarterly series; multiply by shareOutstanding (in millions)
    const fcfPerShareSeries = res.data?.series?.quarterly?.fcfPerShareTTM;
    const fcfPerShareTTM = Array.isArray(fcfPerShareSeries) && fcfPerShareSeries.length > 0
      ? safeNum(fcfPerShareSeries[0].v, 'series.fcfPerShareTTM')
      : null;
    const profile = await getCompanyProfile(symbol);
    const shareOutstanding = profile?.shareOutstanding ?? null;
    const freeCashFlowFromSeries = fcfPerShareTTM !== null && shareOutstanding !== null
      ? fcfPerShareTTM * shareOutstanding * 1_000_000
      : null;

    const result: BasicFinancials = {
      peRatioTTM: safeNum(m.peTTM ?? m.peExclExtraTTM, 'peTTM'),
      pbRatioTTM: safeNum(m.pbAnnual ?? m.pbQuarterly, 'pbAnnual'),
      psTTM: safeNum(m.psTTM ?? m.psAnnual, 'psTTM'),
      evEbitdaTTM: evEbitdaFromSeries,
      evFcfTTM: safeNum(m.currentEv_freeCashFlowTTM, 'evFcfTTM'),
      roeTTM: safePercent(m.roeTTM, 'roeTTM'),
      revenueGrowthTTMYoy: safePercent(m.revenueGrowthTTMYoy, 'revenueGrowthTTMYoy'),
      grossMarginTTM: safePercent(m.grossMarginTTM, 'grossMarginTTM'),
      netProfitMarginTTM: safePercent(m.netProfitMarginTTM, 'netProfitMarginTTM'),
      // Field name contains a literal slash — must use bracket notation
      debtEquityTTM: safeNum(
        m['totalDebt/totalEquityAnnual'] ?? m['totalDebt/totalEquityQuarterly'] ?? m['longTermDebt/equityAnnual'],
        'debtEquityTTM'
      ),
      currentRatioTTM: safeNum(m.currentRatioAnnual ?? m.currentRatioQuarterly, 'currentRatioTTM'),
      freeCashFlowTTM: freeCashFlowFromSeries,
      freeCashFlowAnnual: safeNum(m.freeCashFlowAnnual, 'freeCashFlowAnnual'),
      _rawMetricKeys: rawKeys,
    };

    // Log what we extracted
    const extractedCount = Object.entries(result)
      .filter(([k, v]) => !k.startsWith('_') && v !== null)
      .length;
    console.log(`[finnhub:metrics] ${symbol} — extracted ${extractedCount} metrics`);
    
    setCached(key, result, TTL.CANDLES_DAILY);
    return result;
  } catch (err) {
    console.warn(`[finnhub:metrics] ${symbol} — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Popular US stocks used for the Home screen trending/gainers/losers list */
export const POPULAR_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'JPM', 'V', 'UNH', 'XOM', 'JNJ', 'WMT', 'MA', 'PG', 'HD',
  'CVX', 'MRK', 'ABBV', 'LLY', 'PFE', 'BAC', 'KO', 'PEP',
  'AVGO', 'COST', 'MCD', 'TMO', 'CSCO',
];
