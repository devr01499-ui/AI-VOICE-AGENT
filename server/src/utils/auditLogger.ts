import { prisma } from '../lib/prisma';
import { logger } from './logger';

export interface AuditEventParams {
  workspaceOwnerId: string;
  actorUserId: string;
  action: string;
  targetId?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Persists an audit log entry for high-value workspace operations.
 * Non-blocking, fails safely with logging without interrupting core flow.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const { workspaceOwnerId, actorUserId, action, targetId, metadata } = params;
    if (!workspaceOwnerId || !actorUserId || !action) {
      logger.warn('[AuditLog] Missing required parameters for audit log event', { ...params });
      return;
    }

    await prisma.auditLog.create({
      data: {
        workspaceOwnerId,
        actorUserId,
        action,
        targetId: targetId || null,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
    logger.info('[AuditLog] Audit event recorded', { action, workspaceOwnerId, actorUserId, targetId });
  } catch (error) {
    logger.error('[AuditLog] Failed to log audit event', { error: String(error), action: params?.action, workspaceOwnerId: params?.workspaceOwnerId });
  }
}
