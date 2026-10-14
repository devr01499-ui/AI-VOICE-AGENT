import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { ADMIN_EMAIL } from '../config/constants';

export const PAID_ACCOUNT_TYPES = [
  'developer',
  'professional',
  'enterprise',
  'growth',
  'scale',
  'admin',
];

/**
 * Calculates the user's effective remaining calling duration in seconds.
 * Primary source of truth: minutesRemainingSeconds. Fallback: callingBalanceMinutes * 60.
 */
export function getEffectiveRemainingSeconds(user: {
  minutesRemainingSeconds?: number | null;
  callingBalanceMinutes?: number | null;
}): number {
  if (!user) return 0;
  if (typeof user.minutesRemainingSeconds === 'number' && user.minutesRemainingSeconds > 0) {
    return user.minutesRemainingSeconds;
  }
  if (typeof user.callingBalanceMinutes === 'number' && user.callingBalanceMinutes > 0) {
    return user.callingBalanceMinutes * 60;
  }
  return 0;
}

/**
 * Evaluates whether a user account holds active entitlement (paid tier, remaining minutes, or admin).
 */
export function isUserEntitled(user: {
  accountType?: string | null;
  email?: string | null;
  callingBalanceMinutes?: number | null;
  minutesRemainingSeconds?: number | null;
  accountStatus?: string | null;
}): boolean {
  if (!user) return false;
  if (user.accountStatus === 'suspended') return false;
  if (user.email === ADMIN_EMAIL || user.accountType?.toLowerCase() === 'admin') return true;

  const type = user.accountType?.toLowerCase() || '';
  if (PAID_ACCOUNT_TYPES.includes(type) && type !== 'free') {
    return true;
  }

  return getEffectiveRemainingSeconds(user) > 0;
}

/**
 * Enforces that an authenticated user possesses an active paid plan or trial credits
 * before initiating metered or provider-cost operations (such as KYC verification or number provisioning).
 */
export async function requireActivePlan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.effectiveWorkspaceId || req.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing user authentication context' });
      return;
    }

    const user = req.user || (await prisma.user.findUnique({ where: { id: userId } }));
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (!isUserEntitled(user)) {
      res.status(403).json({
        success: false,
        code: 'ACTIVE_PLAN_REQUIRED',
        error: 'Active plan required: Please upgrade to continue. You must purchase a Trial Plan or Subscription to proceed with KYC compliance or number management.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces that a user has positive calling balance remaining before placing an outbound call.
 */
export async function requireCallingMinutes(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.effectiveWorkspaceId || req.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing user authentication context' });
      return;
    }

    const user = req.user || (await prisma.user.findUnique({ where: { id: userId } }));
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.accountStatus === 'suspended') {
      res.status(403).json({ success: false, code: 'ACCOUNT_SUSPENDED', error: `Account suspended: ${user.suspendedReason || 'Administrative hold'}` });
      return;
    }

    if (user.accountStatus === 'restricted') {
      res.status(403).json({ success: false, code: 'ACCOUNT_RESTRICTED', error: 'Account restricted: Outbound calls are temporarily disabled.' });
      return;
    }

    const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;
    const remainingSeconds = getEffectiveRemainingSeconds(user);

    if (!isAdmin && remainingSeconds <= 0) {
      res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CALLING_MINUTES',
        error: 'Insufficient calling minutes remaining. You have 0 minutes left. Please purchase a plan or top-up your balance.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces agent creation quotas for free-tier users.
 * Free users are capped at 2 agents max. Paid and admin tiers have higher / unlimited quotas.
 */
export async function requireAgentQuota(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.effectiveWorkspaceId || req.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing user authentication context' });
      return;
    }

    const user = req.user || (await prisma.user.findUnique({ where: { id: userId } }));
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;
    if (isAdmin) {
      return next();
    }

    const isPaid = PAID_ACCOUNT_TYPES.includes(user.accountType?.toLowerCase() || '') && user.accountType?.toLowerCase() !== 'free';
    if (isPaid) {
      return next();
    }

    // Free account limits: max 2 agents
    const FREE_AGENT_LIMIT = 2;
    const agentCount = await prisma.agent.count({
      where: {
        userId: userId,
        status: { not: 'archived' },
      },
    });

    if (agentCount >= FREE_AGENT_LIMIT) {
      res.status(403).json({
        success: false,
        code: 'AGENT_QUOTA_EXCEEDED',
        error: `Free tier limit reached: Free accounts may create up to ${FREE_AGENT_LIMIT} agents. Please upgrade your plan to create more agents.`,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces that generative AI or vectorization features (e.g., Knowledge Base upload/scrape,
 * conversational builder, prompt optimizer) require either an active paid subscription,
 * positive calling balance, or a configured Gemini API key (BYOK).
 */
export async function requireActivePlanOrBYOK(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.effectiveWorkspaceId || req.userId || req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing user authentication context' });
      return;
    }

    const user = req.user || (await prisma.user.findUnique({ where: { id: userId } }));
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const isAdmin = user.accountType === 'admin' || user.email === ADMIN_EMAIL;
    if (isAdmin) {
      return next();
    }

    const hasByokKey = Boolean(
      user.geminiApiKey ||
      (typeof req.headers['x-gemini-api-key'] === 'string' && req.headers['x-gemini-api-key'].trim()) ||
      (req.body && typeof req.body.geminiApiKey === 'string' && req.body.geminiApiKey.trim())
    );

    const entitled = isUserEntitled(user);

    if (!entitled && !hasByokKey) {
      res.status(403).json({
        success: false,
        code: 'PLAN_OR_KEY_REQUIRED',
        error: 'This feature requires an active subscription or your own Gemini API key (BYOK). Please upgrade your plan or configure your API key in Settings.',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

