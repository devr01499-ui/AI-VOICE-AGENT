/**
 * reports.ts — Call Results and Reporting REST API Routes
 *
 * Implements Section 4 & M4:
 * - Scoped strictly by effectiveWorkspaceId.
 * - Ownership verification on every ID (returns 404 for other tenant's IDs).
 * - requireEditor for mutations (correction & re-analysis).
 * - Server-side CSV streaming.
 * - Blueprint catalog and individual reader.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { requireEditor } from '../middleware/auth';
import { logAuditEvent } from '../utils/auditLogger';
import { REPORT_BLUEPRINTS } from '../config/reportBlueprints';
import { CallFinalizer } from '../services/CallFinalizer';
import { z } from 'zod';

const router = Router();

// ─────────────────────────────────────────────────────────────
// 1. GET /api/v2/reports — Filterable list with cursor pagination
// ─────────────────────────────────────────────────────────────
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  agentId: z.string().optional(),
  batchId: z.string().optional(),
  resultLabel: z.string().optional(),
  status: z.enum(['completed', 'needs_review', 'failed']).optional(),
  reviewStatus: z.enum(['unreviewed', 'accepted', 'corrected']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const query = listQuerySchema.parse(req.query);

    const where: any = {
      workspaceId,
    };

    if (query.agentId) where.agentId = query.agentId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.resultLabel) where.resultLabel = query.resultLabel;
    if (query.status) where.status = query.status;
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const items = await prisma.callResult.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        call: {
          select: {
            id: true,
            recipientPhoneNumber: true,
            durationSeconds: true,
            status: true,
            recordingUrl: true,
            agent: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > query.limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    res.json({
      success: true,
      data: items,
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 2. GET /api/v2/reports/summary — Analytics aggregates
// ─────────────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;

    const [totalCalls, needsReviewCount, correctedCount, labelGroups] = await Promise.all([
      prisma.callResult.count({ where: { workspaceId } }),
      prisma.callResult.count({ where: { workspaceId, status: 'needs_review' } }),
      prisma.callResult.count({ where: { workspaceId, reviewStatus: 'corrected' } }),
      prisma.callResult.groupBy({
        by: ['resultLabel'],
        where: { workspaceId },
        _count: { resultLabel: true },
      }),
    ]);

    const labelDistribution: Record<string, number> = {};
    for (const group of labelGroups) {
      labelDistribution[group.resultLabel] = group._count.resultLabel;
    }

    res.json({
      success: true,
      summary: {
        totalCalls,
        needsReviewCount,
        correctedCount,
        reviewRate: totalCalls > 0 ? Math.round((needsReviewCount / totalCalls) * 100) : 0,
        correctionRate: totalCalls > 0 ? Math.round((correctedCount / totalCalls) * 100) : 0,
        labelDistribution,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. GET /api/v2/reports/blueprints — Blueprint catalog
// ─────────────────────────────────────────────────────────────
router.get('/blueprints', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    blueprints: Object.values(REPORT_BLUEPRINTS).map(b => ({
      templateId: b.templateId,
      templateName: b.templateName,
      category: b.category,
      version: b.version,
      labelsCount: b.labels.length,
      fieldsCount: b.fields.length,
    })),
  });
});

router.get('/blueprints/:templateId', async (req: Request, res: Response): Promise<void> => {
  const templateId = String(req.params.templateId);
  const bp = REPORT_BLUEPRINTS[templateId];
  if (!bp) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }
  res.json({ success: true, blueprint: bp });
});

// ─────────────────────────────────────────────────────────────
// 4. GET /api/v2/reports/export/csv — Server-side streaming CSV
// ─────────────────────────────────────────────────────────────
router.get('/export/csv', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="claritiy_call_reports_${Date.now()}.csv"`);

    res.write('Call ID,Date,Recipient,Agent,Outcome Label,Score,Confidence,Status,Review Status,Summary\n');

    const results = await prisma.callResult.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: {
        call: {
          select: {
            recipientPhoneNumber: true,
            agent: { select: { name: true } },
          },
        },
      },
    });

    for (const r of results) {
      const callId = r.callId;
      const date = r.createdAt.toISOString();
      const recipient = `"${(r.call?.recipientPhoneNumber || '').replace(/"/g, '""')}"`;
      const agent = `"${(r.call?.agent?.name || '').replace(/"/g, '""')}"`;
      const label = `"${(r.resultLabel || '').replace(/"/g, '""')}"`;
      const score = r.score !== null ? r.score : '';
      const confidence = (r.confidence * 100).toFixed(1) + '%';
      const status = r.status;
      const reviewStatus = r.reviewStatus;
      const summary = `"${(r.summary || '').replace(/"/g, '""')}"`;

      res.write(`${callId},${date},${recipient},${agent},${label},${score},${confidence},${status},${reviewStatus},${summary}\n`);
    }

    res.end();
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 5. GET /api/v2/reports/:callId — Detailed report with segments
// ─────────────────────────────────────────────────────────────
router.get('/:callId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const callId = String(req.params.callId);

    const result = await prisma.callResult.findFirst({
      where: { callId, workspaceId },
      include: {
        call: {
          select: {
            id: true,
            recipientPhoneNumber: true,
            status: true,
            durationSeconds: true,
            recordingUrl: true,
            startTime: true,
            endTime: true,
            agent: { select: { id: true, name: true } },
            transcriptSegments: {
              orderBy: { sequenceNumber: 'asc' },
              select: {
                id: true,
                speaker: true,
                content: true,
                startTime: true,
                endTime: true,
                sequenceNumber: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      res.status(404).json({ success: false, error: 'Call result not found or unauthorized' });
      return;
    }

    res.json({
      success: true,
      report: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 6. POST /api/v2/reports/:callId/correction — Human Editor Correction
// ─────────────────────────────────────────────────────────────
const correctionSchema = z.object({
  correctedLabel: z.string().optional(),
  correctedFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

router.post('/:callId/correction', requireEditor, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const actorUserId = (req as any).userId;
    const callId = String(req.params.callId);
    const body = correctionSchema.parse(req.body);

    const existing = await prisma.callResult.findFirst({
      where: { callId, workspaceId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Call result not found or unauthorized' });
      return;
    }

    const updated = await prisma.callResult.update({
      where: { id: existing.id },
      data: {
        ...(body.correctedLabel ? { resultLabel: body.correctedLabel } : {}),
        ...(body.correctedFields ? { fields: body.correctedFields } : {}),
        reviewStatus: 'corrected',
        status: 'completed',
        correctedBy: actorUserId,
        correctedAt: new Date(),
        correctionNotes: body.notes || 'Corrected via Reports console',
      },
    });

    // Log to Audit Trail
    await logAuditEvent({
      workspaceOwnerId: workspaceId,
      actorUserId,
      action: 'CALL_REPORT_CORRECTED',
      targetId: existing.id,
      metadata: {
        callId,
        previousLabel: existing.resultLabel,
        newLabel: body.correctedLabel || existing.resultLabel,
        notes: body.notes,
      },
    });

    res.json({
      success: true,
      report: updated,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 7. POST /api/v2/reports/:callId/reanalyze — Trigger Re-analysis
// ─────────────────────────────────────────────────────────────
router.post('/:callId/reanalyze', requireEditor, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const actorUserId = (req as any).userId;
    const callId = String(req.params.callId);

    const call = await prisma.call.findFirst({
      where: { id: callId, userId: workspaceId },
    });

    if (!call) {
      res.status(404).json({ success: false, error: 'Call not found or unauthorized' });
      return;
    }

    // Reset or enqueue new job in analysis_jobs
    await prisma.$executeRawUnsafe(
      `INSERT INTO "analysis_jobs" (
        "id", "call_id", "workspace_id", "agent_id", "status", "attempts", "max_attempts", "next_run_at", "created_at", "updated_at"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'pending', 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("call_id") DO UPDATE
      SET status = 'pending', attempts = 0, next_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      call.id,
      workspaceId,
      call.agentId
    );

    await logAuditEvent({
      workspaceOwnerId: workspaceId,
      actorUserId,
      action: 'CALL_REPORT_REANALYSIS_REQUESTED',
      targetId: call.id,
      metadata: { callId },
    });

    res.json({
      success: true,
      message: 'Call analysis job queued for processing',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
