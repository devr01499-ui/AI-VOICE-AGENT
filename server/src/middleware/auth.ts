import { Request, Response, NextFunction } from 'express';
import { getUserIdFromRequest } from '../utils/auth';
import { supabaseClient } from '../utils/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  let activePhase = 'token_verification';
  try {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    let email = '';
    let userMetadata: any = {};

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Missing or malformed authorization header context' });
        return;
      }

      const token = authHeader.substring(7).trim();

      // Defensive Validation Boundary: Instantly catch undefined or clear non-JWT footprints
      if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) {
        res.status(401).json({ success: false, error: 'Invalid authentication token structure' });
        return;
      }
      
      activePhase = 'supabase_getUser';
      // Verify signature via official Supabase client SDK getUser call
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        res.status(401).json({ success: false, error: 'Unauthorized: Invalid Supabase signature token' });
        return;
      }

      userId = user.id;
      email = user.email || '';
      userMetadata = user.user_metadata || {};

      // 3. THE EXPLICIT IDENTITY BIND
      if (email === 'devr01499@gmail.com') {
        userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      } else {
        // Block unverified multi-tenant access
        if (!user.email_confirmed_at && !userMetadata?.email_confirmed_at) {
          res.status(403).json({ 
            error: "Access Denied: Please verify your email address via the sent security link to activate this workspace environment." 
          });
          return;
        }
      }
    } else {
      activePhase = 'legacy_auth_fallback';
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

    // Extract metadata attributes directly
    const fullName = userMetadata.full_name || (email ? email.split('@')[0] : 'Supabase User');
    const accountType = userMetadata.account_type || 'free';
    const contactNumber = userMetadata.contact_number || null;

    activePhase = 'database_upsert';
    // Auto-upsert locally in PostgreSQL schemas to prevent relation constraints failures
    const userProfile = await prisma.user.upsert({
      where: { id: userId },
      update: {
        fullName: fullName,
        accountType: accountType,
        contactNumber: contactNumber,
      },
      create: {
        id: userId,
        email: email || `user-${userId}@supabase.io`,
        fullName: fullName,
        accountType: accountType,
        contactNumber: contactNumber,
        passwordHash: 'seeded-supabase-auth-placeholder',
        billingBalance: 1000.0,
        callingBalanceMinutes: 10.0,
      }
    });

    req.userId = userId;
    req.user = userProfile;
    req.body.userId = userId; // Keep body.userId aligned for controllers
    next();
  } catch (err: any) {
    logger.error(`requireAuth Middleware Authentication Exception [Phase: ${activePhase}]`, { error: err.message });
    res.status(500).json({ success: false, error: `Internal Server Authentication Exception: Failed during ${activePhase} (${err.message || 'unknown error'})` });
  }
}
