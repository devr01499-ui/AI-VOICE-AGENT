// ─────────────────────────────────────────────
// Voice Runtime Engine — Agent Repository
// ─────────────────────────────────────────────

import { prisma } from '../config/database';
import { DatabaseError, NotFoundError } from '../types/errors';
import { logger } from '../utils/logger';

/**
 * Filtering and pagination options for user-scoped agent queries.
 */
interface FindByUserOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Pagination options for the global `findAll` query.
 */
interface FindAllOptions {
  limit?: number;
  offset?: number;
}

/**
 * Prisma-based repository for the Agent model.
 *
 * Provides read-only query methods. Write operations (create, update, delete)
 * live in a dedicated service layer that enforces business rules before
 * persisting changes.
 *
 * Every public method wraps Prisma operations in try/catch and re-throws
 * domain-specific errors (`NotFoundError`, `DatabaseError`).
 */
export class AgentRepository {
  // ───────── Read ─────────

  /**
   * Find a single Agent by its primary key.
   *
   * @param agentId - UUID of the agent.
   * @returns The matching Agent record.
   * @throws {NotFoundError} When no Agent matches the given ID.
   */
  static async findById(agentId: string) {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        throw new NotFoundError('Agent');
      }

      return agent;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to find agent by ID', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find agent');
    }
  }

  /**
   * Return paginated Agents for a given user, optionally filtered by status.
   *
   * @param userId  - Owner of the agents.
   * @param options - Optional status filter, limit (default 50), and offset (default 0).
   * @returns Array of Agent records.
   */
  static async findByUserId(userId: string, options: FindByUserOptions = {}) {
    const { status, limit = 50, offset = 0 } = options;

    try {
      const agents = await prisma.agent.findMany({
        where: {
          userId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return agents;
    } catch (error) {
      logger.error('Failed to find agents by user ID', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find agents by user');
    }
  }

  /**
   * Return all Agents that currently have the given status.
   *
   * @param status - Status string to filter on (e.g. 'active', 'draft', 'inactive').
   * @returns Array of matching Agent records.
   */
  static async findByStatus(status: string) {
    try {
      const agents = await prisma.agent.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
      });

      return agents;
    } catch (error) {
      logger.error('Failed to find agents by status', {
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find agents by status');
    }
  }

  /**
   * Return all Agents with optional pagination.
   *
   * Intended for development / demo purposes — production usage should
   * prefer user-scoped queries via {@link findByUserId}.
   *
   * @param options - Optional limit (default 50) and offset (default 0).
   * @returns Array of Agent records.
   */
  static async findAll(options: FindAllOptions = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      const agents = await prisma.agent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return agents;
    } catch (error) {
      logger.error('Failed to find all agents', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find agents');
    }
  }
}
