import { Request, Response, NextFunction } from 'express';
import { getUserIdFromRequest, verifySupabaseToken } from '../utils/auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    let email = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const verified = await verifySupabaseToken(token);

      if (!verified) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid Supabase signature token' });
        return;
      }

      userId = verified.sub;
      email = verified.email;

      // 3. THE EXPLICIT IDENTITY BIND
      if (email === 'devr01499@gmail.com') {
        userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      }
    } else {
      // Fallback to x-user-id for legacy/development compatibility
      userId = getUserIdFromRequest(req);
      if (userId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
        email = 'devr01499@gmail.com';
      } else if (userId) {
        email = `user-${userId}@supabase.io`;
      }
    }

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing authenticated session context' });
      return;
    }

    // Auto-upsert locally in local Postgres/SQLite schemas to prevent relation constraints failures
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: email || `user-${userId}@supabase.io`,
        fullName: email ? email.split('@')[0] : 'Supabase User',
        passwordHash: 'seeded-supabase-auth-placeholder',
        billingBalance: 1000.0,
      }
    });

    req.userId = userId;
    req.body.userId = userId; // Keep body.userId aligned for controllers
    next();
  } catch (err: any) {
    logger.error('requireAuth Middleware Authentication Exception', { error: err.message });
    res.status(500).json({ success: false, error: 'Internal Server Authentication Exception' });
  }
}
