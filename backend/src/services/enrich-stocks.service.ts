import { getQuote, getWeek52Data, getCompanyProfile } from './finnhub.service';
import { calculateRSI } from './rsi.service';
import { calculateDMA } from './dma.service';
import { calculateSupportResistance } from './support-resistance.service';
import { calculateMomentum } from './momentum.service';

interface RawStock {
  symbol: string;
  company_name?: string | null;
  [key: string]: unknown;
}

export async function enrichStock(stock: RawStock): Promise<RawStock & Record<string, unknown>> {
  try {
    const [quote, week52, profile] = await Promise.all([
      getQuote(stock.symbol),
      getWeek52Data(stock.symbol),
      getCompanyProfile(stock.symbol),
    ]);
    const rsiResult = week52 ? calculateRSI(week52.closes) : null;
    const dmaResult = week52 && quote ? calculateDMA(week52.closes, quote.currentPrice) : null;
    const srResult =
      week52?.recentLows && week52?.recentHighs && quote
        ? calculateSupportResistance(week52.recentLows, week52.recentHighs, quote.currentPrice)
        : null;
    const currentVolume = quote?.volume;
    const avgVolume = week52?.avgVolume;
    const relativeVolume =
      currentVolume != null && avgVolume != null && avgVolume > 0
        ? currentVolume / avgVolume
        : null;
    const momentumScore = week52
      ? calculateMomentum(rsiResult?.rsi ?? null, week52.closes, relativeVolume)
      : null;
    const sparkline = week52?.closes?.slice(-14) ?? null;
    return {
      ...stock,
      quote: quote ? { ...quote, profile: profile ?? null } : null,
      rsi: rsiResult?.rsi ?? null,
      isOverbought: rsiResult?.isOverbought ?? false,
      isOversold: rsiResult?.isOversold ?? false,
      rsiTrend: rsiResult?.rsiTrend ?? 'flat',
      week52High: week52?.high52w ?? null,
      week52Low: week52?.low52w ?? null,
      relativeVolume,
      ma50: dmaResult?.ma50 ?? null,
      ma200: dmaResult?.ma200 ?? null,
      ma50Trend: dmaResult?.ma50Trend ?? null,
      ma200Trend: dmaResult?.ma200Trend ?? null,
      supportLevel: srResult?.support ?? null,
      resistanceLevel: srResult?.resistance ?? null,
      srSignal: srResult?.signal ?? null,
      momentumScore,
      sparkline,
    };
  } catch {
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
}

export async function enrichStocks(stocks: RawStock[]): Promise<(RawStock & Record<string, unknown>)[]> {
  return Promise.all(stocks.map(enrichStock));
}
