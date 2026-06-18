/**
 * Bolna Server — Agent Routes
 *
 * Read-only endpoints for listing and retrieving agent configurations.
 * Agent CRUD is managed through the Next.js frontend API routes.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AgentRepository } from '../repositories/AgentRepository';
import { validateParams, validateQuery } from '../middleware/validation';

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
      const formatted = agents.map((agent) => ({
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

export default router;
