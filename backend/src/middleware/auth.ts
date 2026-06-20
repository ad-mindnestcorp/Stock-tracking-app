import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Sets req.userId on success.
 * In development (DEV_USER_ID set), falls back to that value if no token is provided.
 * Returns 401 in production if the token is missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    const devUserId = process.env.DEV_USER_ID;
    if (devUserId) {
      req.userId = devUserId;
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.userId = user.id;
  next();
}
