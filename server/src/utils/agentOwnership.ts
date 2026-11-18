import { prisma } from '../lib/prisma';
import { logger } from './logger';

/**
 * Tenant isolation for agent references that arrive in request bodies (Phase 12 IDOR sweep).
 *
 * Returns `agentId` only when that agent belongs to `userId`; otherwise null. Used where a number is
 * provisioned after payment: refusing the purchase at that point would strand a paid order, so a
 * foreign or unknown agent id is dropped (the number is created unassigned and the customer picks
 * an agent in Calling Configuration, which checks ownership) and the attempt is logged.
 */
export async function ownedAgentIdOrNull(userId: string, agentId: unknown): Promise<string | null> {
  if (typeof agentId !== 'string' || agentId.trim() === '') return null;
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId }, select: { id: true } });
  if (!agent) {
    logger.warn('[Security] Ignored an agent id that does not belong to the requesting user', { userId, agentId });
    return null;
  }
  return agent.id;
}
