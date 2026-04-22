import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getQuote, searchSymbols } from '../services/finnhub.service';

const router = Router();

// All routes use req.headers['x-user-id'] or fall back to DEV_USER_ID
function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) || process.env.DEV_USER_ID || 'dev-user';
}

/** GET /api/stocks/search?q= — search for stock symbols via Finnhub */
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 1) {
    return res.status(400).json({ error: 'query param "q" is required' });
  }

  try {
    const results = await searchSymbols(q);
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'Symbol search failed' });
  }
});

/** GET /api/stocks — list user's watchlist with live quotes */
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);

  const { data, error } = await supabase
    .from('user_stocks')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with live quotes
  const enriched = await Promise.all(
    (data ?? []).map(async (stock) => {
      try {
        const quote = await getQuote(stock.symbol);
        return { ...stock, quote };
      } catch {
        return { ...stock, quote: null };
      }
    })
  );

  return res.json(enriched);
});

/** POST /api/stocks — add a stock to watchlist */
router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { symbol, company_name } = req.body as { symbol?: string; company_name?: string };

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'symbol is required' });
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  // Validate symbol exists on Finnhub
  try {
    const quote = await getQuote(cleanSymbol);
    if (!quote.currentPrice) {
      return res.status(400).json({ error: `Symbol "${cleanSymbol}" not found or no price data` });
    }
  } catch {
    return res.status(400).json({ error: `Could not validate symbol "${cleanSymbol}"` });
  }

  const { data, error } = await supabase
    .from('user_stocks')
    .insert({ user_id: userId, symbol: cleanSymbol, company_name: company_name ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `${cleanSymbol} is already in your watchlist` });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

/** DELETE /api/stocks/:symbol — remove from watchlist */
router.delete('/:symbol', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const symbol = req.params.symbol.toUpperCase();

  const { error } = await supabase
    .from('user_stocks')
    .delete()
    .eq('user_id', userId)
    .eq('symbol', symbol);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ message: `${symbol} removed from watchlist` });
});

export default router;
