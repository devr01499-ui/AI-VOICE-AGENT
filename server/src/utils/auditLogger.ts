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
 * Recursively redacts sensitive credentials, tokens, passwords, and secrets
 * from audit log metadata payloads to prevent leakage.
 */
export function sanitizeAuditMetadata(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeAuditMetadata);
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('auth_key')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeAuditMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
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

    const sanitizedMetadata = metadata ? sanitizeAuditMetadata(metadata) : undefined;

    await prisma.auditLog.create({
      data: {
        workspaceOwnerId,
        actorUserId,
        action,
        targetId: targetId || null,
        metadata: sanitizedMetadata as any,
      },
    });
    logger.info('[AuditLog] Audit event recorded', { action, workspaceOwnerId, actorUserId, targetId });
  } catch (error) {
    logger.error('[AuditLog] Failed to log audit event', { error: String(error), action: params?.action, workspaceOwnerId: params?.workspaceOwnerId });
  }
}
