import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { ADMIN_EMAIL } from '../config/constants';

/**
 * Enforces that an authenticated user possesses an active paid plan or trial credits
 * before initiating metered or provider-cost operations (such as KYC verification or number provisioning).
 * Admin bypass is honored.
 */
export async function requireActivePlan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.effectiveWorkspaceId || req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing user authentication context' });
      return;
    }

    const user = req.user || (await prisma.user.findUnique({ where: { id: userId } }));
    if (!user || (user.email !== ADMIN_EMAIL && (user.callingBalanceMinutes ?? 0) <= 0)) {
      res.status(403).json({
        success: false,
        error: 'Active plan required: Please upgrade to continue. You must purchase a Trial Plan or Subscription to proceed with KYC compliance or number management.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
