import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StaffContext } from '../middleware/requireStaff';
import { logger } from '../utils/logger';

export interface AuditContext {
  staff: StaffContext;
  action: string;
  targetType: string;
  targetId: string;
  customerId?: string | null;
  reason: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  isCustomerVisible?: boolean;
  customerActionDescription?: string;
}

/**
 * Executes a mutating database operation atomically alongside an immutable AdminAuditLog entry.
 * If the action is customer-visible (e.g. minutes added, plan changed, account suspended/restored),
 * also creates an entry in the customer AuditLog with the actor masked as "Claritiy Support".
 */
export async function withAudit<T>(
  ctx: AuditContext,
  execute: (tx: Prisma.TransactionClient) => Promise<{ result: T; before?: any; after?: any }>
): Promise<T> {
  if (!ctx.reason || !ctx.reason.trim()) {
    throw new Error('AUDIT_ERROR: A valid reason is strictly mandatory for every admin modification.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Run the operational mutation
    const { result, before, after } = await execute(tx);

    // 2. Insert immutable AdminAuditLog
    await tx.adminAuditLog.create({
      data: {
        staffId: ctx.staff.id,
        staffEmail: ctx.staff.email,
        staffRole: ctx.staff.role,
        action: ctx.action,
        targetType: ctx.targetType,
        targetId: ctx.targetId,
        customerId: ctx.customerId || null,
        reason: ctx.reason.trim(),
        before: before !== undefined ? (before as Prisma.InputJsonValue) : Prisma.JsonNull,
        after: after !== undefined ? (after as Prisma.InputJsonValue) : Prisma.JsonNull,
        ip: ctx.ip || null,
        userAgent: ctx.userAgent || null,
        requestId: ctx.requestId || null,
      },
    });

    // 3. Customer-visible audit entry (anonymized actor to "Claritiy Support")
    if (ctx.isCustomerVisible && ctx.customerId) {
      await tx.auditLog.create({
        data: {
          workspaceOwnerId: ctx.customerId,
          actorUserId: 'Claritiy Support',
          action: ctx.customerActionDescription || ctx.action,
          targetId: ctx.targetId,
          metadata: {
            actor: 'Claritiy Support',
            action: ctx.action,
            targetType: ctx.targetType,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return result;
  });
}

/**
 * Logs sensitive administrative read operations (e.g., listening to recordings, reading full transcripts,
 * unmasking phone numbers, or exporting financial CSVs).
 */
export async function logAdminRead(ctx: {
  staff: StaffContext;
  action: string;
  targetType: string;
  targetId: string;
  customerId?: string | null;
  reason: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        staffId: ctx.staff.id,
        staffEmail: ctx.staff.email,
        staffRole: ctx.staff.role,
        action: ctx.action,
        targetType: ctx.targetType,
        targetId: ctx.targetId,
        customerId: ctx.customerId || null,
        reason: ctx.reason.trim() || 'Sensitive read access',
        ip: ctx.ip || null,
        userAgent: ctx.userAgent || null,
        requestId: ctx.requestId || null,
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_AUDIT_READ_ERROR] Failed to record sensitive read audit log', {
      error: err.message,
      staffId: ctx.staff.id,
      action: ctx.action,
    });
  }
}
