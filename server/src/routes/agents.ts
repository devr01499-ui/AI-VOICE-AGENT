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
import { prisma } from '../lib/prisma';
import { getUserIdFromRequest } from '../utils/auth';
import { logger } from '../utils/logger';

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

      const user = await AgentRepository.findProfileByUserId(userId);
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

      let agents = [];
      try {
        const allAgents = await AgentRepository.findManyByUserId(userId);
        // Apply status filtering and pagination in-memory to prevent database query crashes
        agents = (allAgents || []).filter((agent: any) => {
          if (status && agent.status !== status) return false;
          return true;
        });
        
        const lim = limit ? parseInt(limit, 10) : 50;
        const off = offset ? parseInt(offset, 10) : 0;
        agents = agents.slice(off, off + lim);
      } catch (error: any) {
        logger.error("Handled Gracefully - Agent Repository Retrieval Exception:", { error: error?.message || String(error) });
        // Instantly return a native, flat fallback JSON array 
        res.status(200).json([]);
        return;
      }

      // Parse agentConfig JSON for response
      const formatted = agents.map((agent: any) => ({
        id: agent?.id,
        name: agent?.name,
        description: agent?.description,
        agentType: agent?.agentType,
        status: agent?.status,
        version: agent?.version,
        workspaceId: agent?.workspaceId,
        model: agent?.model,
        voiceName: agent?.voiceName,
        temperature: agent?.temperature,
        systemPrompt: agent?.systemPrompt,
        flowGraph: agent?.flowGraph,
        agentConfig: agent?.agentConfig,
        createdAt: agent?.createdAt instanceof Date ? agent.createdAt.toISOString() : (agent?.createdAt ? new Date(agent.createdAt).toISOString() : new Date().toISOString()),
        updatedAt: agent?.updatedAt instanceof Date ? agent.updatedAt.toISOString() : (agent?.updatedAt ? new Date(agent.updatedAt).toISOString() : new Date().toISOString()),
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

      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, systemVoice, temperature, systemPrompt, flowGraph } = req.body;

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
          systemVoice: systemVoice || 'Puck',
          temperature: temperature !== undefined ? Number(temperature) : 0.7,
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
      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, systemVoice, temperature, systemPrompt, flowGraph } = req.body;

      // Verify ownership before updating
      const exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // Explicitly update only matching records with composite tenant criteria
      await prisma.agent.updateMany({
        where: { id: agentId, userId: userId },
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
          ...(systemVoice !== undefined && { systemVoice }),
          ...(temperature !== undefined && { temperature: temperature !== null ? Number(temperature) : 0.7 }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(flowGraph !== undefined && { flowGraph }),
        },
      });

      const updatedAgent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!updatedAgent) {
        res.status(404).json({ success: false, error: 'Agent not found after update' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: updatedAgent.id,
          name: updatedAgent.name,
          description: updatedAgent.description,
          agentType: updatedAgent.agentType,
          status: updatedAgent.status,
          version: updatedAgent.version,
          workspaceId: updatedAgent.workspaceId,
          model: updatedAgent.model,
          voiceName: updatedAgent.voiceName,
          systemVoice: updatedAgent.systemVoice,
          temperature: updatedAgent.temperature,
          systemPrompt: updatedAgent.systemPrompt,
          flowGraph: updatedAgent.flowGraph,
          tags: JSON.parse(updatedAgent.tags || '[]'),
          createdAt: updatedAgent.createdAt.toISOString(),
          updatedAt: updatedAgent.updatedAt.toISOString(),
        },
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

      await prisma.agent.deleteMany({
        where: { id: agentId, userId: userId },
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
