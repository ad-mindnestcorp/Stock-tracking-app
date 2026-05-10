import { Router, Request, Response } from 'express';
import {
  getQuote,
  getYahooQuote,
  getBatchQuotes,
  getDailyCandles,
  getIntradayCandles,
  getCompanyProfile,
  getWeek52Data,
  getYahooDailyCloses,
  POPULAR_SYMBOLS,
} from '../services/finnhub.service';
import { calculateRSI } from '../services/rsi.service';
import { getUnusualVolumeStocks } from '../services/polygon.service';

// ─── Index ticker cards (Home screen Feature 1) ──────────────────────────────
// SPY is used as a tradable proxy for the S&P 500 since Finnhub free tier
// does not return quotes for ^GSPC.
const INDEX_DEFS: { symbol: string; label: string; yahooSymbol: string }[] = [
  { symbol: 'SPY', label: 'S&P 500', yahooSymbol: 'SPY' },
  { symbol: 'BINANCE:BTCUSDT', label: 'BTC/USD', yahooSymbol: 'BTC-USD' },
  { symbol: '^VIX', label: 'VIX', yahooSymbol: '^VIX' },
  { symbol: 'GLD', label: 'Gold', yahooSymbol: 'GLD' },
  { symbol: 'SLV', label: 'Silver', yahooSymbol: 'SLV' },
];

// ─── Sector ETFs for the Heatmap (Feature 2) ─────────────────────────────────
const SECTOR_ETFS: { sector: string; etf: string }[] = [
  { sector: 'Technology', etf: 'XLK' },
  { sector: 'Financial', etf: 'XLF' },
  { sector: 'Healthcare', etf: 'XLV' },
  { sector: 'Energy', etf: 'XLE' },
  { sector: 'Industrials', etf: 'XLI' },
  { sector: 'Consumer Cyclical', etf: 'XLY' },
  { sector: 'Utilities', etf: 'XLU' },
  { sector: 'Real Estate', etf: 'XLRE' },
  { sector: 'Materials', etf: 'XLB' },
];

const router = Router();

function normalizeSymbolParam(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase();
}

/** GET /api/market/quote/:symbol — single stock quote */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  const symbol = normalizeSymbolParam(req.params.symbol);
  try {
    const [quote, profile] = await Promise.all([
      getQuote(symbol),
      getCompanyProfile(symbol),
    ]);
    return res.json({ ...quote, profile });
  } catch {
    return res.status(500).json({ error: `Failed to fetch quote for ${symbol}` });
  }
});

/** GET /api/market/detail/:symbol — full stock detail (quote + profile + RSI + 52W) */
router.get('/detail/:symbol', async (req: Request, res: Response) => {
  const symbol = normalizeSymbolParam(req.params.symbol);
  try {
    const quote = await getQuote(symbol);
    const [profile, week52] = await Promise.all([
      getCompanyProfile(symbol),
      getWeek52Data(symbol),
    ]);

    const rsiResult = week52 ? calculateRSI(week52.closes) : null;

    return res.json({
      ...quote,
      profile,
      week52High: week52?.high52w ?? null,
      week52Low: week52?.low52w ?? null,
      rsi: rsiResult?.rsi ?? null,
      isOverbought: rsiResult?.isOverbought ?? false,
      isOversold: rsiResult?.isOversold ?? false,
      rsiTrend: rsiResult?.rsiTrend ?? 'flat',
    });
  } catch (err) {
    console.error(`Detail fetch failed for ${symbol}:`, err);
    return res.status(500).json({ error: `Failed to fetch detail for ${symbol}` });
  }
});

/** GET /api/market/candles/:symbol?range=1D|1W|1M|3M|6M|1Y */
router.get('/candles/:symbol', async (req: Request, res: Response) => {
  const symbol = normalizeSymbolParam(req.params.symbol);
  const range = (req.query.range as string) || '1M';

  try {
    let candles;
    if (range === '1D') {
      candles = await getIntradayCandles(symbol);
    } else {
      const daysMap: Record<string, number> = {
        '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365,
      };
      const days = daysMap[range] ?? 30;
      candles = await getDailyCandles(symbol, days);
    }

    if (!candles) return res.status(404).json({ error: 'No candle data available' });
    return res.json(candles);
  } catch {
    return res.status(500).json({ error: `Failed to fetch candles for ${symbol}` });
  }
});

/** GET /api/market/indexes — index cards (S&P 500 / BTC / VIX / GLD / SLV) with sparklines */
router.get('/indexes', async (_req: Request, res: Response) => {
  try {
    const results = await Promise.all(
      INDEX_DEFS.map(async ({ symbol, label, yahooSymbol }) => {
        let quote = await getQuote(symbol).catch(() => null);
        if (!quote || !quote.currentPrice) {
          quote = await getYahooQuote(yahooSymbol, symbol).catch(() => null);
        }

        // Try Finnhub daily candles first (works for some symbols/keys),
        // fall back to Yahoo Finance for the trailing 30 daily closes.
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
          currentPrice: quote?.currentPrice ?? null,
          changePercent: quote?.changePercent ?? null,
          sparkline,
        };
      })
    );
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch indexes' });
  }
});

/** GET /api/market/sectors — 9 sector ETFs with daily % change for the heatmap */
router.get('/sectors', async (_req: Request, res: Response) => {
  try {
    const symbols = SECTOR_ETFS.map((s) => s.etf);
    const quotesMap = await getBatchQuotes(symbols);
    const results = SECTOR_ETFS.map(({ sector, etf }) => {
      const q = quotesMap.get(etf);
      return {
        sector,
        etf,
        changePercent: q?.changePercent ?? null,
        currentPrice: q?.currentPrice ?? null,
      };
    });
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

/** GET /api/market/unusual-volume — top 10 stocks by volume / avgVolume ratio */
router.get('/unusual-volume', async (_req: Request, res: Response) => {
  try {
    const results = await getUnusualVolumeStocks();
    return res.json(results);
  } catch (err) {
    console.error('Unusual volume fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch unusual volume' });
  }
});

/** GET /api/market/home — trending, top gainers, top losers from popular symbols */
router.get('/home', async (req: Request, res: Response) => {
  try {
    const [quotesMap, profileResults] = await Promise.all([
      getBatchQuotes(POPULAR_SYMBOLS),
      Promise.allSettled(
        POPULAR_SYMBOLS.map((s) => getCompanyProfile(s).then((p) => ({ symbol: s, profile: p })))
      ),
    ]);
    const quotes = Array.from(quotesMap.values()).filter(
      (q) => q.currentPrice > 0
    );
    const profileMap = new Map<string, Awaited<ReturnType<typeof getCompanyProfile>>>();
    for (const r of profileResults) {
      if (r.status === 'fulfilled' && r.value.profile) {
        profileMap.set(r.value.symbol, r.value.profile);
      }
    }

    const withProfiles = quotes.map((q) => ({
      ...q,
      profile: profileMap.get(q.symbol) ?? null,
    }));

    const byChangePercent = [...withProfiles].sort(
      (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)
    );

    return res.json({
      trending: withProfiles.slice(0, 10),
      topGainers: byChangePercent.slice(0, 10),
      topLosers: byChangePercent.slice(-10).reverse(),
      mostActive: [...withProfiles]
        .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
        .slice(0, 10),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch home market data' });
  }
});

export default router;
