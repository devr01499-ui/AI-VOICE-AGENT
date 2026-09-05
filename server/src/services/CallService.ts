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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/prisma';
import { ADMIN_EMAIL } from '../config/constants';
import { WebhookDispatcher } from '../utils/WebhookDispatcher';
import { ContactsController } from '../controllers/ContactsController';

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

    // ── Enforce minutes remaining pre-call gate ─────────────
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('User not found');

    const effectiveRemainingSeconds = user.minutesRemainingSeconds > 0
      ? user.minutesRemainingSeconds
      : (user.callingBalanceMinutes * 60);

    if (user.accountType !== 'admin' && effectiveRemainingSeconds <= 0) {
      throw new ValidationError('Insufficient call minutes remaining. You have 0 minutes left. Please purchase a plan.');
    }

    let maxConcurrency = 1; // free/Starter
    if (user.accountType === 'developer' || user.accountType === 'professional') {
      maxConcurrency = 5; // Growth
    } else if (user.accountType === 'enterprise') {
      maxConcurrency = 15; // Scale
    }

    const activeCallCount = await prisma.call.count({
      where: {
        userId,
        status: { in: ['queued', 'ringing', 'in_progress'] },
      }
    });

    if (activeCallCount >= maxConcurrency) {
      throw new ValidationError('Concurrency limit exceeded', [
        { field: 'concurrency', message: `Max allowed concurrent calls for your plan is ${maxConcurrency}.` }
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

      ContactsController.upsertContactOnCall(userId, phoneNumber).catch(() => {});

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

    let signedUrl = (call.execution as any)?.recordingUrl || call.recordingUrl || null;
    if (signedUrl) {
      const { supabaseClient } = await import('../utils/supabase');
      const result = await supabaseClient.storage.from('call-recordings').createSignedUrl(signedUrl, 3600);
      signedUrl = result.data?.signedUrl || null;
    }

    const modifiedExecution = call.execution ? {
      ...call.execution,
      recordingUrl: signedUrl
    } : null;

    return {
      ...call,
      recordingUrl: signedUrl,
      execution: modifiedExecution,
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

    // Sync linked BatchRecipient status if call reached a terminal state
    const terminalStatuses = ['completed', 'failed', 'busy', 'no_answer', 'cancelled'];
    if (terminalStatuses.includes(mappedStatus)) {
      try {
        const recipient = await prisma.batchRecipient.findFirst({ where: { callId } });
        if (recipient) {
          const recipientStatus = mappedStatus === 'completed' ? 'completed' : 'failed';
          await prisma.batchRecipient.update({
            where: { id: recipient.id },
            data: { status: recipientStatus }
          });
          const completedCount = await prisma.batchRecipient.count({ where: { batchId: recipient.batchId, status: 'completed' } });
          const failedCount = await prisma.batchRecipient.count({ where: { batchId: recipient.batchId, status: 'failed' } });
          await prisma.batch.update({
            where: { id: recipient.batchId },
            data: { completedCount, failedCount }
          });
        }
      } catch (batchSyncErr) {
        logger.warn('CallService: failed to sync BatchRecipient status', { callId, error: String(batchSyncErr) });
      }
    }
  }

  /**
   * Lists calls for a user with optional filtering.
   */
  static async listCalls(
    userId: string,
    options?: { status?: CallStatus; limit?: number; offset?: number }
  ) {
    const calls = await CallRepository.findByUserId(userId, options);
    const { supabaseClient } = await import('../utils/supabase');

    return Promise.all(calls.map(async (call: Call & { execution: Execution | null }) => {
      let signedUrl = call.execution?.recordingUrl ?? null;
      if (signedUrl) {
        const result = await supabaseClient.storage.from('call-recordings').createSignedUrl(signedUrl, 3600);
        signedUrl = result.data?.signedUrl || null;
      }
      return {
        callId: call.id,
        status: call.status as CallStatus,
        phoneNumber: call.recipientPhoneNumber,
        agentId: call.agentId,
        createdAt: call.createdAt.toISOString(),
        durationSeconds: call.durationSeconds,
        recordingUrl: signedUrl,
      };
    }));
  }

  static async generatePostCallIntelligence(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { user: true, agent: true }
      });
      if (!call) return;

      const segments = await TranscriptRepository.findByCallId(callId);
      if (segments.length === 0) return;

      const transcriptText = segments.map((s: any) => `${s.speaker === 'agent' ? 'Agent' : 'Caller'}: ${s.content}`).join('\n');

      const apiKey = call.user.geminiApiKey || env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'AIzaSyAQ-x2GqymD5KvQ1tC9H78Z4E9uGGqIExQ') {
        logger.warn('generatePostCallIntelligence: skipped, missing gemini api key');
        return;
      }

      // Extract agent's postCallAnalysis config
      let postCallConfig: any = {};
      if (call.agent && call.agent.agentConfig) {
        try {
          const parsed = typeof call.agent.agentConfig === 'string'
            ? JSON.parse(call.agent.agentConfig)
            : call.agent.agentConfig;
          if (parsed?.postCallAnalysis) {
            postCallConfig = parsed.postCallAnalysis;
          }
        } catch {}
      }

      const customSummaryPrompt = postCallConfig.summaryPrompt || 'Concise two-sentence summary of the call.';
      const customFields: Array<{ name: string; type: string; description: string; options?: string[] }> = postCallConfig.fields || [];

      let fieldInstructions = '';
      if (customFields.length > 0) {
        fieldInstructions = `\nExtract the following custom data fields:\n` +
          customFields.map(f => `- "${f.name}" (${f.type}): ${f.description}${f.options ? ' Choices: [' + f.options.join(', ') + ']' : ''}`).join('\n');
      }

      const prompt = `You are an expert AI call intelligence analyst. Analyze the following transcript.

Summary Instructions: ${customSummaryPrompt}
${fieldInstructions}

Return a single raw JSON object with no markdown formatting or backticks, formatted as:
{
  "summary": "...",
  "sentiment": "Positive|Neutral|Negative",
  "extractedFields": {
    <field_name>: <extracted_value>
  }
}

Transcript:
${transcriptText}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();
      responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsedResult: any = {};
      try {
        parsedResult = JSON.parse(responseText);
      } catch {
        parsedResult = { summary: responseText, sentiment: 'Neutral', extractedFields: {} };
      }

      const sentiment = parsedResult.sentiment || 'Neutral';
      const summary = parsedResult.summary || responseText;
      const extractedFields = parsedResult.extractedFields || {};

      // Merge extracted fields into call.userData JSON
      let existingUserData: Record<string, any> = {};
      try {
        existingUserData = typeof call.userData === 'string' ? JSON.parse(call.userData) : (call.userData || {});
      } catch {}

      const updatedUserData = JSON.stringify({
        ...existingUserData,
        postCallAnalysis: {
          extractedFields,
          processedAt: new Date().toISOString(),
        }
      });

      await prisma.call.update({
        where: { id: callId },
        data: {
          sentiment,
          summary,
          userData: updatedUserData,
        }
      });

      WebhookDispatcher.dispatch({
        agentId: call.agentId,
        userId: call.userId,
        eventType: 'call_analyzed',
        payload: {
          callId,
          sentiment,
          summary,
          extractedFields,
        },
      });

      logger.info('generatePostCallIntelligence: success', { callId, sentiment, extractedFieldsCount: Object.keys(extractedFields).length });
    } catch (err: any) {
      logger.error('generatePostCallIntelligence: error', { error: err.message, callId });
    }
  }

  /**
   * Deducts the real elapsed call duration (in seconds) from the user's remaining minutes balance.
   */
  static async deductCallMinutes(callId: string, durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;

    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return;

      const user = await prisma.user.findUnique({ where: { id: call.userId } });
      if (!user || user.email === ADMIN_EMAIL) return;

      const currentSecs = user.minutesRemainingSeconds > 0
        ? user.minutesRemainingSeconds
        : (user.callingBalanceMinutes * 60);

      const newRemainingSeconds = Math.max(0, currentSecs - durationSeconds);
      const newCallingBalanceMinutes = Math.max(0, newRemainingSeconds / 60);
      const newTotalConsumedMinutes = user.totalMinutesConsumed + (durationSeconds / 60);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          minutesRemainingSeconds: newRemainingSeconds,
          callingBalanceMinutes: newCallingBalanceMinutes,
          totalMinutesConsumed: newTotalConsumedMinutes,
        },
      });

      logger.info('[POST_CALL_DEDUCTION] Deducted call seconds from user balance', {
        callId,
        userId: user.id,
        durationSeconds,
        newRemainingSeconds,
        newCallingBalanceMinutes,
      });
    } catch (err: any) {
      logger.error('[POST_CALL_DEDUCTION_ERROR] Failed to deduct call minutes', { callId, error: err.message });
    }
  }
}
