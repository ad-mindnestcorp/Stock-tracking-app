import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) || process.env.DEV_USER_ID || 'dev-user';
}

/** GET /api/alerts — get alert history for user */
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const unreadOnly = req.query.unread === 'true';

  let query = supabase
    .from('alerts_log')
    .select('*')
    .eq('user_id', userId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json(data ?? []);
});

/** PATCH /api/alerts/:id/read — mark a single alert as read */
router.patch('/:id/read', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('alerts_log')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Marked as read' });
});

/** PATCH /api/alerts/read-all — mark all alerts as read */
router.patch('/read-all', async (req: Request, res: Response) => {
  const userId = getUserId(req);

  const { error } = await supabase
    .from('alerts_log')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'All alerts marked as read' });
});

export default router;
