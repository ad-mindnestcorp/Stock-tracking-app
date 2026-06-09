import { POPULAR_SYMBOLS, getCompanyProfile } from "./finnhub.service";
import { log, errorMessage } from "../utils/logger";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinanceClass = require("yahoo-finance2").default as new (
  opts?: Record<string, unknown>,
) => {
  quote: (symbol: string) => Promise<Record<string, unknown>>;
};

let _yf: InstanceType<typeof YahooFinanceClass> | null = null;
function getYF(): InstanceType<typeof YahooFinanceClass> {
  if (!_yf) _yf = new YahooFinanceClass({ suppressNotices: ["ripHistorical"] });
  return _yf;
}

export interface UnusualVolumeStock {
  ticker: string;
  name?: string;
  logo?: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
}

interface CacheEntry {
  data: UnusualVolumeStock[];
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const TTL_MS = 5 * 60_000;

/**
 * Returns the top 10 stocks from POPULAR_SYMBOLS ranked by
 * today's volume / 3-month average daily volume.
 * Uses Yahoo Finance — no paid API key required.
 */
export async function getUnusualVolumeStocks(): Promise<UnusualVolumeStock[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  try {
    const results = await Promise.allSettled(
      POPULAR_SYMBOLS.map((symbol) =>
        getYF()
          .quote(symbol)
          .then((q) => {
            const volume = (q.regularMarketVolume as number) ?? 0;
            const avgVolume =
              (q.averageDailyVolume3Month as number) ??
              (q.averageDailyVolume10Day as number) ??
              0;
            return {
              ticker: symbol,
              name: (q.shortName ?? q.longName) as string | undefined,
              currentPrice: (q.regularMarketPrice as number) ?? 0,
              changePercent: (q.regularMarketChangePercent as number) ?? 0,
              volume,
              avgVolume,
            };
          }),
      ),
    );

    const ranked: UnusualVolumeStock[] = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          ticker: string;
          name: string | undefined;
          currentPrice: number;
          changePercent: number;
          volume: number;
          avgVolume: number;
        }> => r.status === "fulfilled",
      )
      .map((r) => r.value)
      .filter((s) => s.avgVolume > 0 && s.volume > 0)
      .map((s) => ({ ...s, volumeRatio: s.volume / s.avgVolume }))
      .sort((a, b) => b.volumeRatio - a.volumeRatio)
      .slice(0, 10);

    const profileResults = await Promise.allSettled(
      ranked.map((s) => getCompanyProfile(s.ticker)),
    );
    const withLogos: UnusualVolumeStock[] = ranked.map((s, i) => {
      const pr = profileResults[i];
      const logo =
        pr.status === "fulfilled" && pr.value?.logo ? pr.value.logo : undefined;
      return { ...s, logo };
    });

    cache = { data: withLogos, expiresAt: Date.now() + TTL_MS };
    return withLogos;
  } catch (err) {
    log({
      level: 'error',
      tag: '[yahoo]',
      message: 'getUnusualVolumeStocks failed',
      context: { error: errorMessage(err) },
    });
    return cache?.data ?? [];
  }
}
