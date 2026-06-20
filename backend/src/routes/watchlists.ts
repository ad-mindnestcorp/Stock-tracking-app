import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { searchSymbols, getQuote } from '../services/finnhub.service';
import { enrichStocks } from '../services/enrich-stocks.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

/**
 * Ensures the user has at least one watchlist. If none exist, creates "My Watchlist"
 * and migrates any existing user_stocks into it. Returns all watchlists.
 */
async function ensureDefaultWatchlist(userId: string) {
  const { data: existing } = await supabase
    .from('watchlists')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (existing && existing.length > 0) return existing;

  // Create default watchlist
  const { data: created, error: createErr } = await supabase
    .from('watchlists')
    .insert({ user_id: userId, name: 'My Watchlist' })
    .select('id, name, created_at')
    .single();

  if (createErr || !created) return [];

  // Migrate existing user_stocks into the new default watchlist
  const { data: legacyStocks } = await supabase
    .from('user_stocks')
    .select('symbol, company_name')
    .eq('user_id', userId);

  if (legacyStocks && legacyStocks.length > 0) {
    await supabase.from('watchlist_stocks').insert(
      legacyStocks.map((s) => ({
        watchlist_id: created.id,
        user_id: userId,
        symbol: s.symbol,
        company_name: s.company_name,
      }))
    );
  }

  return [created];
}

/** GET /api/watchlists — list user's watchlists (auto-creates default if none) */
router.get('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  try {
    const watchlists = await ensureDefaultWatchlist(userId);
    return res.json(watchlists);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch watchlists' });
  }
});

/** POST /api/watchlists — create a new watchlist */
router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('watchlists')
    .insert({ user_id: userId, name: name.trim() })
    .select('id, name, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A watchlist named "${name.trim()}" already exists` });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

/** PATCH /api/watchlists/:id — rename a watchlist */
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { id } = req.params;
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('watchlists')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, name, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A watchlist named "${name.trim()}" already exists` });
    }
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: 'Watchlist not found' });

  return res.json(data);
});

/** DELETE /api/watchlists/:id — delete a watchlist */
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { id } = req.params;

  // Prevent deleting the last watchlist
  const { count } = await supabase
    .from('watchlists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) <= 1) {
    return res.status(400).json({ error: 'Cannot delete your only watchlist' });
  }

  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ message: 'Watchlist deleted' });
});

/** GET /api/watchlists/:id/stocks — list stocks in a watchlist with live data */
router.get('/:id/stocks', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('watchlist_stocks')
    .select('*')
    .eq('watchlist_id', id)
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const enriched = await enrichStocks(data ?? []);
  return res.json(enriched);
});

/** POST /api/watchlists/:id/stocks — add a stock to a watchlist */
router.post('/:id/stocks', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { id } = req.params;
  const { symbol, company_name } = req.body as { symbol?: string; company_name?: string };

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'symbol is required' });
  }

  // Verify the watchlist belongs to this user
  const { data: watchlist } = await supabase
    .from('watchlists')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!watchlist) return res.status(404).json({ error: 'Watchlist not found' });

  const cleanSymbol = symbol.trim().toUpperCase();

  try {
    const quote = await getQuote(cleanSymbol);
    if (!quote.currentPrice) {
      return res.status(400).json({ error: `Symbol "${cleanSymbol}" not found or no price data` });
    }
  } catch {
    return res.status(400).json({ error: `Could not validate symbol "${cleanSymbol}"` });
  }

  const { data, error } = await supabase
    .from('watchlist_stocks')
    .insert({ watchlist_id: id, user_id: userId, symbol: cleanSymbol, company_name: company_name ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `${cleanSymbol} is already in this watchlist` });
    }
    return res.status(500).json({ error: error.message });
  }

  // Also upsert into user_stocks so the alert engine keeps monitoring this symbol
  await supabase
    .from('user_stocks')
    .upsert({ user_id: userId, symbol: cleanSymbol, company_name: company_name ?? null }, { onConflict: 'user_id,symbol' });

  return res.status(201).json(data);
});

/** DELETE /api/watchlists/:id/stocks/:symbol — remove a stock from a watchlist */
router.delete('/:id/stocks/:symbol', async (req: Request, res: Response) => {
  const userId = req.userId;
  const { id, symbol } = req.params;
  const cleanSymbol = symbol.toUpperCase();

  const { error } = await supabase
    .from('watchlist_stocks')
    .delete()
    .eq('watchlist_id', id)
    .eq('user_id', userId)
    .eq('symbol', cleanSymbol);

  if (error) return res.status(500).json({ error: error.message });

  // Remove from user_stocks only if symbol is not in any other watchlist for this user
  const { count } = await supabase
    .from('watchlist_stocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('symbol', cleanSymbol);

  if ((count ?? 0) === 0) {
    await supabase
      .from('user_stocks')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', cleanSymbol);
  }

  return res.json({ message: `${cleanSymbol} removed from watchlist` });
});

/** GET /api/watchlists/search?q= — search for stock symbols */
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

export default router;
