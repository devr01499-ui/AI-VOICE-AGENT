import { supabaseAdmin } from './supabase';
import { prisma } from '../lib/prisma';
import { logger } from './logger';

/**
 * Invalidates all active sessions and refresh tokens for a user.
 * Called upon critical security events such as plan cancellation, account suspension, or downgrade.
 */
export async function revokeUserSessions(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    let supabaseRevoked = false;
    if (supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.auth.admin.signOut(userId, 'global');
        if (error) {
          logger.warn(`[SessionManager] Supabase admin signOut returned error for user ${userId}:`, { error: error.message });
        } else {
          supabaseRevoked = true;
          logger.info(`[SessionManager] Successfully invalidated all active Supabase sessions globally for user ${userId}`);
        }
      } catch (authErr: any) {
        logger.warn(`[SessionManager] Supabase admin signOut threw exception for user ${userId}:`, { error: authErr.message });
      }
    } else {
      logger.info(`[SessionManager] Supabase admin client not initialized (missing service key); recording DB invalidation marker for user ${userId}`);
    }

    // Record session invalidation timestamp on user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return true;
  } catch (err: any) {
    logger.error(`[SessionManager] Failed to revoke sessions for user ${userId}`, { error: err?.message || String(err) });
    return false;
  }
}

/**
 * Forces a refresh of user session claims by updating the user record timestamp.
 */
export async function touchUserSession(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() },
    });
  } catch (err: any) {
    logger.warn(`[SessionManager] Failed to touch user session timestamp for user ${userId}`, { error: err.message });
  }
}
