/**
 * Claritiy Voice Admin Console — Role-Based Cap Enforcement
 * Reads caps from AdminSetting table; falls back to hardcoded defaults.
 * Defaults per Founder Decision #3:
 *   Owner: unlimited | Admin: 500/5000/30% | Sales: 100/500/15% | Support: 50/200/0% | Finance: none
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface RoleCaps {
  maxMinutesPerGrant: number;     // Max minutes per single grant action
  maxMinutesPerDay: number;       // Max total minutes grantable per day
  maxDiscountPercent: number;     // Max discount allowed when creating custom plans
  canGrant: boolean;              // Whether the role can grant minutes at all
  canDeduct: boolean;             // Whether the role can deduct minutes
}

const DEFAULT_CAPS: Record<string, RoleCaps> = {
  owner:   { maxMinutesPerGrant: Infinity, maxMinutesPerDay: Infinity, maxDiscountPercent: 100, canGrant: true,  canDeduct: true },
  admin:   { maxMinutesPerGrant: 500,      maxMinutesPerDay: 5000,     maxDiscountPercent: 30,  canGrant: true,  canDeduct: true },
  sales:   { maxMinutesPerGrant: 100,      maxMinutesPerDay: 500,      maxDiscountPercent: 15,  canGrant: true,  canDeduct: false },
  support: { maxMinutesPerGrant: 50,       maxMinutesPerDay: 200,      maxDiscountPercent: 0,   canGrant: true,  canDeduct: false },
  finance: { maxMinutesPerGrant: 0,        maxMinutesPerDay: 0,        maxDiscountPercent: 0,   canGrant: false, canDeduct: false },
};

/**
 * Retrieves the role caps for a given staff role.
 * First attempts to read from AdminSetting (key: `caps_<role>`); falls back to defaults.
 */
export async function getRoleCaps(role: string): Promise<RoleCaps> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: `caps_${role}` },
    });
    if (setting?.value && typeof setting.value === 'object') {
      const v = setting.value as Record<string, any>;
      return {
        maxMinutesPerGrant: v.maxMinutesPerGrant ?? DEFAULT_CAPS[role]?.maxMinutesPerGrant ?? 0,
        maxMinutesPerDay: v.maxMinutesPerDay ?? DEFAULT_CAPS[role]?.maxMinutesPerDay ?? 0,
        maxDiscountPercent: v.maxDiscountPercent ?? DEFAULT_CAPS[role]?.maxDiscountPercent ?? 0,
        canGrant: v.canGrant ?? DEFAULT_CAPS[role]?.canGrant ?? false,
        canDeduct: v.canDeduct ?? DEFAULT_CAPS[role]?.canDeduct ?? false,
      };
    }
  } catch (err) {
    logger.warn('[CAP_ENFORCEMENT] Failed to read AdminSetting caps, using defaults', { role, error: String(err) });
  }
  return DEFAULT_CAPS[role] || DEFAULT_CAPS.finance;
}

/**
 * Checks how many minutes the staff member has already granted today.
 */
export async function getGrantedTodayMinutes(staffId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await prisma.minutesLedger.aggregate({
    where: {
      actorId: staffId,
      actorType: 'staff',
      reason: 'admin_grant',
      createdAt: { gte: todayStart },
      deltaSeconds: { gt: 0 },
    },
    _sum: { deltaSeconds: true },
  });

  return Math.round((result._sum.deltaSeconds || 0) / 60);
}

/**
 * Validates whether a minutes grant is within the staff member's role caps.
 * Returns null if valid, or an error message string if over cap.
 */
export async function validateGrantCap(
  role: string,
  staffId: string,
  requestedMinutes: number
): Promise<string | null> {
  const caps = await getRoleCaps(role);

  if (!caps.canGrant) {
    return `Your role (${role}) does not have permission to grant minutes.`;
  }

  if (requestedMinutes > caps.maxMinutesPerGrant && caps.maxMinutesPerGrant !== Infinity) {
    return `Grant of ${requestedMinutes} minutes exceeds your per-action cap of ${caps.maxMinutesPerGrant} minutes. Please ask an owner.`;
  }

  const grantedToday = await getGrantedTodayMinutes(staffId);
  if (caps.maxMinutesPerDay !== Infinity && (grantedToday + requestedMinutes) > caps.maxMinutesPerDay) {
    const remaining = Math.max(0, caps.maxMinutesPerDay - grantedToday);
    return `Grant would exceed your daily cap of ${caps.maxMinutesPerDay} minutes (${grantedToday} already granted today, ${remaining} remaining). Please ask an owner.`;
  }

  return null;
}

/**
 * Validates whether a custom plan discount percentage is within the staff member's role cap.
 */
export async function validateDiscountCap(
  role: string,
  requestedDiscountPercent: number
): Promise<string | null> {
  const caps = await getRoleCaps(role);
  if (requestedDiscountPercent > caps.maxDiscountPercent) {
    return `Discount of ${requestedDiscountPercent}% exceeds your role cap of ${caps.maxDiscountPercent}%. Please ask an owner or administrator.`;
  }
  return null;
}

export { DEFAULT_CAPS };
