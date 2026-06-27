/**
 * Bolna Server — Call Service
 *
 * Business logic layer for call operations. Validates inputs, coordinates
 * between repositories and the VoiceRuntimeEngine, and enforces business
 * rules. Controllers call this layer — it never touches HTTP concerns.
 */

import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, CallError } from '../types/errors';
import { CallRepository } from '../repositories/CallRepository';
import { AgentRepository } from '../repositories/AgentRepository';
import { TranscriptRepository } from '../repositories/TranscriptRepository';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { VobizService } from '../core/telephony/VobizService';
import { env } from '../config/env';
import type { CallStatus, CallResponse, TranscriptSegmentResponse, Speaker } from '../types';
import { Call, Execution, TranscriptSegment } from '@prisma/client';

// ─── Input Shapes ─────────────────────────────────

interface CreateCallInput {
  phoneNumber: string;
  agentId: string;
  userId: string;
  userData?: Record<string, unknown>;
  maxDuration?: number;
  fromPhoneNumber?: string;
}

// ─── Service Implementation ───────────────────────

export class CallService {
  /**
   * Creates a new call record and initiates the outbound call via Vobiz.
   *
   * Flow:
   *   1. Validate agent exists
   *   2. Validate phone number format
   *   3. Create Call + Execution records in DB
   *   4. Place the call via Vobiz telephony provider
   *   5. Update call status to 'ringing'
   *   6. Return call response
   */
  static async createCall(input: CreateCallInput): Promise<CallResponse> {
    const { phoneNumber, agentId, userId, userData, maxDuration, fromPhoneNumber } = input;

    // ── Validate phone number ──────────────────
    if (!phoneNumber || !phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new ValidationError('Invalid phone number', [
        { field: 'phoneNumber', message: 'Must be E.164 format (e.g., +919876543210)' },
      ]);
    }

    // ── Validate agent exists ──────────────────
    const agent = await AgentRepository.findById(agentId);
    if (agent.status !== 'active' && agent.status !== 'draft') {
      throw new ValidationError('Agent is not available', [
        { field: 'agentId', message: `Agent status is '${agent.status}', must be 'active' or 'draft'` },
      ]);
    }

    const effectiveFromNumber = fromPhoneNumber || env.VOBIZ_FROM_NUMBER;

    // ── Initiate via CallOrchestrator ──────────
    try {
      const callId = await callOrchestrator.initiateOutboundCall(
        phoneNumber,
        agentId,
        userId,
        effectiveFromNumber,
        maxDuration ?? 1800
      );

      const call = await CallRepository.findById(callId);

      return {
        callId: call.id,
        status: call.status as CallStatus,
        phoneNumber: call.recipientPhoneNumber,
        agentId: call.agentId,
        createdAt: call.createdAt.toISOString(),
      };
    } catch (err) {
      logger.error('CallService: failed to initiate call', {
        error: err instanceof Error ? err.message : String(err),
      });

      throw new CallError(
        'unknown',
        `Failed to place call: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Returns the current status of a call.
   */
  static async getCallById(callId: string): Promise<CallResponse> {
    const call = await CallRepository.findById(callId);

    return {
      callId: call.id,
      status: call.status as CallStatus,
      phoneNumber: call.recipientPhoneNumber,
      agentId: call.agentId,
      createdAt: call.createdAt.toISOString(),
    };
  }

  /**
   * Returns the full call record with execution details.
   */
  static async getCallDetails(callId: string) {
    const call = await CallRepository.findById(callId);
    const sessionInfo = callOrchestrator.getSessionInfo(callId);

    return {
      ...call,
      runtime: {
        active: sessionInfo.active,
        metrics: sessionInfo.metrics,
        conversationTurns: sessionInfo.conversationTurns,
      },
    };
  }

  /**
   * Terminates an active call.
   *
   * Flow:
   *   1. End the VoiceRuntimeEngine session
   *   2. Terminate the Vobiz call
   *   3. Update DB status
   */
  static async terminateCall(callId: string): Promise<void> {
    const call = await CallRepository.findById(callId);

    // Can't terminate a call that's already in a terminal state
    const terminalStates: CallStatus[] = ['completed', 'failed', 'no_answer', 'busy', 'cancelled'];
    if (terminalStates.includes(call.status as CallStatus)) {
      throw new CallError(callId, `Call is already in terminal state: ${call.status}`, 400);
    }

    // End runtime session
    await callOrchestrator.endCallSession(callId, 'user_terminated');

    // Terminate via telephony provider
    try {
      await VobizService.terminateCall(callId);
    } catch (err) {
      logger.warn('CallService: Vobiz termination failed (call may already be ended)', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info('CallService: call terminated', { callId });
  }

  /**
   * Returns the transcript for a call.
   */
  static async getCallTranscript(callId: string): Promise<TranscriptSegmentResponse[]> {
    // Verify call exists
    await CallRepository.findById(callId);

    const segments = await TranscriptRepository.findByCallId(callId);

    return segments.map((seg: TranscriptSegment) => ({
      id: seg.id,
      speaker: seg.speaker as Speaker,
      content: seg.content,
      startTime: seg.startTime,
      endTime: seg.endTime,
      sequenceNumber: seg.sequenceNumber,
    }));
  }

  /**
   * Updates call status based on a Vobiz webhook callback.
   * This is called from the webhook route handlers.
   */
  static async handleStatusUpdate(callId: string, vobizStatus: string): Promise<void> {
    const statusMap: Record<string, CallStatus> = {
      ringing: 'ringing',
      answered: 'connected',
      in_progress: 'in_progress',
      completed: 'completed',
      failed: 'failed',
      busy: 'busy',
      no_answer: 'no_answer',
      hangup: 'completed',
    };

    const mappedStatus = statusMap[vobizStatus.toLowerCase()];
    if (!mappedStatus) {
      logger.warn('CallService: unknown Vobiz status', { callId, vobizStatus });
      return;
    }

    await CallRepository.updateStatus(callId, mappedStatus);
    logger.info('CallService: status updated from Vobiz webhook', {
      callId,
      vobizStatus,
      mappedStatus,
    });
  }

  /**
   * Lists calls for a user with optional filtering.
   */
  static async listCalls(
    userId: string,
    options?: { status?: CallStatus; limit?: number; offset?: number }
  ) {
    const calls = await CallRepository.findByUserId(userId, options);

    return calls.map((call: Call & { execution: Execution | null }) => ({
      callId: call.id,
      status: call.status as CallStatus,
      phoneNumber: call.recipientPhoneNumber,
      agentId: call.agentId,
      createdAt: call.createdAt.toISOString(),
      durationSeconds: call.durationSeconds,
      recordingUrl: call.execution?.recordingUrl ?? null,
    }));
  }
}
