import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getBatchQuotes } from '../services/finnhub.service';
import { aggregateNews, NewsArticle } from '../services/news-aggregator.service';

const router = Router();

function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) || process.env.DEV_USER_ID || 'dev-user';
}

async function getWatchlistTickers(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('watchlist_stocks')
      .select('symbol')
      .eq('user_id', userId);
    if (data && data.length > 0) return data.map((r) => r.symbol as string);

    // Fall back to legacy user_stocks
    const { data: legacy } = await supabase
      .from('user_stocks')
      .select('symbol')
      .eq('user_id', userId);
    return (legacy ?? []).map((r) => r.symbol as string);
  } catch {
    return [];
  }
}

/** GET /api/news?tickers=AAPL,MSFT&filter=my_stocks|markets|earnings|economy */
router.get('/', async (req: Request, res: Response) => {
  const filter = (req.query.filter as string | undefined) ?? 'markets';

  let tickers: string[] | undefined;

  if (req.query.tickers) {
    tickers = (req.query.tickers as string)
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
  } else if (filter === 'my_stocks') {
    const userId = getUserId(req);
    const watchlistTickers = await getWatchlistTickers(userId);
    tickers = watchlistTickers.length > 0 ? watchlistTickers : undefined;
  }

  try {
    const news = await aggregateNews(tickers, filter);

    // Collect all unique tickers from the returned articles
    const allTickers = new Set<string>();
    for (const article of [...news.topStories, ...news.moreNews]) {
      article.tickers.forEach((t) => allTickers.add(t));
    }

    // Fetch current quotes for ticker chips (uses the 60-s cached Finnhub service)
    const tickerChanges: Record<string, number> = {};
    if (allTickers.size > 0) {
      try {
        const quotesMap = await getBatchQuotes(Array.from(allTickers).slice(0, 30));
        quotesMap.forEach((quote, symbol) => {
          if (quote.changePercent != null) {
            tickerChanges[symbol] = quote.changePercent;
          }
        });
      } catch {
        // Non-fatal — ticker chips will render in gray
      }
    }

    const injectChanges = (articles: NewsArticle[]) =>
      articles.map((a) => {
        const changes: Record<string, number> = {};
        for (const t of a.tickers) {
          if (tickerChanges[t] != null) changes[t] = tickerChanges[t];
        }
        return { ...a, tickerChanges: changes };
      });

    return res.json({
      topStories: injectChanges(news.topStories),
      moreNews: injectChanges(news.moreNews),
      fetchedAt: news.fetchedAt,
    });
  } catch (err) {
    console.error('[news] aggregation failed:', err);
    return res.status(500).json({ error: 'Failed to fetch news' });
  }
});

export default router;
