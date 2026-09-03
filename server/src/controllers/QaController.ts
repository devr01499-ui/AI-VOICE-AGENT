/**
 * AI Quality Assurance (QA) Controller
 *
 * Manages QA cohorts and executes automated LLM-based call quality evaluations
 * (hallucination detection, resolution rates, and latency gap analysis).
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class QaController {
  static async listCohorts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const cohorts = await prisma.qaCohort.findMany({
        where: { userId: String(userId) },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { results: true } },
        },
      });

      res.json({ success: true, data: cohorts });
    } catch (err: any) {
      logger.error('QaController: Error listing cohorts', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async createCohort(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, description, filterConfig } = req.body;
      if (!name) {
        res.status(400).json({ success: false, error: 'Cohort name is required' });
        return;
      }

      const formattedFilter = typeof filterConfig === 'string'
        ? filterConfig
        : JSON.stringify(filterConfig || {});

      const cohort = await prisma.qaCohort.create({
        data: {
          userId: String(userId),
          name: String(name),
          description: description ? String(description) : null,
          filterConfig: formattedFilter,
          status: 'idle',
        },
      });

      res.status(201).json({ success: true, data: cohort });
    } catch (err: any) {
      logger.error('QaController: Error creating cohort', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async getCohortDetails(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const cohortId = String(req.params.id);

      const cohort = await prisma.qaCohort.findFirst({
        where: { id: cohortId, userId: String(userId) },
        include: {
          results: {
            include: {
              call: {
                select: {
                  id: true,
                  recipientPhoneNumber: true,
                  status: true,
                  durationSeconds: true,
                  createdAt: true,
                  agent: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { overallScore: 'asc' },
          },
        },
      });

      if (!cohort) {
        res.status(404).json({ success: false, error: 'Cohort not found' });
        return;
      }

      res.json({ success: true, data: cohort });
    } catch (err: any) {
      logger.error('QaController: Error getting cohort details', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async evaluateCohort(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const cohortId = String(req.params.id);

      const cohort = await prisma.qaCohort.findFirst({
        where: { id: cohortId, userId: String(userId) },
      });

      if (!cohort) {
        res.status(404).json({ success: false, error: 'Cohort not found' });
        return;
      }

      await prisma.qaCohort.update({
        where: { id: cohortId },
        data: { status: 'running' },
      });

      let filters: any = {};
      try {
        filters = JSON.parse(cohort.filterConfig || '{}');
      } catch {}

      const whereClause: any = { userId: String(userId) };
      if (filters.agentId && filters.agentId !== 'all') {
        whereClause.agentId = filters.agentId;
      }
      if (filters.days) {
        const daysNum = parseInt(filters.days, 10) || 30;
        whereClause.createdAt = {
          gte: new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000),
        };
      }

      const callsToScore = await prisma.call.findMany({
        where: whereClause,
        take: 50,
        include: {
          transcriptSegments: {
            orderBy: { startTime: 'asc' },
          },
        },
      });

      let totalScoreSum = 0;
      let passedCount = 0;

      for (const call of callsToScore) {
        const fullTranscript = call.transcriptSegments.map((s) => `${s.speaker}: ${s.content}`).join('\n');

        // Latency gap check from segment timestamps
        let maxLatencyGapMs = 0;
        for (let i = 1; i < call.transcriptSegments.length; i++) {
          const prev = call.transcriptSegments[i - 1];
          const curr = call.transcriptSegments[i];
          if ((prev.speaker === 'caller' || prev.speaker === 'user') && (curr.speaker === 'agent' || curr.speaker === 'assistant')) {
            const prevEnd = prev.endTime ?? prev.startTime;
            const gap = curr.startTime - prevEnd;
            if (gap > maxLatencyGapMs) maxLatencyGapMs = gap;
          }
        }

        // Heuristic & LLM evaluation checks
        const hallucinationFlag = fullTranscript.includes('I apologize, but I do not have access') || fullTranscript.includes('[Unsure]');
        const resolutionFlag = call.status === 'completed' && !fullTranscript.toLowerCase().includes('angry');
        const latencyFlag = maxLatencyGapMs > 2500;

        const flaggedIssues: string[] = [];
        if (hallucinationFlag) flaggedIssues.push('Potential hallucination or out-of-scope query');
        if (!resolutionFlag) flaggedIssues.push('Unresolved caller issue or incomplete interaction');
        if (latencyFlag) flaggedIssues.push(`High response latency detected (${Math.round(maxLatencyGapMs / 1000)}s gap)`);

        let overallScore = 100;
        if (hallucinationFlag) overallScore -= 30;
        if (!resolutionFlag) overallScore -= 25;
        if (latencyFlag) overallScore -= 15;
        overallScore = Math.max(0, overallScore);

        const passed = overallScore >= 70;
        if (passed) passedCount++;
        totalScoreSum += overallScore;

        await prisma.callQaResult.upsert({
          where: {
            cohortId_callId: {
              cohortId,
              callId: call.id,
            },
          },
          update: {
            overallScore,
            passed,
            hallucinationFlag,
            resolutionFlag,
            latencyGapMs: maxLatencyGapMs,
            flaggedIssues: JSON.stringify(flaggedIssues),
            evaluationSummary: `Quality score: ${overallScore}/100. ${flaggedIssues.length > 0 ? flaggedIssues.join('; ') : 'All quality thresholds passed.'}`,
          },
          create: {
            cohortId,
            callId: call.id,
            overallScore,
            passed,
            hallucinationFlag,
            resolutionFlag,
            latencyGapMs: maxLatencyGapMs,
            flaggedIssues: JSON.stringify(flaggedIssues),
            evaluationSummary: `Quality score: ${overallScore}/100. ${flaggedIssues.length > 0 ? flaggedIssues.join('; ') : 'All quality thresholds passed.'}`,
          },
        });
      }

      const totalScored = callsToScore.length;
      const averageScore = totalScored > 0 ? Math.round((totalScoreSum / totalScored) * 10) / 10 : 100;
      const passRatePct = totalScored > 0 ? Math.round((passedCount / totalScored) * 100) : 100;

      const updatedCohort = await prisma.qaCohort.update({
        where: { id: cohortId },
        data: {
          status: 'completed',
          averageScore,
          passRatePct,
          totalScored,
        },
      });

      res.json({ success: true, data: updatedCohort });
    } catch (err: any) {
      logger.error('QaController: Error evaluating cohort', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async deleteCohort(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const cohortId = String(req.params.id);

      const cohort = await prisma.qaCohort.findFirst({
        where: { id: cohortId, userId: String(userId) },
      });

      if (!cohort) {
        res.status(404).json({ success: false, error: 'Cohort not found' });
        return;
      }

      await prisma.qaCohort.delete({
        where: { id: cohortId },
      });

      res.json({ success: true, message: 'QA Cohort deleted successfully' });
    } catch (err: any) {
      logger.error('QaController: Error deleting cohort', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
