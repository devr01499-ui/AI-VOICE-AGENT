import { Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from './auth';
import { requireApiKey, ApiAuthenticatedRequest } from './apiAuth';

export const requireAuthOrApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  
  // A simple heuristic: if the token starts with our api key prefix, use API Key auth.
  // Otherwise, use Supabase session auth.
  if (token.startsWith('blna_live_')) {
    await requireApiKey(req as ApiAuthenticatedRequest, res, next);
  } else {
    await requireAuth(req as AuthenticatedRequest, res, next);
  }
};
