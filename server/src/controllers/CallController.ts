/**
 * Claritiy Voice Server — Call Controller
 *
 * Thin HTTP translation layer between Express routes and the CallService.
 * No business logic here — only request parsing, service delegation,
 * and response formatting.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { CallService } from '../services/CallService';
import { InboundCallService } from '../services/InboundCallService';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { ADMIN_EMAIL } from '../config/constants';
import { getWebhookSigningSecret } from '../utils/security';
import { callTimingTracker } from '../utils/CallTimingTracker';
import { escapeXml } from '../utils/xmlUtils';
import { hasCallableBalance } from '../utils/balanceUtils';

/**
 * Handles all call-related HTTP endpoints.
 * Methods are static to avoid unnecessary instantiation.
 */
export class CallController {
  /**
   * POST /api/v2/calls
   *
   * Initiates a new outbound call. Expects JSON body with:
   *   - phoneNumber (string, required)
   *   - agentId (string, required)
   *   - userId (string, optional — defaults to a placeholder)
   *   - userData (object, optional)
   *   - maxDuration (number, optional)
   */
  static async initiateCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetNumber = req.body.phoneNumber || req.body.recipientNumber;
      const agentId = req.body.agentId;

      if (!targetNumber) {
        res.status(400).json({ 
          success: false, 
          message: "Signaling Validation Failure: No valid destination number (phoneNumber/recipientNumber) found in request payload." 
        });
        return;
      }
      const phoneNumber = targetNumber;

      const body = req.body as any;
      const authenticatedUserId = (req as any).effectiveWorkspaceId || (req as any).auth?.userId || (req as any).userId || (req as any).user?.id;
      const userData = body.userData;
      const maxDuration = body.maxDuration;
      const fromPhoneNumber = body.fromPhoneNumber;
      if (!agentId) {
        res.status(400).json({ success: false, error: 'agentId is required' });
        return;
      }

      if (!authenticatedUserId) {
        res.status(401).json({ success: false, error: 'Unauthorized: User authentication context required' });
        return;
      }

      const callerIsAdmin = (req as any).user?.accountType === 'admin' || (req as any).user?.email === ADMIN_EMAIL;
      const effectiveUserId = (callerIsAdmin && body.userId) ? body.userId : authenticatedUserId;

      // Seed/upsert MVP User dynamically if they do not exist to prevent foreign key errors
      const prisma = (await import('../lib/prisma')).prisma;
      await prisma.user.upsert({
        where: { id: effectiveUserId },
        update: {},
        create: {
          id: effectiveUserId,
          email: effectiveUserId === '1e69187e-82d5-4166-929f-4bbba90e5304' ? ADMIN_EMAIL : `user-${effectiveUserId}@supabase.io`,
          fullName: effectiveUserId === '1e69187e-82d5-4166-929f-4bbba90e5304' ? "devr01499" : "Supabase User",
          passwordHash: "$2b$10$UnSeededPasswordHashPlaceholder",
        }
      });

      // Ensure dynamic agent context matching
      const activeAgent = await prisma.agent.findUnique({
        where: { id: agentId }
      });

      if (!activeAgent) {
        if (agentId === "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22") {
          // Only seed default agent if it is the legacy agent id and is missing
          await prisma.agent.create({
            data: {
              id: agentId,
              name: "Claritiy Voice Assistant",
              systemPrompt: "You are Claritiy Voice Assistant, a professional, warm, and helpful AI voice agent. Speak in a friendly, conversational tone. Answer caller questions concisely and assist them with their inquiries. Pause naturally and wait for caller responses. Never output markdown formatting or bullet points. Be polite, listen actively, and assist the caller with clarity.",
              voiceName: "Puck",
              model: "models/gemini-2.5-flash-native-audio-latest",
              userId: "1e69187e-82d5-4166-929f-4bbba90e5304",
              status: "active"
            }
          });
        } else {
          res.status(404).json({ success: false, error: `Agent with ID ${agentId} not found` });
          return;
        }
      }

      const result = await CallService.createCall({
        phoneNumber,
        agentId,
        userId: effectiveUserId,
        userData,
        maxDuration,
        fromPhoneNumber,
        record: typeof body.record === 'boolean' ? body.record : (typeof body.isRecordingEnabled === 'boolean' ? body.isRecordingEnabled : undefined),
      });

      res.status(201).json({
        success: true,
        callId: result.callId,
        id: result.callId,
        data: {
          ...result,
          id: result.callId,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v2/calls/:callId
   *
   * Returns the current status and details of a call.
   */
  static async getCallStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const callId = req.params.callId as string;
      const details = await CallService.getCallDetails(callId);

      res.json({
        success: true,
        data: details,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v2/calls/:callId/terminate
   *
   * Terminates an active call.
   */
  static async terminateCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const callId = req.params.callId as string;
      await CallService.terminateCall(callId);

      res.json({
        success: true,
        message: 'Call terminated',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v2/calls/:callId/transcript
   *
   * Returns the transcript for a completed or in-progress call.
   */
  static async getCallTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const callId = req.params.callId as string;
      const transcriptSegments = await CallService.getCallTranscript(callId);

      const turns = transcriptSegments.map((seg) => ({
        id: seg.id,
        speaker: seg.speaker === 'agent' ? ('agent' as const) : ('caller' as const),
        role: seg.speaker === 'agent' ? ('agent' as const) : ('caller' as const),
        text: seg.content,
        startTime: seg.startTime,
        endTime: seg.endTime,
        sequenceNumber: seg.sequenceNumber,
      }));

      // Fallback to Execution.transcript if TranscriptSegment rows are not populated
      if (turns.length === 0) {
        const execution = await prisma.execution.findUnique({ where: { callId } });
        if (execution && execution.transcript && execution.transcript !== '[]') {
          try {
            const parsed = JSON.parse(execution.transcript);
            if (Array.isArray(parsed)) {
              parsed.forEach((turn: any, idx: number) => {
                const spk = turn.role === 'agent' || turn.speaker === 'agent' ? ('agent' as const) : ('caller' as const);
                turns.push({
                  id: turn.id || `exec_${idx}`,
                  speaker: spk,
                  role: spk,
                  text: turn.text || turn.content || '',
                  startTime: turn.startTime ?? idx * 2,
                  endTime: turn.endTime,
                  sequenceNumber: turn.sequenceNumber ?? idx + 1,
                });
              });
            }
          } catch {}
        }
      }

      const formattedString = turns.map(t => `${t.speaker === 'agent' ? 'Agent' : 'Caller'}: ${t.text}`).join('\n');

      res.json({
        success: true,
        data: {
          callId,
          transcript: formattedString,
          turns,
          totalTurns: turns.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v2/webhooks/vobiz/answer
   *
   * Called by Vobiz when the recipient answers the phone.
   * Returns XML that tells Vobiz to start a bidirectional audio stream
   * to our WebSocket endpoint.
   */
  static async handleVobizAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryCallId = req.query.callId as string;
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;
      const direction = req.body?.Direction as string;

      // Check if this is an explicit inbound call from Vobiz
      const isInbound = direction === 'inbound' || (!queryCallId && !requestUuid && !callUuid);

      let callId = '';
      let callSession = null;

      if (!isInbound) {
        // Search database records for an active call matching tracking token or query callId
        callSession = await prisma.call.findFirst({
          where: {
            OR: [
              ...(queryCallId ? [{ id: queryCallId }] : []),
              ...(requestUuid ? [{ telemetryId: requestUuid }] : []),
              ...(callUuid ? [{ telemetryId: callUuid }] : [])
            ]
          }
        });
      }

      // If no outbound session match or direction is inbound, process via InboundCallService
      let inboundResult: any = null;
      if (!callSession) {
        inboundResult = await InboundCallService.handleInboundCall({
          CallUUID: callUuid || requestUuid,
          RequestUUID: requestUuid,
          From: req.body?.From,
          To: req.body?.To,
          CallStatus: req.body?.CallStatus
        });

        if (!inboundResult.success) {
          logger.warn('CallController: Inbound call handling failed', {
            error: inboundResult.errorMessage,
            to: req.body?.To,
            from: req.body?.From
          });

          const spoken = inboundResult.spokenMessage || 'This number is currently unavailable. Please try again later.';
          res.set('Content-Type', 'application/xml; charset=utf-8');
          res.status(200).send(`<Response><Speak>${escapeXml(spoken)}</Speak><Hangup/></Response>`);
          return;
        }

        callId = inboundResult.callId!;
      } else {
        callId = callSession.id;

        // Outbound balance alignment check block via unified helper
        const user = await prisma.user.findUnique({ where: { id: callSession.userId } });
        if (user && user.accountType !== 'admin' && user.email !== ADMIN_EMAIL && !hasCallableBalance(user)) {
          logger.warn('CallController: Insufficient balance for webhook call connection', { callId, userId: user.id });
          await callOrchestrator.endCallSession(callId, 'balance_exhausted', 'Insufficient balance on answer webhook', 'system').catch(() => {});
          res.set('Content-Type', 'application/xml; charset=utf-8');
          res.status(200).send(`<Response><Speak>${escapeXml('This number is currently unavailable. Please try again later.')}</Speak><Hangup/></Response>`);
          return;
        }

        // Update status to connected
        await CallService.handleStatusUpdate(callId, 'answered');
      }

      callTimingTracker.mark(callId, 'answer_webhook_received');
      const targetAgentId = callSession?.agentId || (inboundResult as any)?.agentId;
      const targetRecipient = callSession?.recipientPhoneNumber || req.body?.From || 'Anonymous';
      if (targetAgentId) {
        callOrchestrator.prewarmVoiceSession(callId, targetAgentId, targetRecipient).catch((err) => {
          logger.warn('CallController: prewarm session background error', { callId, error: String(err) });
        });
      }

      logger.info('CallController: Vobiz answer webhook sending Stream XML', { callId, isNewInbound: !callSession });

      // Return XML to tell telephony provider to stream audio to our WebSocket with signed timestamped token
      const publicUrl = (env.PUBLIC_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : '')).replace(/\/+$/, '');
      const wsUrl = publicUrl.replace(/^http/, 'ws');
      const secret = getWebhookSigningSecret();
      const ts = Date.now();
      const token = crypto.createHmac('sha256', secret).update(`${callId}:${ts}`).digest('hex');
      const streamUrl = `${wsUrl}/audio-stream?callId=${encodeURIComponent(callId)}&token=${encodeURIComponent(token)}&ts=${ts}`;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream streamTimeout="1800" keepCallAlive="true" bidirectional="true" contentType="audio/x-l16;rate=16000"><![CDATA[${streamUrl}]]></Stream>
</Response>`;

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Helper adapter function to normalize incoming Plivo webhook payloads.
   * Tolerates variations in casing, query vs body, and ALeg/B-leg parameter names.
   */
  static normalizePlivoPayload(req: Request): {
    callId?: string;
    callUuid: string;
    requestUuid?: string;
    alegUuid?: string;
    from: string;
    to: string;
    direction: 'inbound' | 'outbound';
    callStatus: string;
  } {
    const data = { ...req.query, ...req.body };
    const queryCallId = ((data.callId || data.CallId || '') as string).trim();
    const requestUuid = ((data.RequestUUID || data.requestUUID || data.request_uuid || data.ALegRequestUUID || '') as string).trim();
    const callUuid = ((data.CallUUID || data.callUUID || data.call_uuid || '') as string).trim();
    const alegUuid = ((data.ALegUUID || data.alegUUID || data.aleg_uuid || '') as string).trim();
    const from = ((data.From || data.from || '') as string).trim();
    const to = ((data.To || data.to || '') as string).trim();
    const directionRaw = ((data.Direction || data.direction || '') as string).toLowerCase().trim();
    const callStatus = ((data.CallStatus || data.callStatus || data.Event || data.event || 'unknown') as string).trim();

    // Inbound if explicitly flagged or if no outbound call session identifier exists and 'To' is specified
    const direction: 'inbound' | 'outbound' = directionRaw === 'inbound' || (!queryCallId && !requestUuid && !!to) ? 'inbound' : 'outbound';

    return {
      callId: queryCallId || undefined,
      callUuid: callUuid || requestUuid || alegUuid,
      requestUuid: requestUuid || undefined,
      alegUuid: alegUuid || undefined,
      from,
      to,
      direction,
      callStatus,
    };
  }

  /**
   * POST/GET /api/v2/webhooks/plivo/answer
   *
   * Dedicated Plivo answer webhook handler. Supports both inbound and outbound calls.
   * Inbound calls are routed via InboundCallService.handleInboundCall.
   * Returns clean, valid Plivo XML with bidirectional streaming enabled.
   */
  static async handlePlivoAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const norm = CallController.normalizePlivoPayload(req);

      logger.info('CallController: Plivo answer webhook received', {
        method: req.method,
        callId: norm.callId,
        callUuid: norm.callUuid,
        direction: norm.direction,
      });

      let callId = '';
      let callSession = null;

      // 1. If not explicitly inbound, attempt to find an existing outbound call session
      if (norm.direction !== 'inbound') {
        callSession = await prisma.call.findFirst({
          where: {
            OR: [
              ...(norm.callId ? [{ id: norm.callId }] : []),
              ...(norm.requestUuid ? [{ telemetryId: norm.requestUuid }] : []),
              ...(norm.callUuid ? [{ telemetryId: norm.callUuid }] : []),
              ...(norm.alegUuid ? [{ telemetryId: norm.alegUuid }] : []),
            ],
          },
        });
      }

      // 2. If no existing outbound call session match, route as inbound call via InboundCallService
      let inboundResult: any = null;
      if (!callSession) {
        logger.info('CallController: Routing Plivo call to InboundCallService', {
          callUuid: norm.callUuid,
          from: norm.from,
          to: norm.to,
        });

        inboundResult = await InboundCallService.handleInboundCall({
          CallUUID: norm.callUuid,
          RequestUUID: norm.requestUuid,
          From: norm.from,
          To: norm.to,
          CallStatus: norm.callStatus,
        });

        if (!inboundResult.success) {
          logger.warn('CallController: Plivo inbound call handling failed', {
            error: inboundResult.errorMessage,
            to: norm.to,
            from: norm.from,
          });

          const spoken = inboundResult.spokenMessage || 'This number is currently unavailable. Please try again later.';
          res.set('Content-Type', 'application/xml; charset=utf-8');
          res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${escapeXml(spoken)}</Speak><Hangup/></Response>`);
          return;
        }

        callId = inboundResult.callId!;
      } else {
        callId = callSession.id;

        // Outbound balance alignment check block via unified helper
        const user = await prisma.user.findUnique({ where: { id: callSession.userId } });
        if (user && user.accountType !== 'admin' && user.email !== ADMIN_EMAIL && !hasCallableBalance(user)) {
          logger.warn('CallController: Insufficient balance for Plivo webhook call connection', { callId, userId: user.id });
          await callOrchestrator.endCallSession(callId, 'balance_exhausted', 'Insufficient balance on answer webhook', 'system').catch(() => {});
          res.set('Content-Type', 'application/xml; charset=utf-8');
          res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${escapeXml('This number is currently unavailable. Please try again later.')}</Speak><Hangup/></Response>`);
          return;
        }

        // Update call telemetryId with active CallUUID if provided
        if (norm.callUuid && callSession.telemetryId !== norm.callUuid) {
          await prisma.call.update({
            where: { id: callId },
            data: { telemetryId: norm.callUuid },
          }).catch(() => {});
        }

        await CallService.handleStatusUpdate(callId, 'answered');
      }

      callTimingTracker.mark(callId, 'answer_webhook_received');
      const targetAgentId = callSession?.agentId || (inboundResult as any)?.agentId;
      const targetRecipient = callSession?.recipientPhoneNumber || norm.from || 'Anonymous';
      if (targetAgentId) {
        callOrchestrator.prewarmVoiceSession(callId, targetAgentId, targetRecipient).catch((err) => {
          logger.warn('CallController: Plivo prewarm session background error', { callId, error: String(err) });
        });
      }

      const rawPublicUrl = (env.PUBLIC_URL || (req.headers.host ? `${req.protocol}://${req.headers.host}` : '')).replace(/\/+$/, '');
      const wsUrl = rawPublicUrl.replace(/^http/, 'ws');
      const secret = getWebhookSigningSecret();
      const ts = Date.now();
      const token = crypto.createHmac('sha256', secret).update(`${callId}:${ts}`).digest('hex');
      const rawStreamUrl = `${wsUrl}/audio-stream?callId=${encodeURIComponent(callId)}&token=${encodeURIComponent(token)}&ts=${ts}`;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-l16;rate=16000" extraHeaders="callId=${encodeURIComponent(callId)},token=${encodeURIComponent(token)},ts=${ts}"><![CDATA[${rawStreamUrl}]]></Stream>
</Response>`;

      logger.info('CallController: Plivo answer webhook returning Stream XML', { callId, streamUrl: rawStreamUrl });

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST/GET /api/v2/webhooks/plivo/status
   */
  static async handlePlivoStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const norm = CallController.normalizePlivoPayload(req);

      logger.info('CallController: Plivo status webhook', {
        callId: norm.callId,
        callUuid: norm.callUuid,
        callStatus: norm.callStatus,
      });

      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            ...(norm.callId ? [{ id: norm.callId }] : []),
            ...(norm.requestUuid ? [{ telemetryId: norm.requestUuid }] : []),
            ...(norm.callUuid ? [{ telemetryId: norm.callUuid }] : []),
            ...(norm.alegUuid ? [{ telemetryId: norm.alegUuid }] : []),
          ],
        },
      });

      if (callSession) {
        await CallService.handleStatusUpdate(callSession.id, norm.callStatus);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST/GET /api/v2/webhooks/plivo/hangup
   */
  static async handlePlivoHangup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const norm = CallController.normalizePlivoPayload(req);
      const duration = req.body?.Duration ? parseInt(req.body.Duration as string, 10) : (req.query.Duration ? parseInt(req.query.Duration as string, 10) : 0);
      const hangupCause = String(req.body?.HangupCause || req.query?.HangupCause || '').toUpperCase();
      const hangupSource = String(req.body?.HangupSource || req.query?.HangupSource || '').toLowerCase();

      logger.info('CallController: Plivo hangup webhook', {
        callId: norm.callId,
        callUuid: norm.callUuid,
        duration,
        hangupCause,
        hangupSource,
      });

      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            ...(norm.callId ? [{ id: norm.callId }] : []),
            ...(norm.requestUuid ? [{ telemetryId: norm.requestUuid }] : []),
            ...(norm.callUuid ? [{ telemetryId: norm.callUuid }] : []),
            ...(norm.alegUuid ? [{ telemetryId: norm.alegUuid }] : []),
          ],
        },
      });

      if (callSession) {
        const callId = callSession.id;
        if (duration > 0) {
          await prisma.call.update({
            where: { id: callId },
            data: { durationSeconds: duration },
          }).catch(() => {});
        }

        let mappedReason = 'caller_hangup';
        let endedBy = 'caller';

        if (hangupSource === 'agent' || hangupSource === 'plivo') {
          mappedReason = 'agent_hangup';
          endedBy = 'agent';
        } else if (hangupCause === 'NO_ANSWER' || hangupCause === 'TIMEOUT') {
          mappedReason = 'no_answer';
          endedBy = 'provider';
        } else if (hangupCause === 'BUSY' || hangupCause === 'REJECTED') {
          mappedReason = 'busy';
          endedBy = 'provider';
        } else if (hangupCause === 'FAILED' || hangupCause === 'USER_BUSY') {
          mappedReason = 'provider_error';
          endedBy = 'provider';
        }

        await callOrchestrator.endCallSession(
          callId,
          mappedReason,
          hangupCause ? `Plivo: ${hangupCause} (source: ${hangupSource || 'unknown'})` : undefined,
          endedBy
        );
      }

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v2/webhooks/vobiz/status
   *
   * Called by Vobiz on call status changes (ringing, answered, etc.).
   */
  static async handleVobizStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryCallId = req.query.callId as string;
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;

      // Search database records for an active call matching tracking token or query callId
      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            ...(queryCallId ? [{ id: queryCallId }] : []),
            ...(requestUuid ? [{ telemetryId: requestUuid }] : []),
            ...(callUuid ? [{ telemetryId: callUuid }] : [])
          ]
        }
      });

      if (!callSession) {
        logger.error('handleVobizStatus: Session mismatch', { queryCallId, requestUuid, callUuid });
        res.status(200).send('<Response><Speak>Session mismatch</Speak></Response>');
        return;
      }
      const callId = callSession.id;
      const callStatus = (req.body?.CallStatus as string) || 'unknown';

      logger.info('CallController: Vobiz status webhook', { callId, callStatus, body: req.body });

      await CallService.handleStatusUpdate(callId, callStatus);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v2/webhooks/vobiz/hangup
   *
   * Called by Vobiz when the call is hung up.
   * Triggers session cleanup and finalizes the call.
   */
  static async handleVobizHangup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryCallId = req.query.callId as string;
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;

      // Search database records for an active call matching tracking token or query callId
      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            ...(queryCallId ? [{ id: queryCallId }] : []),
            ...(requestUuid ? [{ telemetryId: requestUuid }] : []),
            ...(callUuid ? [{ telemetryId: callUuid }] : [])
          ]
        }
      });

      if (!callSession) {
        logger.error('handleVobizHangup: Session mismatch', { queryCallId, requestUuid, callUuid });
        res.status(200).send('<Response><Speak>Session mismatch</Speak></Response>');
        return;
      }
      const callId = callSession.id;
      const duration = req.body?.Duration ? parseInt(req.body.Duration as string, 10) : 0;
      const hangupCause = String(req.body?.HangupCause || req.body?.Cause || '').toUpperCase();
      const hangupSource = String(req.body?.HangupSource || '').toLowerCase();

      logger.info('CallController: Vobiz hangup webhook', { callId, duration, hangupCause, hangupSource, body: req.body });

      if (duration > 0) {
        await prisma.call.update({
          where: { id: callId },
          data: { durationSeconds: duration }
        });
      }

      let mappedReason = 'caller_hangup';
      let endedBy = 'caller';

      if (hangupSource === 'agent' || hangupSource === 'platform' || hangupSource === 'vobiz') {
        mappedReason = 'agent_hangup';
        endedBy = 'agent';
      } else if (hangupCause === 'NO_ANSWER' || hangupCause === 'TIMEOUT') {
        mappedReason = 'no_answer';
        endedBy = 'provider';
      } else if (hangupCause === 'BUSY' || hangupCause === 'REJECTED') {
        mappedReason = 'busy';
        endedBy = 'provider';
      }

      // End the runtime session with detailed hangup cause and attribution
      await callOrchestrator.endCallSession(
        callId,
        mappedReason,
        hangupCause ? `Vobiz: ${hangupCause} (source: ${hangupSource || 'unknown'})` : undefined,
        endedBy
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async endActiveCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const callId = String(req.params.id);

      const call = await prisma.call.findFirst({
        where: { id: callId, userId },
      });

      if (!call) {
        res.status(404).json({ success: false, error: 'Call not found' });
        return;
      }

      // One path ends everything: AI session, DB status (completed / user_terminated, billed once),
      // and the carrier leg. Writing a custom 'canceled' status first used to block the real
      // end-of-call bookkeeping and never hung up the phone.
      await CallService.terminateCall(
        callId,
        'user_terminated',
        'Ended by supervisor from live monitoring',
        'user'
      );
      logger.info('CallController: supervisor ended call', { callId });

      res.json({ success: true, message: 'Call terminated successfully' });
    } catch (err: any) {
      logger.error('CallController: Error ending call', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async transferActiveCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      const callId = String(req.params.id);
      const { targetNumber } = req.body;

      const call = await prisma.call.findFirst({
        where: { id: callId, userId },
      });

      if (!call) {
        res.status(404).json({ success: false, error: 'Call not found' });
        return;
      }

      const existingData = call.userData ? JSON.parse(call.userData) : {};
      await prisma.call.update({
        where: { id: callId },
        data: {
          userData: JSON.stringify({
            ...existingData,
            transferredTo: targetNumber || 'human_operator',
            transferredAt: new Date().toISOString(),
          }),
        },
      });

      res.json({
        success: true,
        message: `Call transfer to ${targetNumber || 'human operator'} initiated`,
      });
    } catch (err: any) {
      logger.error('CallController: Error transferring call', { error: err.message });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}
