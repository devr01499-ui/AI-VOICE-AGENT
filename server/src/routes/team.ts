import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
});

const memberIdSchema = z.object({
  memberId: z.string().uuid(),
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (req.workspaceRole !== 'owner') { res.status(403).json({ success: false, error: 'Only workspace owners can manage teams' }); return; }
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

router.post('/invite', requireAuth, validateBody(inviteSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { email } = req.body;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (req.workspaceRole !== 'owner') { res.status(403).json({ success: false, error: 'Only workspace owners can invite members' }); return; }

    const userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) { res.status(404).json({ success: false, error: 'User not found. They must sign up to Bolna first.' }); return; }
    if (userToInvite.id === ownerId) { res.status(400).json({ success: false, error: 'You cannot invite yourself' }); return; }

    const existing = await prisma.teamMember.findUnique({ where: { ownerId_memberId: { ownerId, memberId: userToInvite.id } } });
    if (existing) { res.status(400).json({ success: false, error: 'User is already a member of this workspace' }); return; }

    const newMember = await prisma.teamMember.create({
      data: { ownerId, memberId: userToInvite.id, role: 'viewer' },
      include: { member: { select: { id: true, email: true, fullName: true, createdAt: true } } }
    });
    res.status(201).json({ success: true, data: newMember });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to invite team member' });
  }
});

router.delete('/:memberId', requireAuth, validateParams(memberIdSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { memberId } = req.params;
    if (!ownerId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    if (req.workspaceRole !== 'owner') { res.status(403).json({ success: false, error: 'Only workspace owners can remove members' }); return; }

    await prisma.teamMember.delete({ where: { ownerId_memberId: { ownerId, memberId: String(memberId) } } });
    res.json({ success: true, message: 'Team member removed' });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'Team member not found' }); return; }
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
});

export default router;
