import axios from 'axios';

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY ?? '';

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
  QUOTE: 60_000,         // 60 s  — live price data
  PROFILE: 86_400_000,   // 24 h  — company info
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
  const quote: StockQuote = {
    symbol,
    currentPrice: d.c,
    change: d.d,
    changePercent: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    previousClose: d.pc,
  };
  setCached(key, quote, TTL.QUOTE);
  return quote;
}

/** Fetch daily candles for the past N days (cached 10 min) */
export async function getDailyCandles(symbol: string, days = 365): Promise<CandleData | null> {
  const key = `candles:daily:${symbol}:${days}`;
  const cached = getCached<CandleData>(key);
  if (cached) return cached;

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;

  const res = await axios.get(`${BASE_URL}/stock/candle`, {
    params: { symbol, resolution: 'D', from, to, token: API_KEY },
    timeout: 10000,
  });

  if (res.data.s !== 'ok') return null;

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
}

/** Fetch intraday candles for 1D chart (5-min resolution, cached 5 min) */
export async function getIntradayCandles(symbol: string): Promise<CandleData | null> {
  const key = `candles:intraday:${symbol}`;
  const cached = getCached<CandleData>(key);
  if (cached) return cached;

  const to = Math.floor(Date.now() / 1000);
  const from = to - 24 * 60 * 60;

  const res = await axios.get(`${BASE_URL}/stock/candle`, {
    params: { symbol, resolution: '5', from, to, token: API_KEY },
    timeout: 10000,
  });

  if (res.data.s !== 'ok') return null;

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

/** Derive 52-week high/low and close prices from daily candle data (cached 10 min) */
export async function getWeek52Data(symbol: string): Promise<Week52Data | null> {
  const key = `week52:${symbol}`;
  const cached = getCached<Week52Data>(key);
  if (cached) return cached;

  const candles = await getDailyCandles(symbol, 365);
  if (!candles || candles.close.length < 15) return null;

  const high52w = Math.max(...candles.high);
  const low52w = Math.min(...candles.low);
  const closes = candles.close;

  const result: Week52Data = { high52w, low52w, closes };
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

/** Popular US stocks used for the Home screen trending/gainers/losers list */
export const POPULAR_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK.B',
  'JPM', 'V', 'UNH', 'XOM', 'JNJ', 'WMT', 'MA', 'PG', 'HD',
  'CVX', 'MRK', 'ABBV', 'LLY', 'PFE', 'BAC', 'KO', 'PEP',
  'AVGO', 'COST', 'MCD', 'TMO', 'CSCO',
];
