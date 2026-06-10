/**
 * Direct-from-app calls to public Finnhub endpoints used on the Home screen.
 * Used for /news and /calendar/* which don't require server-side caching
 * or hidden keys (the Finnhub free key is intended to be embeddable).
 *
 * Secret-key APIs (Yahoo RapidAPI, Polygon) stay on the backend.
 */

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.EXPO_PUBLIC_FINNHUB_API_KEY ?? '';
const REQUEST_TIMEOUT_MS = 15_000;

async function finnhub<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error(
      'EXPO_PUBLIC_FINNHUB_API_KEY is not set — add it to your .env file'
    );
  }

  const allParams = { ...params, token: API_KEY };
  const queryString = Object.entries(allParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${BASE_URL}${path}?${queryString}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Finnhub ${path} failed: HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Finnhub request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketNewsItem {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/** Earnings calendar entry returned by Finnhub */
export interface EarningsCalendarItem {
  symbol: string;
  date: string;
  hour: 'bmo' | 'amc' | 'dmh' | '';
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  year: number;
  quarter: number;
}

/** Company profile returned by Finnhub /stock/profile2 */
export interface CompanyProfile {
  ticker: string;
  name: string;
  exchange: string;
  marketCapitalization: number; // in $M
  logo: string;
  finnhubIndustry: string;
  weburl: string;
  country: string;
}

export interface EconomicCalendarItem {
  country: string;
  event: string;
  impact: 'low' | 'medium' | 'high' | '';
  time: string;
  unit: string;
  prev: number | null;
  estimate: number | null;
  actual: number | null;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export async function fetchMarketNews(category = 'general'): Promise<MarketNewsItem[]> {
  try {
    return await finnhub<MarketNewsItem[]>('/news', { category });
  } catch (err) {
    console.warn('[finnhub-direct] fetchMarketNews failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** YYYY-MM-DD strings, inclusive */
export async function fetchEarningsCalendar(
  from: string,
  to: string
): Promise<EarningsCalendarItem[]> {
  try {
    const data = await finnhub<{ earningsCalendar: EarningsCalendarItem[] }>(
      '/calendar/earnings',
      { from, to }
    );
    return data?.earningsCalendar ?? [];
  } catch (err) {
    console.warn('[finnhub-direct] fetchEarningsCalendar failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// Module-level profile cache with 1-hour TTL to minimise API calls
const _profileCache = new Map<string, { data: CompanyProfile; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 60 * 60_000;

/** Returns null if the symbol is not found or the request fails silently. */
export async function fetchCompanyProfile(
  symbol: string
): Promise<CompanyProfile | null> {
  const cached = _profileCache.get(symbol);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const data = await finnhub<Partial<CompanyProfile>>('/stock/profile2', { symbol });
    if (!data?.ticker) return null;
    const profile = data as CompanyProfile;
    _profileCache.set(symbol, { data: profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    return profile;
  } catch {
    return null;
  }
}

export async function fetchEconomicCalendar(): Promise<EconomicCalendarItem[]> {
  try {
    const data = await finnhub<{ economicCalendar: EconomicCalendarItem[] }>(
      '/calendar/economic'
    );
    return data?.economicCalendar ?? [];
  } catch (err) {
    console.warn('[finnhub-direct] fetchEconomicCalendar failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
