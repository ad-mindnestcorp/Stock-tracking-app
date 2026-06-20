import { getQuote, getBatchQuotes, getWeek52Data, getCompanyProfile, type StockQuote, type Week52Data, type CompanyProfile } from './finnhub.service';
import { calculateRSI } from './rsi.service';
import { calculateDMA } from './dma.service';
import { calculateSupportResistance } from './support-resistance.service';
import { calculateMomentum } from './momentum.service';

interface RawStock {
  symbol: string;
  company_name?: string | null;
  [key: string]: unknown;
}

function buildEnrichedStock(
  stock: RawStock,
  quote: StockQuote | null,
  week52: Week52Data | null,
  profile: CompanyProfile | null,
): RawStock & Record<string, unknown> {
  if (!quote) {
    return {
      ...stock,
      quote: null,
      rsi: null,
      isOverbought: false,
      isOversold: false,
      week52High: null,
      week52Low: null,
      relativeVolume: null,
      sparkline: null,
    };
  }

  const rsiResult    = week52 ? calculateRSI(week52.closes) : null;
  const dmaResult    = week52 ? calculateDMA(week52.closes, quote.currentPrice) : null;
  const srResult     =
    week52?.recentLows && week52?.recentHighs
      ? calculateSupportResistance(week52.recentLows, week52.recentHighs, quote.currentPrice)
      : null;
  const relativeVolume =
    quote.volume != null && week52?.avgVolume != null && week52.avgVolume > 0
      ? quote.volume / week52.avgVolume
      : null;
  const momentumScore = week52
    ? calculateMomentum(rsiResult?.rsi ?? null, week52.closes, relativeVolume)
    : null;

  return {
    ...stock,
    quote: { ...quote, profile: profile ?? null },
    rsi:              rsiResult?.rsi           ?? null,
    isOverbought:     rsiResult?.isOverbought  ?? false,
    isOversold:       rsiResult?.isOversold    ?? false,
    rsiTrend:         rsiResult?.rsiTrend      ?? 'flat',
    week52High:       week52?.high52w          ?? null,
    week52Low:        week52?.low52w           ?? null,
    relativeVolume,
    ma50:             dmaResult?.ma50          ?? null,
    ma200:            dmaResult?.ma200         ?? null,
    ma50Trend:        dmaResult?.ma50Trend     ?? null,
    ma200Trend:       dmaResult?.ma200Trend    ?? null,
    supportLevel:     srResult?.support        ?? null,
    resistanceLevel:  srResult?.resistance     ?? null,
    srSignal:         srResult?.signal         ?? null,
    momentumScore,
    sparkline:        week52?.closes?.slice(-14) ?? null,
  };
}

/** Enrich a single stock — used by stock-detail route. */
export async function enrichStock(stock: RawStock): Promise<RawStock & Record<string, unknown>> {
  try {
    const [quote, week52, profile] = await Promise.all([
      getQuote(stock.symbol),
      getWeek52Data(stock.symbol),
      getCompanyProfile(stock.symbol),
    ]);
    return buildEnrichedStock(stock, quote, week52, profile);
  } catch {
    return buildEnrichedStock(stock, null, null, null);
  }
}

/**
 * Enrich a list of stocks efficiently:
 *  1. Fetch all quotes in one batched call (getBatchQuotes handles the 10-at-a-time
 *     rate-limit throttle internally — N symbols → ceil(N/10) batches with 150ms gaps).
 *  2. Fetch week52 and profile data in parallel (individually cached; cache hits are free).
 *  3. Compute all derived metrics (RSI, DMA, S/R, momentum) from the fetched data.
 *
 * Before this change: N × 3 individual getQuote calls fired simultaneously.
 * After:              1 batched call that respects rate limits automatically.
 */
export async function enrichStocks(stocks: RawStock[]): Promise<(RawStock & Record<string, unknown>)[]> {
  if (stocks.length === 0) return [];

  const symbols = stocks.map(s => s.symbol);

  // Single batched quote fetch — stays within Finnhub rate limits
  const [quotesMap, week52Results, profileResults] = await Promise.all([
    getBatchQuotes(symbols),
    Promise.allSettled(symbols.map(s => getWeek52Data(s))),
    Promise.allSettled(symbols.map(s => getCompanyProfile(s))),
  ]);

  return stocks.map((stock, i) => {
    const quote   = quotesMap.get(stock.symbol) ?? null;
    const week52  = week52Results[i].status === 'fulfilled'  ? week52Results[i].value  : null;
    const profile = profileResults[i].status === 'fulfilled' ? profileResults[i].value : null;
    return buildEnrichedStock(stock, quote, week52, profile);
  });
}
