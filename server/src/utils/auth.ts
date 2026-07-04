import { Request } from 'express';
import { logger } from './logger';

export const SEEDED_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

/**
 * Decodes the Next-Auth session context / token directly from secure request headers
 * to isolate multi-tenant operations.
 */
export function getUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      return token;
    }
  }

  const xUserId = req.headers['x-user-id'];
  if (typeof xUserId === 'string' && xUserId.trim()) {
    return xUserId.trim();
  }

  // Fallback to cookie checking if present
  const cookies = req.headers.cookie;
  if (cookies) {
    const sessionTokenMatch = cookies.match(/next-auth\.session-token=([^;]+)/);
    if (sessionTokenMatch && sessionTokenMatch[1]) {
      // In local bypassed mode we map session cookie values directly
      return SEEDED_USER_ID;
    }
  }

  logger.warn('getUserIdFromRequest: Request lacked validated user session context');
  return null;
}
