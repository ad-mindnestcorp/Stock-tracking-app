import {
  getBatchQuotes,
  getQuote,
  getYahooQuote,
  getDailyCandles,
  getYahooDailyCloses,
  POPULAR_SYMBOLS,
  getCompanyProfile,
  type StockQuote,
  type CompanyProfile,
} from './finnhub.service';
import { getUnusualVolumeStocks } from './polygon.service';
import { log, errorMessage } from '../utils/logger';

// ─── Static definitions (owned here, imported by market route) ────────────────

export const INDEX_DEFS: { symbol: string; label: string; yahooSymbol: string }[] = [
  { symbol: 'SPY',              label: 'S&P 500',  yahooSymbol: 'SPY'       },
  { symbol: 'BINANCE:BTCUSDT', label: 'BTC/USD',  yahooSymbol: 'BTC-USD'   },
  { symbol: '^VIX',             label: 'VIX',      yahooSymbol: '^VIX'      },
  { symbol: 'GLD',              label: 'Gold',     yahooSymbol: 'GLD'       },
  { symbol: 'SLV',              label: 'Silver',   yahooSymbol: 'SLV'       },
];

export const SECTOR_ETFS: { sector: string; etf: string }[] = [
  { sector: 'Technology',        etf: 'XLK'  },
  { sector: 'Financial',         etf: 'XLF'  },
  { sector: 'Healthcare',        etf: 'XLV'  },
  { sector: 'Energy',            etf: 'XLE'  },
  { sector: 'Industrials',       etf: 'XLI'  },
  { sector: 'Consumer Cyclical', etf: 'XLY'  },
  { sector: 'Utilities',         etf: 'XLU'  },
  { sector: 'Real Estate',       etf: 'XLRE' },
  { sector: 'Materials',         etf: 'XLB'  },
];

// ─── Cache storage ────────────────────────────────────────────────────────────

export interface IndexResult {
  symbol:        string;
  label:         string;
  currentPrice:  number | null;
  changePercent: number | null;
  sparkline:     number[];
}

export interface SectorResult {
  sector:        string;
  etf:           string;
  changePercent: number | null;
  currentPrice:  number | null;
}

export interface HomeResult {
  trending:   (StockQuote & { profile: CompanyProfile | null })[];
  topGainers: (StockQuote & { profile: CompanyProfile | null })[];
  topLosers:  (StockQuote & { profile: CompanyProfile | null })[];
  mostActive: (StockQuote & { profile: CompanyProfile | null })[];
}

let _indexes:       IndexResult[]                 | null = null;
let _sectors:       SectorResult[]                | null = null;
let _home:          HomeResult                    | null = null;
let _unusualVolume: Record<string, unknown>[]     | null = null;

export const getIndexesCache       = (): IndexResult[]                 | null => _indexes;
export const getSectorsCache       = (): SectorResult[]                | null => _sectors;
export const getHomeCache          = (): HomeResult                    | null => _home;
export const getUnusualVolumeCache = (): Record<string, unknown>[]     | null => _unusualVolume;

// ─── Refresh functions ────────────────────────────────────────────────────────

export async function refreshIndexes(): Promise<void> {
  try {
    const results = await Promise.all(
      INDEX_DEFS.map(async ({ symbol, label, yahooSymbol }) => {
        let quote = await getQuote(symbol).catch(() => null);
        if (!quote?.currentPrice) {
          quote = await getYahooQuote(yahooSymbol, symbol).catch(() => null);
        }
        let sparkline: number[] = [];
        const candles = await getDailyCandles(symbol, 30).catch(() => null);
        if (candles && candles.close.length > 0) {
          sparkline = candles.close;
        } else {
          const closes = await getYahooDailyCloses(yahooSymbol, 30).catch(() => null);
          if (closes) sparkline = closes;
        }
        return {
          symbol,
          label,
          currentPrice:  quote?.currentPrice  ?? null,
          changePercent: quote?.changePercent ?? null,
          sparkline,
        };
      })
    );
    _indexes = results;
  } catch (err) {
    log({ level: 'warn', tag: '[market-cache]', message: 'refreshIndexes failed', context: { error: errorMessage(err) } });
  }
}

export async function refreshSectors(): Promise<void> {
  try {
    const quotesMap = await getBatchQuotes(SECTOR_ETFS.map(s => s.etf));
    _sectors = SECTOR_ETFS.map(({ sector, etf }) => {
      const q = quotesMap.get(etf);
      return {
        sector,
        etf,
        changePercent: q?.changePercent ?? null,
        currentPrice:  q?.currentPrice  ?? null,
      };
    });
  } catch (err) {
    log({ level: 'warn', tag: '[market-cache]', message: 'refreshSectors failed', context: { error: errorMessage(err) } });
  }
}

export async function refreshHome(): Promise<void> {
  try {
    const [quotesMap, profileResults] = await Promise.all([
      getBatchQuotes(POPULAR_SYMBOLS),
      Promise.allSettled(
        POPULAR_SYMBOLS.map(s => getCompanyProfile(s).then(p => ({ symbol: s, profile: p })))
      ),
    ]);

    const profileMap = new Map<string, CompanyProfile | null>();
    for (const r of profileResults) {
      if (r.status === 'fulfilled') profileMap.set(r.value.symbol, r.value.profile);
    }

    const withProfiles = Array.from(quotesMap.values())
      .filter(q => q.currentPrice > 0)
      .map(q => ({ ...q, profile: profileMap.get(q.symbol) ?? null }));

    const byChange = [...withProfiles].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

    _home = {
      trending:   withProfiles.slice(0, 10),
      topGainers: byChange.slice(0, 10),
      topLosers:  byChange.slice(-10).reverse(),
      mostActive: [...withProfiles]
        .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
        .slice(0, 10),
    };
  } catch (err) {
    log({ level: 'warn', tag: '[market-cache]', message: 'refreshHome failed', context: { error: errorMessage(err) } });
  }
}

export async function refreshUnusualVolume(): Promise<void> {
  try {
    _unusualVolume = await getUnusualVolumeStocks() as unknown as Record<string, unknown>[];
  } catch (err) {
    log({ level: 'warn', tag: '[market-cache]', message: 'refreshUnusualVolume failed', context: { error: errorMessage(err) } });
  }
}

// ─── Init — called once on server startup ─────────────────────────────────────
// Populates all caches immediately, then refreshes on a schedule.
// Every client request hits the in-memory cache; no per-request Finnhub calls
// for these high-frequency endpoints.

export async function initMarketCache(): Promise<void> {
  await Promise.allSettled([
    refreshIndexes(),
    refreshSectors(),
    refreshHome(),
    refreshUnusualVolume(),
  ]);
  log({ level: 'info', tag: '[market-cache]', message: 'Market data cache initialised' });

  // Refresh indexes every 3 min
  setInterval(refreshIndexes, 3 * 60_000);
  // Refresh sectors, home, unusual-volume every 15 min
  setInterval(refreshSectors,      15 * 60_000);
  setInterval(refreshHome,         15 * 60_000);
  setInterval(refreshUnusualVolume, 15 * 60_000);
}
