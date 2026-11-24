import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { logAuditEvent } from '../utils/auditLogger';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';

const router = Router();

const inviteSchema = z.object({
  // Trimmed and lower-cased before validation (audit #50).
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.string().email()),
  role: z.enum(['admin', 'developer', 'analyst', 'viewer']).optional().default('viewer'),
});

const memberIdSchema = z.object({
  memberId: z.guid(),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'developer', 'analyst', 'viewer']),
});

function canManageTeam(req: AuthenticatedRequest): boolean {
  const role = req.workspaceRole || 'admin';
  return role === 'admin' || role === 'owner' || req.effectiveWorkspaceId === req.userId;
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const members = await prisma.teamMember.findMany({
      where: { ownerId },
      include: {
        member: { select: { id: true, email: true, fullName: true, createdAt: true } }
      }
    });
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve team members' });
  }
});

router.post('/invite', requireAuth, sensitiveOperationsLimiter, validateBody(inviteSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    const { email, role } = req.body;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (!canManageTeam(req)) { res.status(403).json({ success: false, error: 'Only workspace admins can invite members' }); return; }

    // Emails are matched trimmed and case-insensitively (audit #50: 'Asha@Example.com' was 'not found').
    const cleanEmail = String(email || '').trim().toLowerCase();
    const userToInvite = await prisma.user.findFirst({ where: { email: { equals: cleanEmail, mode: 'insensitive' } } });
    if (!userToInvite) { res.status(404).json({ success: false, error: 'User not found. They must sign up to Claritiy Voice first.' }); return; }
    if (userToInvite.id === ownerId) { res.status(400).json({ success: false, error: 'You cannot invite yourself' }); return; }

    // One workspace per person (audit #49): joining a team switches the person's dashboard to that
    // workspace, so someone who already belongs to another team, or runs their own workspace (a paid
    // plan, their own agents, numbers or members), cannot be pulled in and lose access to their own.
    const otherTeam = await prisma.teamMember.findFirst({ where: { memberId: userToInvite.id, NOT: { ownerId } }, select: { id: true } });
    if (otherTeam) { res.status(409).json({ success: false, code: 'ALREADY_IN_TEAM', error: 'This person already belongs to another workspace.' }); return; }
    const [ownAgents, ownNumbers, ownMembers] = await Promise.all([
      prisma.agent.count({ where: { userId: userToInvite.id } }),
      prisma.phoneNumber.count({ where: { userId: userToInvite.id } }),
      prisma.teamMember.count({ where: { ownerId: userToInvite.id } }),
    ]);
    const ownsPaidPlan = !['free', '', 'trial'].includes(String(userToInvite.accountType || 'free').toLowerCase());
    if (ownAgents > 0 || ownNumbers > 0 || ownMembers > 0 || ownsPaidPlan) {
      res.status(409).json({ success: false, code: 'HAS_OWN_WORKSPACE', error: 'This person already runs their own workspace, so they cannot join yours. Ask them to use a different email for your team.' });
      return;
    }

    const existing = await prisma.teamMember.findUnique({ where: { ownerId_memberId: { ownerId, memberId: userToInvite.id } } });
    if (existing) { res.status(400).json({ success: false, error: 'User is already a member of this workspace' }); return; }

    const assignedRole = role && ['admin', 'developer', 'analyst', 'viewer'].includes(role) ? role : 'viewer';

    const newMember = await prisma.teamMember.create({
      data: { ownerId, memberId: userToInvite.id, role: assignedRole },
      include: { member: { select: { id: true, email: true, fullName: true, createdAt: true } } }
    });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'team.member.invited',
      targetId: userToInvite.id,
      metadata: { email: cleanEmail, role: assignedRole }
    });

    res.status(201).json({ success: true, data: newMember });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to invite team member' });
  }
});

router.put('/:memberId/role', requireAuth, sensitiveOperationsLimiter, validateParams(memberIdSchema), validateBody(updateRoleSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    const { memberId } = req.params;
    const { role } = req.body;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (!canManageTeam(req)) { res.status(403).json({ success: false, error: 'Only workspace admins can update member roles' }); return; }

    const updated = await prisma.teamMember.update({
      where: { ownerId_memberId: { ownerId, memberId: String(memberId) } },
      data: { role },
      include: { member: { select: { id: true, email: true, fullName: true, createdAt: true } } }
    });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'team.role.updated',
      targetId: String(memberId),
      metadata: { role }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'Team member not found' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update team member role' });
  }
});

router.delete('/:memberId', requireAuth, sensitiveOperationsLimiter, validateParams(memberIdSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.effectiveWorkspaceId || req.userId;
    const { memberId } = req.params;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (!canManageTeam(req)) { res.status(403).json({ success: false, error: 'Only workspace admins can remove members' }); return; }

    await prisma.teamMember.delete({ where: { ownerId_memberId: { ownerId, memberId: String(memberId) } } });

    logAuditEvent({
      workspaceOwnerId: ownerId,
      actorUserId: req.userId!,
      action: 'team.member.removed',
      targetId: String(memberId)
    });

    res.json({ success: true, message: 'Team member removed' });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'Team member not found' }); return; }
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
});

export default router;
