/**
 * Bolna Server — Agent Routes
 *
 * Read-only endpoints for listing and retrieving agent configurations.
 * Agent CRUD is managed through the Next.js frontend API routes.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { Agent } from '@prisma/client';
import { AgentRepository } from '../repositories/AgentRepository';
import { validateParams, validateQuery } from '../middleware/validation';
import { prisma } from '../config/database';

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

/** GET /api/v2/agents — List all agents (optionally filtered). */
router.get(
  '/',
  validateQuery(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, limit, offset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      let agents;
      if (status) {
        agents = await AgentRepository.findByStatus(status);
      } else {
        agents = await AgentRepository.findAll({
          limit: limit ? parseInt(limit, 10) : 50,
          offset: offset ? parseInt(offset, 10) : 0,
        });
      }

      // Parse agentConfig JSON for response
      const formatted = agents.map((agent: Agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        agentType: agent.agentType,
        status: agent.status,
        version: agent.version,
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
      const agentId = req.params.agentId as string;
      const agent = await AgentRepository.findById(agentId);

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
      const { name, description, agentType, status, agentConfig, tags } = req.body;

      const newAgent = await prisma.agent.create({
        data: {
          name,
          description: description || null,
          agentType: agentType || 'conversational',
          status: status || 'draft',
          agentConfig: typeof agentConfig === 'string' ? agentConfig : JSON.stringify(agentConfig || {}),
          tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Seeded dev user in local database
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
      const agentId = req.params.agentId as string;
      const { name, description, agentType, status, agentConfig, tags } = req.body;

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

export default router;
