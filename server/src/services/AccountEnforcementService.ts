import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { StaffContext } from '../middleware/requireStaff';
import { withAudit } from '../admin/audit';

export type SuspensionCategory =
  | 'illegal_activity'
  | 'telecom_abuse'
  | 'payment_fraud'
  | 'non_compliance'
  | 'suspicious_traffic'
  | 'requested_by_user'
  | 'other';

export interface SuspendAccountInput {
  userId: string;
  category: SuspensionCategory;
  details: string;
  staff: StaffContext;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export interface RestoreAccountInput {
  userId: string;
  reason: string;
  staff: StaffContext;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export class AccountEnforcementService {
  /**
   * Suspends a customer account across all platform dimensions atomically with audit logging.
   */
  static async suspendAccount(input: SuspendAccountInput) {
    const { userId, category, details, staff, requestId, ip, userAgent } = input;
    const fullReason = `[${category.toUpperCase()}] ${details.trim()}`;

    return await withAudit(
      {
        staff,
        action: 'customer:suspend',
        targetType: 'User',
        targetId: userId,
        customerId: userId,
        reason: fullReason,
        isCustomerVisible: true,
        customerActionDescription: 'Account suspended by Claritiy Support',
        requestId,
        ip,
        userAgent,
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error(`User ${userId} not found.`);

        const before = {
          accountStatus: user.accountStatus,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
        };

        // 1. Update User Status
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            accountStatus: 'suspended',
            suspendedAt: new Date(),
            suspendedReason: fullReason,
            suspendedByStaffId: staff.id,
          },
        });

        // 2. Pause running batches
        await tx.batch.updateMany({
          where: { userId, status: 'processing' },
          data: { status: 'paused' },
        });

        // 3. Deactivate API Keys
        await tx.apiKey.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });

        const after = {
          accountStatus: updatedUser.accountStatus,
          suspendedAt: updatedUser.suspendedAt,
          suspendedReason: updatedUser.suspendedReason,
          suspendedByStaffId: updatedUser.suspendedByStaffId,
        };

        logger.info('[ACCOUNT_ENFORCEMENT] Account suspended successfully', {
          userId,
          category,
          staffId: staff.id,
        });

        return { result: updatedUser, before, after };
      }
    );
  }

  /**
   * Restricts a customer account (view-only; cannot place calls, buy plans, or launch batches).
   */
  static async restrictAccount(input: {
    userId: string;
    reason: string;
    staff: StaffContext;
    requestId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const { userId, reason, staff, requestId, ip, userAgent } = input;

    return await withAudit(
      {
        staff,
        action: 'customer:restrict',
        targetType: 'User',
        targetId: userId,
        customerId: userId,
        reason: reason.trim(),
        isCustomerVisible: true,
        customerActionDescription: 'Account placed in restricted mode by Claritiy Support',
        requestId,
        ip,
        userAgent,
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error(`User ${userId} not found.`);

        const before = { accountStatus: user.accountStatus };

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            accountStatus: 'restricted',
          },
        });

        const after = { accountStatus: updatedUser.accountStatus };
        return { result: updatedUser, before, after };
      }
    );
  }

  /**
   * Restores a customer account to fully active state.
   */
  static async restoreAccount(input: RestoreAccountInput) {
    const { userId, reason, staff, requestId, ip, userAgent } = input;

    return await withAudit(
      {
        staff,
        action: 'customer:restore',
        targetType: 'User',
        targetId: userId,
        customerId: userId,
        reason: reason.trim(),
        isCustomerVisible: true,
        customerActionDescription: 'Account restored to active status by Claritiy Support',
        requestId,
        ip,
        userAgent,
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error(`User ${userId} not found.`);

        const before = {
          accountStatus: user.accountStatus,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
        };

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            accountStatus: 'active',
            suspendedAt: null,
            suspendedReason: null,
            suspendedByStaffId: null,
          },
        });

        // Reactivate API keys
        await tx.apiKey.updateMany({
          where: { userId },
          data: { isActive: true },
        });

        const after = {
          accountStatus: updatedUser.accountStatus,
          suspendedAt: null,
          suspendedReason: null,
        };

        logger.info('[ACCOUNT_ENFORCEMENT] Account restored to active status', {
          userId,
          staffId: staff.id,
        });

        return { result: updatedUser, before, after };
      }
    );
  }
}
