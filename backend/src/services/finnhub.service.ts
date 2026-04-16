import axios from 'axios';

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY ?? '';

// Rate limiting: Finnhub free tier = 60 req/min
// We add a small delay helper to be safe
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

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

/** Fetch real-time quote for a symbol */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const res = await axios.get(`${BASE_URL}/quote`, {
    params: { symbol, token: API_KEY },
  });
  const d = res.data;
  return {
    symbol,
    currentPrice: d.c,
    change: d.d,
    changePercent: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    previousClose: d.pc,
  };
}

/** Fetch daily candles for the past N days */
export async function getDailyCandles(symbol: string, days = 365): Promise<CandleData | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;

  const res = await axios.get(`${BASE_URL}/stock/candle`, {
    params: { symbol, resolution: 'D', from, to, token: API_KEY },
  });

  if (res.data.s !== 'ok') return null;

  return {
    timestamps: res.data.t,
    open: res.data.o,
    high: res.data.h,
    low: res.data.l,
    close: res.data.c,
    volume: res.data.v,
  };
}

/** Fetch intraday candles for 1D chart (5-min resolution) */
export async function getIntradayCandles(symbol: string): Promise<CandleData | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 24 * 60 * 60;

  const res = await axios.get(`${BASE_URL}/stock/candle`, {
    params: { symbol, resolution: '5', from, to, token: API_KEY },
  });

  if (res.data.s !== 'ok') return null;

  return {
    timestamps: res.data.t,
    open: res.data.o,
    high: res.data.h,
    low: res.data.l,
    close: res.data.c,
    volume: res.data.v,
  };
}

/** Fetch company profile */
export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  try {
    const res = await axios.get(`${BASE_URL}/stock/profile2`, {
      params: { symbol, token: API_KEY },
    });
    const d = res.data;
    if (!d.name) return null;
    return {
      symbol,
      name: d.name,
      logo: d.logo,
      exchange: d.exchange,
      industry: d.finnhubIndustry,
      marketCap: d.marketCapitalization,
      shareOutstanding: d.shareOutstanding,
    };
  } catch {
    return null;
  }
}

/** Derive 52-week high/low and last 30 close prices from daily candle data */
export async function getWeek52Data(symbol: string): Promise<Week52Data | null> {
  const candles = await getDailyCandles(symbol, 365);
  if (!candles || candles.close.length < 15) return null;

  const high52w = Math.max(...candles.high);
  const low52w = Math.min(...candles.low);
  const closes = candles.close; // full year of closes (RSI will use last 15)

  return { high52w, low52w, closes };
}

/**
 * Fetch quotes for multiple symbols with rate-limit-safe batching.
 * Returns a map of symbol → StockQuote.
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  for (const symbol of symbols) {
    try {
      const quote = await getQuote(symbol);
      result.set(symbol, quote);
      await delay(100); // ~10 req/sec to stay well under 60/min limit
    } catch (err) {
      console.error(`Failed to fetch quote for ${symbol}:`, err);
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
