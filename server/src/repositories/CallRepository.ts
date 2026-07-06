// ─────────────────────────────────────────────
// Voice Runtime Engine — Call Repository
// ─────────────────────────────────────────────

import { prisma } from '../config/database';
import { DatabaseError, NotFoundError } from '../types/errors';
import { logger } from '../utils/logger';
import type { CallStatus } from '../types';

/**
 * Data required to create a new Call record.
 * Optional fields fall back to Prisma schema defaults.
 */
interface CreateCallData {
  agentId: string;
  userId: string;
  recipientPhoneNumber: string;
  fromPhoneNumber?: string;
  userData?: string;
  webhookUrl?: string;
  maxDuration?: number;
}

/**
 * Partial fields accepted when updating a Call record.
 */
interface UpdateCallData {
  recipientPhoneNumber?: string;
  fromPhoneNumber?: string;
  status?: CallStatus;
  callDirection?: string;
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
  telemetryId?: string;
  userData?: string;
  webhookUrl?: string;
  recordingEnabled?: boolean;
  maxDuration?: number;
}

/**
 * Optional timing data attached to a status transition.
 */
interface StatusExtraData {
  startTime?: Date;
  endTime?: Date;
  durationSeconds?: number;
}

/**
 * Fields accepted when updating the Execution record linked to a Call.
 */
interface UpdateExecutionData {
  transcript?: string;
  recordingUrl?: string;
  sentimentScore?: number;
  outcome?: string;
  metadata?: string;
  costBreakdown?: string;
}

/**
 * Filtering and pagination options for list queries.
 */
interface FindByUserOptions {
  status?: CallStatus;
  limit?: number;
  offset?: number;
}

/**
 * Prisma-based repository for the Call and Execution models.
 *
 * Every public method wraps Prisma operations in try/catch and re-throws
 * domain-specific errors (`NotFoundError`, `DatabaseError`) so that
 * upstream layers never deal with raw Prisma exceptions.
 */
export class CallRepository {
  // ───────── Create ─────────

  /**
   * Create a new Call together with its linked Execution record.
   *
   * @param data - Required and optional fields for the new call.
   * @returns The created Call with its nested Execution.
   */
  static async create(data: CreateCallData) {
    try {
      const call = await prisma.call.create({
        data: {
          agentId: data.agentId,
          userId: data.userId,
          recipientPhoneNumber: data.recipientPhoneNumber,
          fromPhoneNumber: data.fromPhoneNumber,
          userData: data.userData ?? '{}',
          webhookUrl: data.webhookUrl,
          maxDuration: data.maxDuration ?? 1800,
          execution: {
            create: {},
          },
        },
        include: { execution: true },
      });

      logger.info('Call created', { callId: call.id, agentId: call.agentId });
      return call;
    } catch (error) {
      logger.error('Failed to create call', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to create call');
    }
  }

  // ───────── Read ─────────

  /**
   * Find a single Call by its primary key, including the Execution relation.
   *
   * @param callId - UUID of the call.
   * @returns The Call with its Execution.
   * @throws {NotFoundError} When no Call matches the given ID.
   */
  static async findById(callId: string) {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { execution: true },
      });

      if (!call) {
        throw new NotFoundError('Call');
      }

      return call;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to find call by ID', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find call');
    }
  }

  /**
   * Return paginated Calls for a given user, optionally filtered by status.
   *
   * @param userId  - Owner of the calls.
   * @param options - Optional status filter, limit (default 50), and offset (default 0).
   * @returns Array of Calls with their Executions.
   */
  static async findByUserId(userId: string, options: FindByUserOptions = {}) {
    const { status, limit = 50, offset = 0 } = options;

    try {
      const calls = await prisma.call.findMany({
        where: {
          userId,
          ...(status ? { status } : {}),
        },
        include: { execution: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return calls;
    } catch (error) {
      logger.error('Failed to find calls by user ID', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find calls by user');
    }
  }

  /**
   * Return all Calls that currently have the given status.
   *
   * @param status - The {@link CallStatus} to filter on.
   * @returns Array of matching Calls with Executions.
   */
  static async findByStatus(status: CallStatus) {
    try {
      const calls = await prisma.call.findMany({
        where: { status },
        include: { execution: true },
        orderBy: { createdAt: 'desc' },
      });

      return calls;
    } catch (error) {
      logger.error('Failed to find calls by status', {
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to find calls by status');
    }
  }

  // ───────── Update ─────────

  /**
   * Partially update a Call record.
   *
   * @param callId - UUID of the call to update.
   * @param data   - Fields to overwrite.
   * @returns The updated Call with its Execution.
   */
  static async update(callId: string, data: UpdateCallData) {
    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data,
        include: { execution: true },
      });

      logger.info('Call updated', { callId });
      return call;
    } catch (error) {
      logger.error('Failed to update call', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to update call');
    }
  }

  /**
   * Transition a Call to a new status, optionally recording timing information.
   *
   * @param callId    - UUID of the call.
   * @param status    - Target {@link CallStatus}.
   * @param extraData - Optional start/end times and duration.
   * @returns The updated Call with its Execution.
   */
  static async updateStatus(
    callId: string,
    status: CallStatus,
    extraData?: StatusExtraData
  ) {
    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: {
          status,
          ...(extraData?.startTime ? { startTime: extraData.startTime } : {}),
          ...(extraData?.endTime ? { endTime: extraData.endTime } : {}),
          ...(extraData?.durationSeconds !== undefined
            ? { durationSeconds: extraData.durationSeconds }
            : {}),
        },
        include: { execution: true },
      });

      logger.info('Call status updated', { callId, status });
      return call;
    } catch (error) {
      logger.error('Failed to update call status', {
        callId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to update call status');
    }
  }

  /**
   * Update the Execution record linked to a Call.
   *
   * @param callId - UUID of the parent call (Execution.callId is unique).
   * @param data   - Fields to overwrite on the Execution.
   * @returns The updated Execution record.
   */
  static async updateExecution(callId: string, data: UpdateExecutionData) {
    try {
      const execution = await prisma.execution.update({
        where: { callId },
        data,
      });

      logger.info('Execution updated', { callId, executionId: execution.id });
      return execution;
    } catch (error) {
      logger.error('Failed to update execution', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to update execution');
    }
  }

  // ───────── Delete ─────────

  /**
   * Delete a Call and cascade to its Execution, TranscriptSegments, etc.
   *
   * @param callId - UUID of the call to remove.
   */
  static async delete(callId: string): Promise<void> {
    try {
      await prisma.call.delete({
        where: { id: callId },
      });

      logger.info('Call deleted', { callId });
    } catch (error) {
      logger.error('Failed to delete call', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to delete call');
    }
  }
}
