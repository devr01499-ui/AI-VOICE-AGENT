import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v2/audit-logs
 * Read-only endpoint for workspace audit logs (Admin-only).
 * Supports filtering by action type, startDate, and endDate.
 */
router.get(
  '/',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const ownerId = req.effectiveWorkspaceId || req.userId;
      if (!ownerId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { action, startDate, endDate, limit = '50', offset = '0' } = req.query;

      const whereClause: any = {
        workspaceOwnerId: ownerId,
      };

      if (action && typeof action === 'string' && action.trim() !== '') {
        whereClause.action = { contains: action.trim(), mode: 'insensitive' };
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate && typeof startDate === 'string') {
          whereClause.createdAt.gte = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
          whereClause.createdAt.lte = new Date(endDate);
        }
      }

      const take = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
      const skip = Math.max(parseInt(String(offset), 10) || 0, 0);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          total,
          limit: take,
          offset: skip,
        },
      });
    } catch (error) {
      logger.error('[AuditLogRoute] Failed to fetch audit logs', { error: String(error) });
      res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
    }
  }
);

export default router;
