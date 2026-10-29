/**
 * reports.ts — Authoritative Call Results and Reporting REST API Routes
 *
 * Implements Section 4 & M4:
 * - Scoped strictly by effectiveWorkspaceId.
 * - Ownership verification on every ID (returns 404 for other tenant's IDs).
 * - requireEditor for mutations (correction & re-analysis).
 * - Server-side CSV streaming with UTF-8 BOM and spreadsheet formula injection sanitization.
 * - Blueprint catalog and individual reader.
 * - Unified response contract aligning frontend and backend.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { requireEditor } from '../middleware/auth';
import { logAuditEvent } from '../utils/auditLogger';
import { REPORT_BLUEPRINTS, ReportBlueprint } from '../config/reportBlueprints';
import { calculateRubricScore } from '../utils/rubricScorer';
import { AnalysisService } from '../services/AnalysisService';
import { z } from 'zod';

const router = Router();

/**
 * Neutralizes spreadsheet formula injection by prepending a single quote
 * if a string cell starts with =, +, -, @, tab, or carriage return.
 */
function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

// ─────────────────────────────────────────────────────────────
// 1. GET /api/v2/reports — Filterable list with cursor pagination
// ─────────────────────────────────────────────────────────────
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  agentId: z.string().optional(),
  batchId: z.string().optional(),
  resultLabel: z.string().optional(),
  label: z.string().optional(),
  status: z.string().optional(),
  reviewStatus: z.string().optional(),
  reviewNeeded: z.union([z.boolean(), z.string().transform(v => v === 'true' || v === '1')]).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
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

    if (query.agentId && query.agentId !== 'all') where.agentId = query.agentId;
    if (query.batchId && query.batchId !== 'all') where.batchId = query.batchId;

    const effectiveLabel = query.label || query.resultLabel;
    if (effectiveLabel && effectiveLabel !== 'all') {
      where.resultLabel = effectiveLabel;
    }

    if (query.reviewNeeded === true) {
      where.status = 'needs_review';
    } else if (query.reviewStatus && query.reviewStatus !== 'all') {
      where.reviewStatus = query.reviewStatus;
    }

    if (query.status && query.status !== 'all') {
      if (['completed', 'needs_review', 'failed'].includes(query.status)) {
        where.status = query.status;
      } else if (query.status === 'pending' || query.status === 'processing') {
        // Pending or processing jobs do not yet have completed call_results rows
        res.json({
          success: true,
          data: {
            items: [],
            nextCursor: null,
            hasMore: false,
            totalCount: 0,
          },
          items: [],
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
        });
        return;
      }
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const dt = new Date(query.dateTo);
        if (query.dateTo.length <= 10) {
          dt.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = dt;
      }
    }

    if (query.direction) {
      where.call = {
        callDirection: query.direction,
      };
    }

    const [items, totalCount] = await Promise.all([
      prisma.callResult.findMany({
        where,
        take: query.limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          call: {
            select: {
              id: true,
              callDirection: true,
              recipientPhoneNumber: true,
              fromPhoneNumber: true,
              durationSeconds: true,
              status: true,
              recordingUrl: true,
              startTime: true,
              endTime: true,
              agent: {
                select: { id: true, name: true, agentConfig: true },
              },
            },
          },
        },
      }),
      prisma.callResult.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (items.length > query.limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    const formattedItems = items.map((r: any) => {
      const direction = r.call?.callDirection || (r.call?.fromPhoneNumber && !r.call?.recipientPhoneNumber ? 'inbound' : 'outbound');
      const contactNumber = direction === 'inbound' ? (r.call?.fromPhoneNumber || '') : (r.call?.recipientPhoneNumber || '');
      const businessNumber = direction === 'inbound' ? (r.call?.recipientPhoneNumber || '') : (r.call?.fromPhoneNumber || '');
      const blueprintId = r.blueprintVersion || 'tpl-0';
      const bp = REPORT_BLUEPRINTS[blueprintId];
      const blueprintName = bp?.templateName || (r.call?.agent?.name ? `${r.call.agent.name} Blueprint` : 'General Call Analysis');

      return {
        id: r.id,
        callId: r.callId,
        blueprintId,
        blueprintName,
        status: r.status,
        label: r.resultLabel || 'Unclear',
        resultLabel: r.resultLabel,
        score: r.score,
        confidence: r.confidence,
        reviewNeeded: r.status === 'needs_review',
        reviewReason: r.status === 'needs_review' ? (r.summary || 'Flagged for review') : null,
        summary: r.summary,
        fields: (r.fields as Record<string, any>) || {},
        evidenceQuotes: (r.evidence as Record<string, any>) || {},
        hasHumanCorrection: r.reviewStatus === 'corrected',
        reviewStatus: r.reviewStatus,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        call: {
          id: r.call?.id || r.callId,
          recipientPhoneNumber: r.call?.recipientPhoneNumber || '',
          fromPhoneNumber: r.call?.fromPhoneNumber || '',
          direction,
          contactNumber,
          businessNumber,
          status: r.call?.status || r.status,
          durationSeconds: r.call?.durationSeconds || 0,
          recordingUrl: r.call?.recordingUrl || null,
          startedAt: r.call?.startTime ? r.call.startTime.toISOString() : undefined,
          endedAt: r.call?.endTime ? r.call.endTime.toISOString() : undefined,
          agent: r.call?.agent ? { id: r.call.agent.id, name: r.call.agent.name } : null,
        },
      };
    });

    const responsePayload = {
      items: formattedItems,
      nextCursor,
      hasMore: !!nextCursor,
      totalCount,
    };

    res.json({
      success: true,
      data: responsePayload,
      ...responsePayload,
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
    const query = req.query as any;

    const where: any = { workspaceId };
    const callWhere: any = { userId: workspaceId };

    if (query.agentId && query.agentId !== 'all') {
      where.agentId = query.agentId;
      callWhere.agentId = query.agentId;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      callWhere.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
        callWhere.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const dt = new Date(query.dateTo);
        if (query.dateTo.length <= 10) dt.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = dt;
        callWhere.createdAt.lte = dt;
      }
    }

    const [
      totalCalls,
      analyzedCalls,
      pendingAnalysis,
      failedJobs,
      failedResults,
      needsReviewCount,
      correctedCount,
      labelGroups,
      aggregates,
    ] = await Promise.all([
      prisma.call.count({ where: callWhere }),
      prisma.callResult.count({
        where: {
          ...where,
          status: { in: ['completed', 'needs_review'] },
        },
      }),
      prisma.analysisJob.count({
        where: {
          workspaceId,
          status: { in: ['pending', 'processing'] },
        },
      }),
      prisma.analysisJob.count({
        where: {
          workspaceId,
          status: 'failed',
        },
      }),
      prisma.callResult.count({
        where: {
          ...where,
          status: 'failed',
        },
      }),
      prisma.callResult.count({
        where: {
          ...where,
          status: 'needs_review',
        },
      }),
      prisma.callResult.count({
        where: {
          ...where,
          reviewStatus: 'corrected',
        },
      }),
      prisma.callResult.groupBy({
        by: ['resultLabel'],
        where,
        _count: { resultLabel: true },
      }),
      prisma.callResult.aggregate({
        where: {
          ...where,
          score: { not: null },
        },
        _avg: {
          score: true,
          confidence: true,
        },
      }),
    ]);

    const labelDistribution: Record<string, number> = {};
    for (const group of labelGroups) {
      if (group.resultLabel) {
        labelDistribution[group.resultLabel] = group._count.resultLabel;
      }
    }

    const failedAnalysis = failedJobs + failedResults;
    const avgScore = aggregates._avg.score !== null ? Math.round(aggregates._avg.score) : 0;
    const avgConfidence = aggregates._avg.confidence !== null ? Math.round(aggregates._avg.confidence * 100) / 100 : 0.85;
    const humanCorrectionRate = analyzedCalls > 0 ? Math.round((correctedCount / analyzedCalls) * 100) : 0;

    const summaryPayload = {
      totalCalls,
      analyzedCalls,
      pendingAnalysis,
      failedAnalysis,
      needsReviewCount,
      avgScore,
      humanCorrectionRate,
      avgConfidence,
      labelDistribution,
    };

    res.json({
      success: true,
      data: summaryPayload,
      summary: summaryPayload,
      ...summaryPayload,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. GET /api/v2/reports/blueprints — Blueprint catalog
// ─────────────────────────────────────────────────────────────
router.get('/blueprints', async (_req: Request, res: Response): Promise<void> => {
  const blueprintList = Object.values(REPORT_BLUEPRINTS).map(b => ({
    id: b.templateId,
    name: b.templateName,
    industry: b.category,
    description: (b as any).description || `${b.templateName} (${b.category})`,
    labels: b.labels.map(l => l.label),
    fieldCount: b.fields.length,
    version: b.version,
    fields: b.fields,
  }));

  res.json({
    success: true,
    data: blueprintList,
    blueprints: blueprintList,
  });
});

router.get('/blueprints/:templateId', async (req: Request, res: Response): Promise<void> => {
  const templateId = String(req.params.templateId);
  const bp = REPORT_BLUEPRINTS[templateId];
  if (!bp) {
    res.status(404).json({ success: false, error: 'Blueprint not found' });
    return;
  }
  res.json({
    success: true,
    data: bp,
    blueprint: bp,
  });
});

// ─────────────────────────────────────────────────────────────
// 4. CSV Export Route Handlers (/export/csv and /export.csv)
// ─────────────────────────────────────────────────────────────
const handleCsvExport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const query = req.query as any;

    const where: any = { workspaceId };

    if (query.agentId && query.agentId !== 'all') where.agentId = query.agentId;
    if (query.batchId && query.batchId !== 'all') where.batchId = query.batchId;

    const effectiveLabel = query.label || query.resultLabel;
    if (effectiveLabel && effectiveLabel !== 'all') {
      where.resultLabel = effectiveLabel;
    }

    if (query.reviewNeeded === true || query.reviewNeeded === 'true') {
      where.status = 'needs_review';
    }

    if (query.status && query.status !== 'all') {
      if (['completed', 'needs_review', 'failed'].includes(query.status)) {
        where.status = query.status;
      }
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const dt = new Date(query.dateTo);
        if (query.dateTo.length <= 10) dt.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = dt;
      }
    }

    if (query.direction) {
      where.call = { callDirection: query.direction };
    }

    const results = await prisma.callResult.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2000,
      include: {
        call: {
          select: {
            callDirection: true,
            recipientPhoneNumber: true,
            fromPhoneNumber: true,
            agent: { select: { name: true } },
          },
        },
      },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="claritiy_call_reports_${Date.now()}.csv"`);

    // UTF-8 BOM so Microsoft Excel renders Hindi and Devanagari text correctly without garbling
    res.write('\ufeff');
    res.write('Call ID,Date,Direction,Contact Number,Business Number,Agent,Outcome Label,Score,Confidence,Status,Review Status,Summary\n');

    for (const r of results) {
      const callId = sanitizeCsvCell(r.callId);
      const date = sanitizeCsvCell(r.createdAt.toISOString());
      const direction = r.call?.callDirection || (r.call?.fromPhoneNumber && !r.call?.recipientPhoneNumber ? 'inbound' : 'outbound');
      const contactNumber = direction === 'inbound' ? (r.call?.fromPhoneNumber || '') : (r.call?.recipientPhoneNumber || '');
      const businessNumber = direction === 'inbound' ? (r.call?.recipientPhoneNumber || '') : (r.call?.fromPhoneNumber || '');

      const dirCell = sanitizeCsvCell(direction);
      const contactCell = sanitizeCsvCell(contactNumber);
      const businessCell = sanitizeCsvCell(businessNumber);
      const agent = sanitizeCsvCell(r.call?.agent?.name || '');
      const label = sanitizeCsvCell(r.resultLabel || '');
      const score = r.score !== null ? r.score : '';
      const confidence = sanitizeCsvCell((r.confidence * 100).toFixed(1) + '%');
      const status = sanitizeCsvCell(r.status);
      const reviewStatus = sanitizeCsvCell(r.reviewStatus);
      const summary = sanitizeCsvCell(r.summary || '');

      res.write(`${callId},${date},${dirCell},${contactCell},${businessCell},${agent},${label},${score},${confidence},${status},${reviewStatus},${summary}\n`);
    }

    // Audit log CSV export event
    await logAuditEvent({
      workspaceOwnerId: workspaceId,
      actorUserId: (req as any).userId || workspaceId,
      action: 'CALL_REPORTS_EXPORTED_CSV',
      targetId: workspaceId,
      metadata: {
        rowCount: results.length,
        filters: query,
      },
    }).catch((e) => logger.warn('Failed to audit log CSV export', { error: String(e) }));

    res.end();
  } catch (err) {
    next(err);
  }
};

router.get('/export/csv', handleCsvExport);
router.get('/export.csv', handleCsvExport);

// ─────────────────────────────────────────────────────────────
// 5. GET /api/v2/reports/:callId — Detailed report with transcript
// ─────────────────────────────────────────────────────────────
router.get('/:callId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const callId = String(req.params.callId);

    const [result, job, auditLogs] = await Promise.all([
      prisma.callResult.findFirst({
        where: { callId, workspaceId },
        include: {
          call: {
            select: {
              id: true,
              callDirection: true,
              recipientPhoneNumber: true,
              fromPhoneNumber: true,
              status: true,
              durationSeconds: true,
              recordingUrl: true,
              startTime: true,
              endTime: true,
              agent: { select: { id: true, name: true, agentConfig: true } },
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
      }),
      prisma.analysisJob.findFirst({
        where: { callId },
        select: {
          id: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          targetId: { in: [callId] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          staffId: true,
          staffEmail: true,
          reason: true,
          before: true,
          after: true,
          createdAt: true,
        },
      }),
    ]);

    if (!result) {
      res.status(404).json({ success: false, error: 'Call result not found or unauthorized' });
      return;
    }

    const direction = result.call?.callDirection || (result.call?.fromPhoneNumber && !result.call?.recipientPhoneNumber ? 'inbound' : 'outbound');
    const contactNumber = direction === 'inbound' ? (result.call?.fromPhoneNumber || '') : (result.call?.recipientPhoneNumber || '');
    const businessNumber = direction === 'inbound' ? (result.call?.recipientPhoneNumber || '') : (result.call?.fromPhoneNumber || '');

    const transcript = result.call?.transcriptSegments?.length
      ? result.call.transcriptSegments.map((s: any) => `${s.speaker}: ${s.content}`).join('\n')
      : '';

    const blueprintId = result.blueprintVersion || 'tpl-0';
    const bp = REPORT_BLUEPRINTS[blueprintId];
    const blueprintName = bp?.templateName || (result.call?.agent?.name ? `${result.call.agent.name} Blueprint` : 'General Call Analysis');

    const formattedDetail = {
      id: result.id,
      callId: result.callId,
      blueprintId,
      blueprintName,
      status: result.status,
      label: result.resultLabel || 'Unclear',
      resultLabel: result.resultLabel,
      score: result.score,
      confidence: result.confidence,
      reviewNeeded: result.status === 'needs_review',
      reviewReason: result.status === 'needs_review' ? (result.summary || 'Flagged for review') : null,
      summary: result.summary,
      fields: (result.fields as Record<string, any>) || {},
      evidenceQuotes: (result.evidence as Record<string, any>) || {},
      hasHumanCorrection: result.reviewStatus === 'corrected',
      reviewStatus: result.reviewStatus,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      call: {
        id: result.call?.id || result.callId,
        recipientPhoneNumber: result.call?.recipientPhoneNumber || '',
        fromPhoneNumber: result.call?.fromPhoneNumber || '',
        direction,
        contactNumber,
        businessNumber,
        status: result.call?.status || result.status,
        durationSeconds: result.call?.durationSeconds || 0,
        recordingUrl: result.call?.recordingUrl || null,
        startedAt: result.call?.startTime ? result.call.startTime.toISOString() : undefined,
        endedAt: result.call?.endTime ? result.call.endTime.toISOString() : undefined,
        transcript,
        agent: result.call?.agent ? { id: result.call.agent.id, name: result.call.agent.name } : null,
      },
      job: job ? {
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lastError: job.lastError,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      } : undefined,
      auditLogs: auditLogs.map((a: any) => ({
        id: a.id,
        action: a.action,
        actorUserId: a.staffId || a.staffEmail || 'staff',
        createdAt: a.createdAt.toISOString(),
        metadata: {
          reason: a.reason,
          before: a.before,
          after: a.after,
        },
      })),
    };

    res.json({
      success: true,
      data: formattedDetail,
      report: formattedDetail,
      ...formattedDetail,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 6. POST /:callId/correct and /:callId/correction
// ─────────────────────────────────────────────────────────────
const correctionSchema = z.object({
  label: z.string().optional(),
  correctedLabel: z.string().optional(),
  fields: z.record(z.any()).optional(),
  correctedFields: z.record(z.any()).optional(),
  score: z.number().nullable().optional(),
  notes: z.string().optional(),
});

const handleCorrection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const actorUserId = (req as any).userId;
    const callId = String(req.params.callId);
    const body = correctionSchema.parse(req.body);

    const existing = await prisma.callResult.findFirst({
      where: { callId, workspaceId },
      include: {
        call: {
          select: {
            agent: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Call result not found or unauthorized' });
      return;
    }

    const targetLabel = body.label || body.correctedLabel;
    const incomingFields = body.fields || body.correctedFields || {};

    // Resolve blueprint to validate label and fields
    const blueprint = AnalysisService.resolveBlueprint(existing.call?.agent);

    if (targetLabel) {
      const allowedLabels = blueprint.labels.map(l => l.label);
      if (!allowedLabels.includes(targetLabel)) {
        res.status(400).json({
          success: false,
          error: `Invalid label "${targetLabel}". Label must be one of: ${allowedLabels.join(', ')}`,
        });
        return;
      }
    }

    // Merge incoming fields onto existing fields (never wipe out unmentioned fields)
    const existingFields = (existing.fields as Record<string, any>) || {};
    const mergedFields = { ...existingFields, ...incomingFields };

    // Recompute rubric score deterministically in code
    const rubricResult = calculateRubricScore(blueprint, mergedFields);
    let newScore = rubricResult ? rubricResult.totalScore : existing.score;
    if (body.score !== undefined && body.score !== null) {
      newScore = body.score;
    }

    const updated = await prisma.callResult.update({
      where: { id: existing.id },
      data: {
        ...(targetLabel ? { resultLabel: targetLabel } : {}),
        fields: mergedFields,
        score: newScore,
        reviewStatus: 'corrected',
        status: 'completed',
        correctedBy: actorUserId,
        correctedAt: new Date(),
        correctionNotes: body.notes || 'Corrected via Reports console',
      },
    });

    // Audit log with full before and after state
    await logAuditEvent({
      workspaceOwnerId: workspaceId,
      actorUserId,
      action: 'CALL_REPORT_CORRECTED',
      targetId: callId,
      metadata: {
        callId,
        previousLabel: existing.resultLabel,
        newLabel: targetLabel || existing.resultLabel,
        previousFields: existing.fields,
        newFields: mergedFields,
        previousScore: existing.score,
        newScore,
        notes: body.notes,
      },
    });

    res.json({
      success: true,
      data: updated,
      report: updated,
    });
  } catch (err) {
    next(err);
  }
};

router.post('/:callId/correct', requireEditor, handleCorrection);
router.post('/:callId/correction', requireEditor, handleCorrection);

// ─────────────────────────────────────────────────────────────
// 7. POST /:callId/accept — Accept Report into Verified State
// ─────────────────────────────────────────────────────────────
router.post('/:callId/accept', requireEditor, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const actorUserId = (req as any).userId;
    const callId = String(req.params.callId);

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
        reviewStatus: 'accepted',
        status: 'completed',
        updatedAt: new Date(),
      },
    });

    await logAuditEvent({
      workspaceOwnerId: workspaceId,
      actorUserId,
      action: 'CALL_REPORT_ACCEPTED',
      targetId: callId,
      metadata: { callId, label: existing.resultLabel },
    });

    res.json({
      success: true,
      data: updated,
      report: updated,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 8. POST /:callId/reanalyze — Trigger Re-analysis
// ─────────────────────────────────────────────────────────────
router.post('/:callId/reanalyze', requireEditor, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const actorUserId = (req as any).userId;
    const callId = String(req.params.callId);

    const [call, existingResult, runningJob] = await Promise.all([
      prisma.call.findFirst({
        where: { id: callId, userId: workspaceId },
      }),
      prisma.callResult.findFirst({
        where: { callId, workspaceId },
      }),
      prisma.analysisJob.findFirst({
        where: { callId },
      }),
    ]);

    if (!call) {
      res.status(404).json({ success: false, error: 'Call not found or unauthorized' });
      return;
    }

    // Guard: Prevent double processing if worker is currently running this job
    if (
      runningJob &&
      runningJob.status === 'processing' &&
      runningJob.lockedAt &&
      Date.now() - runningJob.lockedAt.getTime() < 5 * 60 * 1000
    ) {
      res.status(409).json({
        success: false,
        error: 'This call is currently being analyzed by an active worker. Please wait.',
      });
      return;
    }

    // Guard: Require explicit confirmation before overwriting human correction
    if (existingResult && existingResult.reviewStatus === 'corrected' && !req.body.forceDiscardCorrection) {
      res.status(400).json({
        success: false,
        error: 'This call has a verified human correction. Send forceDiscardCorrection: true to re-analyze.',
      });
      return;
    }

    // Reset or enqueue new job in analysis_jobs (only when not actively processing)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "analysis_jobs" (
        "id", "call_id", "workspace_id", "agent_id", "status", "attempts", "max_attempts", "next_run_at", "created_at", "updated_at"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'pending', 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT ("call_id") DO UPDATE
      SET status = 'pending', attempts = 0, locked_at = NULL, locked_by = NULL, next_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE "analysis_jobs".status != 'processing'`,
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
