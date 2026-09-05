import { Request } from 'express';
import { logger } from './logger';

/**
 * Verifies the Supabase access token (JWT) signature securely via Supabase Auth API proxy calls.
 */
export async function verifySupabaseToken(token: string): Promise<{ email: string; sub: string; email_verified?: boolean; user_metadata?: any } | null> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      logger.error('verifySupabaseToken: Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL env variable');
      return null;
    }

    if (!supabaseAnonKey) {
      logger.error('verifySupabaseToken: Missing SUPABASE_ANON_KEY env variable');
      return null;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey,
      },
    });

    if (!response.ok) {
      logger.warn(`verifySupabaseToken: Supabase API returned status ${response.status}`);
      return null;
    }

    const userData = (await response.json()) as any;
    if (userData && userData.id) {
      return {
        email: userData.email || '',
        sub: userData.id,
        email_verified: !!userData.email_confirmed_at,
        user_metadata: userData.user_metadata || {},
      };
    }
    return null;
  } catch (err: any) {
    logger.error('verifySupabaseToken: Exception during token verification', { error: err.message });
    return null;
  }
}

/**
 * Decodes the Next-Auth session context / token directly from secure request headers
 * to isolate multi-tenant operations.
 */
export function getUserIdFromRequest(req: Request): string | null {
  // Return authenticated userId parsed by requireAuth / requireAuthOrApiKey middleware
  const reqUserId = (req as any).userId || ((req as any).user && (req as any).user.id) || ((req as any).auth && (req as any).auth.userId);
  if (reqUserId) {
    return reqUserId;
  }

  logger.warn('getUserIdFromRequest: Request lacked validated user session context');
  return null;
}
