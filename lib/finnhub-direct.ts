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

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('token', API_KEY);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
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
  return finnhub<MarketNewsItem[]>('/news', { category });
}

/** YYYY-MM-DD strings, inclusive */
export async function fetchEarningsCalendar(
  from: string,
  to: string
): Promise<EarningsCalendarItem[]> {
  const data = await finnhub<{ earningsCalendar: EarningsCalendarItem[] }>(
    '/calendar/earnings',
    { from, to }
  );
  return data?.earningsCalendar ?? [];
}

export async function fetchEconomicCalendar(): Promise<EconomicCalendarItem[]> {
  const data = await finnhub<{ economicCalendar: EconomicCalendarItem[] }>(
    '/calendar/economic'
  );
  return data?.economicCalendar ?? [];
}
