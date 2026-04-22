import { Router, Request, Response } from 'express';
import {
  getQuote,
  getBatchQuotes,
  getDailyCandles,
  getIntradayCandles,
  getCompanyProfile,
  getWeek52Data,
  POPULAR_SYMBOLS,
} from '../services/finnhub.service';
import { calculateRSI } from '../services/rsi.service';

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

/** GET /api/market/home — trending, top gainers, top losers from popular symbols */
router.get('/home', async (req: Request, res: Response) => {
  try {
    const quotesMap = await getBatchQuotes(POPULAR_SYMBOLS);
    const quotes = Array.from(quotesMap.values()).filter(
      (q) => q.currentPrice > 0
    );

    const byChangePercent = [...quotes].sort(
      (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)
    );

    return res.json({
      trending: quotes.slice(0, 10),
      topGainers: byChangePercent.slice(0, 10),
      topLosers: byChangePercent.slice(-10).reverse(),
      mostActive: [...quotes]
        .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))
        .slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch home market data' });
  }
});

export default router;
