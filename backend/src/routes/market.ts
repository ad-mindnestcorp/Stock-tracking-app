import { Router, Request, Response } from 'express';
import { log, errorMessage } from '../utils/logger';
import {
  getQuote,
  getCompanyProfile,
  getWeek52Data,
  getDailyCandles,
  getDailyCandlesFromYahoo,
  getIntradayCandles,
} from '../services/finnhub.service';
import { calculateRSI } from '../services/rsi.service';
import { calculateDMA } from '../services/dma.service';
import { calculateSupportResistance } from '../services/support-resistance.service';
import { calculateMomentum } from '../services/momentum.service';
import {
  INDEX_DEFS,
  SECTOR_ETFS,
  getIndexesCache,
  getSectorsCache,
  getHomeCache,
  getUnusualVolumeCache,
  refreshIndexes,
  refreshSectors,
  refreshHome,
  refreshUnusualVolume,
} from '../services/market-cache.service';
import {
  getMarketNews,
  getEarningsCalendar,
  getEconomicCalendar,
} from '../services/finnhub.service';

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
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: `quote failed for ${symbol}`, context: { symbol, error: errorMessage(err) } });
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
    const dmaResult = week52 && quote ? calculateDMA(week52.closes, quote.currentPrice) : null;
    const srResult =
      week52?.recentLows && week52?.recentHighs && quote
        ? calculateSupportResistance(week52.recentLows, week52.recentHighs, quote.currentPrice)
        : null;
    const relativeVolume =
      quote?.volume != null && week52?.avgVolume != null && week52.avgVolume > 0
        ? quote.volume / week52.avgVolume
        : null;
    const momentumScore = week52
      ? calculateMomentum(rsiResult?.rsi ?? null, week52.closes, relativeVolume)
      : null;

    return res.json({
      ...quote,
      profile,
      week52High: week52?.high52w ?? null,
      week52Low: week52?.low52w ?? null,
      rsi: rsiResult?.rsi ?? null,
      isOverbought: rsiResult?.isOverbought ?? false,
      isOversold: rsiResult?.isOversold ?? false,
      rsiTrend: rsiResult?.rsiTrend ?? 'flat',
      ma50: dmaResult?.ma50 ?? null,
      ma200: dmaResult?.ma200 ?? null,
      ma50Trend: dmaResult?.ma50Trend ?? null,
      ma200Trend: dmaResult?.ma200Trend ?? null,
      supportLevel: srResult?.support ?? null,
      resistanceLevel: srResult?.resistance ?? null,
      srSignal: srResult?.signal ?? null,
      relativeVolume,
      momentumScore,
    });
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: `detail failed for ${symbol}`, context: { symbol, error: errorMessage(err) } });
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
      if (!candles) candles = await getDailyCandlesFromYahoo(symbol, days);
    }

    if (!candles) return res.status(404).json({ error: 'No candle data available' });
    return res.json(candles);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: `candles failed for ${symbol}`, context: { symbol, range, error: errorMessage(err) } });
    return res.status(500).json({ error: `Failed to fetch candles for ${symbol}` });
  }
});

/** GET /api/market/indexes — index cards (S&P 500 / BTC / VIX / GLD / SLV) with sparklines
 *  Served from the pre-warmed background cache; falls back to a live fetch if the cache
 *  has not been populated yet (e.g. very first request before startup completes). */
router.get('/indexes', async (_req: Request, res: Response) => {
  try {
    const cached = getIndexesCache();
    if (cached) return res.json(cached);
    await refreshIndexes();
    return res.json(getIndexesCache() ?? []);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'indexes failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch indexes' });
  }
});

/** GET /api/market/sectors — 9 sector ETFs with daily % change for the heatmap */
router.get('/sectors', async (_req: Request, res: Response) => {
  try {
    const cached = getSectorsCache();
    if (cached) return res.json(cached);
    await refreshSectors();
    return res.json(getSectorsCache() ?? []);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'sectors failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

/** GET /api/market/unusual-volume — top 10 stocks by volume / avgVolume ratio */
router.get('/unusual-volume', async (_req: Request, res: Response) => {
  try {
    const cached = getUnusualVolumeCache();
    if (cached) return res.json(cached);
    await refreshUnusualVolume();
    return res.json(getUnusualVolumeCache() ?? []);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'unusual-volume failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch unusual volume' });
  }
});

/** GET /api/market/home — trending, top gainers, top losers from popular symbols */
router.get('/home', async (_req: Request, res: Response) => {
  try {
    const cached = getHomeCache();
    if (cached) return res.json(cached);
    await refreshHome();
    return res.json(getHomeCache() ?? { trending: [], topGainers: [], topLosers: [], mostActive: [] });
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'home failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch home market data' });
  }
});

/** GET /api/market/news?category= — general market news (proxies Finnhub, cached 5 min) */
router.get('/news', async (req: Request, res: Response) => {
  const category = (req.query.category as string | undefined) ?? 'general';
  try {
    const items = await getMarketNews(category);
    return res.json(items);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'news failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

/** GET /api/market/earnings-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — earnings calendar (cached 1 h) */
router.get('/earnings-calendar', async (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!from || !to) {
    return res.status(400).json({ error: '"from" and "to" query params are required (YYYY-MM-DD)' });
  }
  try {
    const items = await getEarningsCalendar(from, to);
    return res.json(items);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'earnings-calendar failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch earnings calendar' });
  }
});

/** GET /api/market/economic-calendar — economic events calendar (cached 1 h) */
router.get('/economic-calendar', async (_req: Request, res: Response) => {
  try {
    const items = await getEconomicCalendar();
    return res.json(items);
  } catch (err) {
    log({ level: 'error', tag: '[market]', message: 'economic-calendar failed', context: { error: errorMessage(err) } });
    return res.status(500).json({ error: 'Failed to fetch economic calendar' });
  }
});

export default router;
