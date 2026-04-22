/**
 * API client for the Stockvest backend.
 * Base URL is set via EXPO_PUBLIC_API_URL env variable.
 * Falls back to localhost:3000 for development.
 */

import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
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
}

export interface WatchlistStock {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  added_at: string;
  quote: StockQuote | null;
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

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsApi = {
  getAll: (unreadOnly = false) =>
    request<AlertLog[]>(`/api/alerts${unreadOnly ? '?unread=true' : ''}`),
  markRead: (id: string) =>
    request<{ message: string }>(`/api/alerts/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    request<{ message: string }>('/api/alerts/read-all', { method: 'PATCH' }),
};

// ─── Push token ───────────────────────────────────────────────────────────────

export const pushApi = {
  register: (token: string) =>
    request('/api/push-token', { method: 'POST', body: JSON.stringify({ token }) }),
  unregister: (token: string) =>
    request('/api/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
};
