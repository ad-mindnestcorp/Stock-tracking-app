import { Router, Request, Response } from 'express';
import { getTrendingStocks } from '../services/reddit.service';

const router = Router();

/** GET /api/trending-stocks — returns Reddit-based trending stocks from Supabase cache */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const stocks = await getTrendingStocks();
    return res.json(stocks);
  } catch (err) {
    console.error('[trending] Failed to fetch trending stocks:', err);
    return res.status(500).json({ error: 'Failed to fetch trending stocks' });
  }
});

export default router;
