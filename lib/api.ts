/**
 * API client for the Stockvest backend.
 * Base URL is set via EXPO_PUBLIC_API_URL env variable.
 * Falls back to localhost:3000 for development.
 */

import { supabase } from './supabase';
import { Sentry } from './sentry';
import type {
  AIStockSummary,
  AIResearchFoundation,
  AIValuationFinancials,
  AIRiskRedTeaming,
  AITechnicals,
  AIVerdict,
} from './ai-types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15_000;

function classifyError(err: unknown, status?: number): Error {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new Error('Request timed out. Please check your connection and try again.');
    }
    if (err.message === 'Network request failed' || err.message.includes('fetch')) {
      return new Error('No internet connection. Please check your network and try again.');
    }
  }
  if (status === 401 || status === 403) {
    return new Error('Your session has expired. Please sign in again.');
  }
  if (status === 429) {
    return new Error('Too many requests. Please wait a moment and try again.');
  }
  if (status != null && status >= 500) {
    return new Error('Server error. Please try again in a moment.');
  }
  if (err instanceof Error) return err;
  return new Error('Something went wrong. Please try again.');
}

function logApiError(path: string, err: unknown): void {
  if (__DEV__) {
    console.warn(`[api] ${path}:`, err instanceof Error ? err.message : err);
  } else {
    try {
      Sentry.captureException(err, { extra: { path } });
    } catch {
      // Sentry not configured — ignore
    }
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      const message = body.error ?? `HTTP ${res.status}`;
      const classified = classifyError(new Error(message), res.status);
      logApiError(path, classified);
      throw classified;
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('timed out') || err.message.includes('internet') || err.message.includes('session') || err.message.includes('requests') || err.message.includes('Server error'))) {
      throw err;
    }
    const classified = classifyError(err);
    logApiError(path, classified);
    throw classified;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  profile?: {
    name: string;
    logo: string;
    exchange: string;
    industry: string;
    marketCap: number;
  } | null;
}

export interface StockDetail extends StockQuote {
  week52High: number | null;
  week52Low: number | null;
  rsi: number | null;
  isOverbought: boolean;
  isOversold: boolean;
  rsiTrend?: 'up' | 'down' | 'flat';
  previousRsi?: number | null;
  ma50?: number | null;
  ma200?: number | null;
  ma50Trend?: 'green' | 'red' | null;
  ma200Trend?: 'green' | 'red' | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  srSignal?: 'near_support' | 'near_resistance' | null;
  relativeVolume?: number | null;
  momentumScore?: number | null;
}

export interface WatchlistStock {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  added_at: string;
  quote: StockQuote | null;
  rsi: number | null;
  isOverbought: boolean;
  isOversold: boolean;
  week52High: number | null;
  week52Low: number | null;
  rsiTrend?: 'up' | 'down' | 'flat';
  previousRsi?: number | null;
  relativeVolume?: number | null;
  ma50?: number | null;
  ma200?: number | null;
  ma50Trend?: 'green' | 'red' | null;
  ma200Trend?: 'green' | 'red' | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  srSignal?: 'near_support' | 'near_resistance' | null;
  momentumScore?: number | null;
  sparkline?: number[];
}

export interface AlertLog {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: '52w_high' | '52w_low' | 'rsi_overbought' | 'rsi_oversold';
  message: string;
  price: number | null;
  rsi: number | null;
  week52_high: number | null;
  week52_low: number | null;
  is_read: boolean;
  triggered_at: string;
}

export interface CandleData {
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

export interface HomeData {
  trending: StockQuote[];
  topGainers: StockQuote[];
  topLosers: StockQuote[];
  mostActive: StockQuote[];
}

export interface StockSearchResult {
  symbol: string;
  description: string;
  type: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface IndexCardData {
  symbol: string;
  label: string;
  currentPrice: number | null;
  changePercent: number | null;
  sparkline: number[];
}

export interface SectorData {
  sector: string;
  etf: string;
  changePercent: number | null;
  currentPrice: number | null;
}

export interface UnusualVolumeStock {
  ticker: string;
  name?: string;
  logo?: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
}

// ─── Market ──────────────────────────────────────────────────────────────────

function marketSymbolPath(symbol: string): string {
  return encodeURIComponent(symbol.trim().toUpperCase());
}

export const marketApi = {
  getHome: () => request<HomeData>('/api/market/home'),
  getQuote: (symbol: string) =>
    request<StockQuote>(`/api/market/quote/${marketSymbolPath(symbol)}`),
  getDetail: (symbol: string) =>
    request<StockDetail>(`/api/market/detail/${marketSymbolPath(symbol)}`),
  getCandles: (symbol: string, range: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y') =>
    request<CandleData>(`/api/market/candles/${marketSymbolPath(symbol)}?range=${range}`),
  getIndexes: () => request<IndexCardData[]>('/api/market/indexes'),
  getSectors: () => request<SectorData[]>('/api/market/sectors'),
  getUnusualVolume: () => request<UnusualVolumeStock[]>('/api/market/unusual-volume'),
};

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const watchlistApi = {
  getAll: () => request<WatchlistStock[]>('/api/stocks'),
  search: (query: string) =>
    request<StockSearchResult[]>(`/api/stocks/search?q=${encodeURIComponent(query)}`),
  add: (symbol: string, company_name?: string) =>
    request<WatchlistStock>('/api/stocks', {
      method: 'POST',
      body: JSON.stringify({ symbol, company_name }),
    }),
  remove: (symbol: string) =>
    request<{ message: string }>(`/api/stocks/${symbol}`, { method: 'DELETE' }),
};

// ─── Multi-Watchlists ─────────────────────────────────────────────────────────

export const watchlistsApi = {
  getAll: () => request<Watchlist[]>('/api/watchlists'),
  create: (name: string) =>
    request<Watchlist>('/api/watchlists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  rename: (id: string, name: string) =>
    request<Watchlist>(`/api/watchlists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/api/watchlists/${id}`, { method: 'DELETE' }),
  getStocks: (id: string) =>
    request<WatchlistStock[]>(`/api/watchlists/${id}/stocks`),
  addStock: (watchlistId: string, symbol: string, company_name?: string) =>
    request<WatchlistStock>(`/api/watchlists/${watchlistId}/stocks`, {
      method: 'POST',
      body: JSON.stringify({ symbol, company_name }),
    }),
  removeStock: (watchlistId: string, symbol: string) =>
    request<{ message: string }>(`/api/watchlists/${watchlistId}/stocks/${symbol}`, {
      method: 'DELETE',
    }),
  search: (query: string) =>
    request<StockSearchResult[]>(`/api/stocks/search?q=${encodeURIComponent(query)}`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsApi = {
  getAll: (unreadOnly = false) =>
    request<AlertLog[]>(`/api/alerts${unreadOnly ? '?unread=true' : ''}`),
  markRead: (id: string) =>
    request<{ message: string }>(`/api/alerts/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ message: string }>('/api/alerts/read-all', { method: 'PATCH' }),
};

// ─── AI Research ─────────────────────────────────────────────────────────────

const AI_SECTION_TIMEOUT_MS = 45_000;

export const aiApi = {
  getSummary: (symbol: string) =>
    request<AIStockSummary & { industry: string; marketCap: number | null }>(
      `/api/ai/research/summary?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  getFoundation: (symbol: string) =>
    request<AIResearchFoundation>(
      `/api/ai/research/foundation?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  getValuation: (symbol: string) =>
    request<AIValuationFinancials>(
      `/api/ai/research/valuation?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  getRisks: (symbol: string) =>
    request<AIRiskRedTeaming>(
      `/api/ai/research/risks?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  getTechnicals: (symbol: string) =>
    request<AITechnicals>(
      `/api/ai/research/technicals?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  getVerdict: (symbol: string) =>
    request<AIVerdict>(
      `/api/ai/research/verdict?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
  // Generic section fetcher for tier-based sections
  getSection: (symbol: string, sectionKey: string) =>
    request<unknown>(
      `/api/ai/research/section/${sectionKey}?symbol=${encodeURIComponent(symbol)}`,
      {},
      AI_SECTION_TIMEOUT_MS
    ),
};

// ─── News ─────────────────────────────────────────────────────────────────────

export type NewsImportance = 0 | 1 | 2;
export type NewsProvider = 'benzinga' | 'fmp' | 'finnhub';
export type NewsFilter = 'my_stocks' | 'markets' | 'earnings' | 'economy';

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  provider: NewsProvider;
  url: string;
  publishedAt: string;
  tickers: string[];
  summary?: string;
  importance: NewsImportance;
  score: number;
  tickerChanges: Record<string, number>;
}

export interface NewsResponse {
  topStories: NewsArticle[];
  moreNews: NewsArticle[];
  fetchedAt: string;
}

export const newsApi = {
  getFeed: (params?: { tickers?: string; filter?: NewsFilter }) => {
    const qs = new URLSearchParams();
    if (params?.tickers) qs.set('tickers', params.tickers);
    if (params?.filter) qs.set('filter', params.filter);
    const query = qs.toString();
    return request<NewsResponse>(`/api/news${query ? `?${query}` : ''}`);
  },
};

// ─── Push token ───────────────────────────────────────────────────────────────

export const pushApi = {
  register: (token: string) =>
    request('/api/push-token', { method: 'POST', body: JSON.stringify({ token }) }),
  unregister: (token: string) =>
    request('/api/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
};
