import axios from 'axios';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? '';
const FMP_KEY = process.env.FMP_KEY ?? '';
const BENZINGA_KEY = process.env.BENZINGA_API ?? '';

const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewsProvider = 'benzinga' | 'fmp' | 'finnhub';

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  provider: NewsProvider;
  url: string;
  publishedAt: string;
  tickers: string[];
  summary?: string;
  importance: 0 | 1 | 2;
  score: number;
}

export interface NewsResponse {
  topStories: NewsArticle[];
  moreNews: NewsArticle[];
  fetchedAt: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: NewsResponse;
  expiresAt: number;
}

const newsCache = new Map<string, CacheEntry>();

function getCached(key: string): NewsResponse | null {
  const entry = newsCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  newsCache.delete(key);
  return null;
}

function setCached(key: string, data: NewsResponse): void {
  newsCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

const PROVIDER_PRIORITY: Record<NewsProvider, number> = {
  benzinga: 0,
  fmp: 1,
  finnhub: 2,
};

function sourceTierPoints(source: string): number {
  const s = source.toLowerCase();
  if (/reuters|bloomberg|wsj|wall street journal/.test(s)) return 10;
  if (/\bap\b|associated press|financial times|ft\.com/.test(s)) return 8;
  if (/cnbc|marketwatch/.test(s)) return 6;
  if (/benzinga/.test(s)) return 5;
  return 2;
}

function recencyPoints(publishedAt: string): number {
  const diffMin = (Date.now() - new Date(publishedAt).getTime()) / 60_000;
  if (diffMin < 30) return 40;
  if (diffMin < 60) return 35;
  if (diffMin < 120) return 25;
  if (diffMin < 360) return 15;
  if (diffMin < 1440) return 5;
  return 0;
}

function scoreArticle(a: Omit<NewsArticle, 'score'>): number {
  const impact = a.importance === 2 ? 20 : a.importance === 1 ? 10 : 0;
  return recencyPoints(a.publishedAt) + sourceTierPoints(a.source) + impact;
}

// ─── ID normalisation ─────────────────────────────────────────────────────────

function makeId(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

// ─── Fetch: Finnhub ───────────────────────────────────────────────────────────

async function fetchFinnhub(tickers?: string[]): Promise<NewsArticle[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any[];
    if (tickers && tickers.length > 0) {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const results = await Promise.allSettled(
        tickers.slice(0, 5).map((symbol) =>
          axios
            .get('https://finnhub.io/api/v1/company-news', {
              params: { symbol, from, to, token: FINNHUB_KEY },
              timeout: 8000,
            })
            .then((r) => r.data as unknown[])
        )
      );
      items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    } else {
      const res = await axios.get('https://finnhub.io/api/v1/news', {
        params: { category: 'general', token: FINNHUB_KEY },
        timeout: 8000,
      });
      items = res.data as unknown[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (items ?? []).filter(Boolean).map((item: any): NewsArticle => ({
      id: makeId(item.headline ?? ''),
      headline: String(item.headline ?? ''),
      source: String(item.source ?? 'Finnhub'),
      provider: 'finnhub',
      url: String(item.url ?? ''),
      publishedAt: new Date((Number(item.datetime) ?? 0) * 1000).toISOString(),
      tickers: item.related
        ? String(item.related)
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
      summary: item.summary ? String(item.summary) : undefined,
      importance: 0,
      score: 0,
    })).filter((a) => a.headline && a.url);
  } catch (err) {
    console.warn('[news:finnhub] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Fetch: FMP ───────────────────────────────────────────────────────────────

async function fetchFMP(tickers?: string[]): Promise<NewsArticle[]> {
  try {
    const params: Record<string, string | number> = { limit: 20, apikey: FMP_KEY };
    if (tickers && tickers.length > 0) params.tickers = tickers.join(',');

    const res = await axios.get('https://financialmodelingprep.com/api/v3/stock_news', {
      params,
      timeout: 8000,
    });
    const items: unknown[] = Array.isArray(res.data) ? res.data : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.filter(Boolean).map((item: any): NewsArticle => ({
      id: makeId(item.title ?? ''),
      headline: String(item.title ?? ''),
      source: String(item.site ?? 'FMP'),
      provider: 'fmp',
      url: String(item.url ?? ''),
      publishedAt: new Date(item.publishedDate).toISOString(),
      tickers: item.symbol ? [String(item.symbol)] : [],
      summary: item.text ? String(item.text) : undefined,
      importance: 0,
      score: 0,
    })).filter((a) => a.headline && a.url);
  } catch (err) {
    console.warn('[news:fmp] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Fetch: Benzinga ──────────────────────────────────────────────────────────

function mapBenzingaImportance(val: number): 0 | 1 | 2 {
  if (val >= 4) return 2;
  if (val === 3) return 1;
  return 0;
}

async function fetchBenzinga(tickers?: string[]): Promise<NewsArticle[]> {
  try {
    const params: Record<string, string | number> = {
      token: BENZINGA_KEY,
      pageSize: 20,
      displayOutput: 'full',
    };
    if (tickers && tickers.length > 0) params.tickers = tickers.join(',');

    const res = await axios.get('https://api.benzinga.com/api/v2/news', {
      params,
      timeout: 8000,
    });
    const items: unknown[] = Array.isArray(res.data)
      ? res.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (res.data as any)?.data ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.filter(Boolean).map((item: any): NewsArticle => {
      const stocks: string[] = Array.isArray(item.stocks)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? item.stocks.map((s: any) => String(s.name ?? s.ticker ?? s)).filter(Boolean)
        : [];

      return {
        id: makeId(item.title ?? ''),
        headline: String(item.title ?? ''),
        source: 'Benzinga',
        provider: 'benzinga',
        url: String(item.url ?? ''),
        publishedAt: new Date(item.created).toISOString(),
        tickers: stocks,
        summary: undefined,
        importance: mapBenzingaImportance(Number(item.importance ?? 0)),
        score: 0,
      };
    }).filter((a) => a.headline && a.url);
  } catch (err) {
    console.warn('[news:benzinga] fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function deduplicate(articles: NewsArticle[]): NewsArticle[] {
  // Pass 1 — exact match on normalised ID, keep higher-priority provider
  const byId = new Map<string, NewsArticle>();
  for (const article of articles) {
    if (!article.id) continue;
    const existing = byId.get(article.id);
    if (
      !existing ||
      PROVIDER_PRIORITY[article.provider] < PROVIDER_PRIORITY[existing.provider]
    ) {
      byId.set(article.id, article);
    }
  }

  // Pass 2 — fuzzy Jaccard similarity > 85%
  const unique: NewsArticle[] = [];
  for (const article of byId.values()) {
    let isDuplicate = false;
    for (let i = 0; i < unique.length; i++) {
      if (jaccardSimilarity(article.headline, unique[i].headline) > 0.85) {
        isDuplicate = true;
        if (PROVIDER_PRIORITY[article.provider] < PROVIDER_PRIORITY[unique[i].provider]) {
          unique[i] = article;
        }
        break;
      }
    }
    if (!isDuplicate) unique.push(article);
  }

  return unique;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function aggregateNews(
  tickers?: string[],
  _filter?: string
): Promise<NewsResponse> {
  const cacheKey = `${(tickers ?? []).sort().join(',')}|${_filter ?? ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [finnhubArticles, fmpArticles, benzingaArticles] = await Promise.allSettled([
    fetchFinnhub(tickers),
    fetchFMP(tickers),
    fetchBenzinga(tickers),
  ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : [])));

  // Merge in priority order so dedup favours higher-priority sources
  const all = [...benzingaArticles, ...fmpArticles, ...finnhubArticles];
  const deduped = deduplicate(all);

  const scored = deduped
    .map((a) => ({ ...a, score: scoreArticle(a) }))
    .sort((a, b) => b.score - a.score);

  const result: NewsResponse = {
    topStories: scored.slice(0, 5),
    moreNews: scored.slice(5, 15),
    fetchedAt: new Date().toISOString(),
  };

  setCached(cacheKey, result);
  return result;
}
