import { Router, Request, Response } from 'express';
import { Expo } from 'expo-server-sdk';
import { supabase } from '../lib/supabase';
import { triggerNow } from '../services/scheduler.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

/** POST /api/push-token — register an Expo push token */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const { token } = req.body as { token?: string };

  if (!token || !Expo.isExpoPushToken(token)) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Push token registered' });
});

/** DELETE /api/push-token — unregister token */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const { token } = req.body as { token?: string };

  if (!token) return res.status(400).json({ error: 'token is required' });

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ message: 'Token removed' });
});

/** POST /api/push-token/trigger-check — manually trigger alert checks (dev/testing) */
router.post('/trigger-check', async (_req: Request, res: Response) => {
  triggerNow().catch(console.error);
  return res.json({ message: 'Alert check triggered' });
});

export default router;
