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
import { VoiceRuntimeEngine } from '../runtime/VoiceRuntimeEngine';
import { ProviderManager } from '../providers/ProviderManager';
import { env } from '../config/env';
import type { CallStatus, CallResponse, TranscriptSegmentResponse, Speaker } from '../types';
import type { ITelephonyProvider } from '../providers/interfaces/IProvider';
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

    // ── Create call record ─────────────────────
    const call = await CallRepository.create({
      agentId,
      userId,
      recipientPhoneNumber: phoneNumber,
      fromPhoneNumber: effectiveFromNumber,
      userData: userData ? JSON.stringify(userData) : '{}',
      maxDuration: maxDuration ?? 1800,
    });

    logger.info('CallService: call record created', { callId: call.id, agentId });

    // ── Initiate via Vobiz ─────────────────────
    try {
      const telephony = ProviderManager.instance.getTelephonyProvider();
      const publicUrl = env.PUBLIC_URL;

      if (!publicUrl) {
        throw new CallError(call.id, 'PUBLIC_URL not configured — Vobiz cannot reach webhook endpoints');
      }

      const result = await telephony.initiateCall({
        to: phoneNumber,
        from: effectiveFromNumber,
        answerUrl: `${publicUrl}/api/v2/webhooks/vobiz/answer?callId=${call.id}`,
        ringUrl: `${publicUrl}/api/v2/webhooks/vobiz/status?callId=${call.id}`,
        hangupUrl: `${publicUrl}/api/v2/webhooks/vobiz/hangup?callId=${call.id}`,
      });

      // Update with Vobiz call UUID
      await CallRepository.updateStatus(call.id, 'ringing');

      logger.info('CallService: call initiated via Vobiz', {
        callId: call.id,
        vobizRequestUuid: result.requestUuid,
      });
    } catch (err) {
      // Call placement failed — update status to failed
      await CallRepository.updateStatus(call.id, 'failed');

      logger.error('CallService: failed to initiate call', {
        callId: call.id,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new CallError(
        call.id,
        `Failed to place call: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    return {
      callId: call.id,
      status: 'ringing' as CallStatus,
      phoneNumber,
      agentId,
      createdAt: call.createdAt.toISOString(),
    };
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
    const engine = VoiceRuntimeEngine.instance;
    const sessionInfo = engine.getSessionInfo(callId);

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
    const engine = VoiceRuntimeEngine.instance;
    const sessionActive = engine.getSessionInfo(callId).active;
    await engine.endSession(callId, 'user_terminated');

    // Terminate via telephony provider
    try {
      const telephony = ProviderManager.instance.getTelephonyProvider();
      await telephony.terminateCall(callId);
    } catch (err) {
      logger.warn('CallService: Vobiz termination failed (call may already be ended)', {
        callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // If the session was not active in the engine (so endSession didn't update the DB),
    // we should manually update the DB status to cancelled.
    if (!sessionActive) {
      await CallRepository.updateStatus(callId, 'cancelled', {
        endTime: new Date(),
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
