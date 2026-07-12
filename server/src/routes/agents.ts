/**
 * Bolna Server — Agent Routes
 *
 * Enforces strict user-wise database isolation gates.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { Agent } from '@prisma/client';
import { AgentRepository } from '../repositories/AgentRepository';
import { validateParams, validateQuery } from '../middleware/validation';
import { prisma } from '../config/database';
import { getUserIdFromRequest } from '../utils/auth';

const router = Router();

// ─── Validation Schemas ──────────────────────────

const agentIdParamSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});

const listQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ─── Route Handlers ──────────────────────────────

/** GET /api/v2/agents/me/profile — Fetch current user profile and balance metrics. */
router.get(
  '/me/profile',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          billingBalance: true,
          geminiApiKey: true,
          callingBalanceMinutes: true,
        }
      });
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/agents/optimize — Low-Code Prompt Optimizer helper. */
router.post(
  '/optimize',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { description } = req.body;
      if (!description) {
        res.status(400).json({ success: false, error: 'Description is required' });
        return;
      }

      // Enrichment logic: append architectural filler, brevity boundaries, and voice pausing cues
      const enrichedPrompt = `You are a professional voice AI assistant.
Role description: ${description}

CONVERSATIONAL RULES & VOICE METADATA:
1. BREVITY BOUNDARIES: Keep answers strictly under 2 sentences. Never read raw bullet points or list items.
2. VOICE PAUSING CUES: Pause slightly when introducing new topics. Use "..." or brief phrasing to give natural transitions.
3. CONVERSATIONAL FILLERS: Speak naturally using polite fillers like "sure", "uh-huh", "got it" to sound human.
4. TARGET REDIRECTS: If caller drifts off-topic, gently redirect them to the primary call objective.`;

      res.json({
        success: true,
        data: {
          prompt: enrichedPrompt,
          model: 'gemini-2.0-flash',
          voiceName: 'Puck',
          temperature: 0.7,
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/v2/agents — List all agents (isolated to the authenticated userId). */
router.get(
  '/',
  validateQuery(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { status, limit, offset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      // Strict user-wise database isolation
      const agents = await prisma.agent.findMany({
        where: {
          userId: userId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      });

      // Parse agentConfig JSON for response
      const formatted = agents.map((agent: Agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        agentType: agent.agentType,
        status: agent.status,
        version: agent.version,
        workspaceId: agent.workspaceId,
        model: agent.model,
        voiceName: agent.voiceName,
        temperature: agent.temperature,
        systemPrompt: agent.systemPrompt,
        flowGraph: agent.flowGraph,
        agentConfig: agent.agentConfig,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      }));

      res.json({
        success: true,
        data: formatted,
        count: formatted.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/v2/agents/:agentId — Get a single agent by ID. */
router.get(
  '/:agentId',
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;
      
      // Strict user-wise lookup constraint
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(agent.agentConfig);
      } catch {
        // Return raw string if not valid JSON
      }

      res.json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          agentType: agent.agentType,
          status: agent.status,
          version: agent.version,
          workspaceId: agent.workspaceId,
          model: agent.model,
          voiceName: agent.voiceName,
          temperature: agent.temperature,
          systemPrompt: agent.systemPrompt,
          flowGraph: agent.flowGraph,
          agentConfig: parsedConfig,
          tags: JSON.parse(agent.tags || '[]'),
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/agents — Create a new agent. */
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, temperature, systemPrompt, flowGraph } = req.body;

      const newAgent = await prisma.agent.create({
        data: {
          name,
          description: description || null,
          agentType: agentType || 'conversational',
          status: status || 'draft',
          agentConfig: typeof agentConfig === 'string' ? agentConfig : JSON.stringify(agentConfig || {}),
          tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
          userId: userId,
          workspaceId: workspaceId || null,
          model: model || null,
          voiceName: voiceName || null,
          temperature: temperature !== undefined ? Number(temperature) : null,
          systemPrompt: systemPrompt || null,
          flowGraph: flowGraph || null,
        },
      });

      res.status(201).json({
        success: true,
        data: newAgent,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /api/v2/agents/:agentId — Update an existing agent. */
router.put(
  '/:agentId',
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;
      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, temperature, systemPrompt, flowGraph } = req.body;

      // Verify ownership before updating
      const exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(agentType !== undefined && { agentType }),
          ...(status !== undefined && { status }),
          ...(agentConfig !== undefined && {
            agentConfig: typeof agentConfig === 'string' ? agentConfig : JSON.stringify(agentConfig || {})
          }),
          ...(tags !== undefined && {
            tags: typeof tags === 'string' ? tags : JSON.stringify(tags || [])
          }),
          ...(workspaceId !== undefined && { workspaceId }),
          ...(model !== undefined && { model }),
          ...(voiceName !== undefined && { voiceName }),
          ...(temperature !== undefined && { temperature: temperature !== null ? Number(temperature) : null }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(flowGraph !== undefined && { flowGraph }),
        },
      });

      res.json({
        success: true,
        data: updatedAgent,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/v2/agents/:agentId — Delete an existing agent. */
router.delete(
  '/:agentId',
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;

      // Verify ownership before deleting
      const exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      await prisma.agent.delete({
        where: { id: agentId },
      });

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
