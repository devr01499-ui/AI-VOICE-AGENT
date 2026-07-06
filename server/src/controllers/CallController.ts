/**
 * Bolna Server — Call Controller
 *
 * Thin HTTP translation layer between Express routes and the CallService.
 * No business logic here — only request parsing, service delegation,
 * and response formatting.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { CallService } from '../services/CallService';
import { callOrchestrator } from '../core/orchestrator/CallOrchestrator';
import { env } from '../config/env';
import { prisma } from '../config/database';

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
      const userId = body.userId;
      const userData = body.userData;
      const maxDuration = body.maxDuration;
      const fromPhoneNumber = body.fromPhoneNumber;
      if (!agentId) {
        res.status(400).json({ success: false, error: 'agentId is required' });
        return;
      }

      // Default userId for development (auth is bypassed)
      const effectiveUserId = userId ?? 'dev-user-001';

      // Seed/upsert MVP Agent & User dynamically if they do not exist to prevent foreign key errors
      const prisma = (await import('../config/database')).prisma;

      // 1. Ensure user exists
      await prisma.user.upsert({
        where: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
        update: {},
        create: {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          email: "devr01499@gmail.com",
          fullName: "devr01499",
          passwordHash: "$2b$10$UnSeededPasswordHashPlaceholder",
        }
      });

      // 2. Ensure agent exists
      await prisma.agent.upsert({
        where: { id: agentId },
        update: {
          name: "Clarity HR Customer Support Screener",
          systemPrompt: "You are Clarity AI, a highly professional senior HR recruiter running a phone screening interview for a Customer Support role. Speak in a warm, friendly, smooth, and highly conversational tone, just like a supportive human interviewer. Pause naturally and wait for candidate responses. Never output markdown formatting or bullet points. Your screening flow consists of three distinct questions: 1. \"First, could you share a specific situation where you successfully resolved a conflict with a frustrated customer?\" 2. \"Second, how do you manage high call volumes while keeping a positive and warm tone throughout the day?\" 3. \"And finally, what are your expected salary bounds for this Customer Support position?\" Be polite, listen actively, and say \"uh-huh\" or \"got it\" when they finish speaking to show smooth, realistic turn-taking. If they talk over you, stop speaking immediately.",
          voiceName: "Puck",
          model: "models/gemini-2.5-flash-native-audio-latest",
          status: "active"
        },
        create: {
          id: agentId,
          name: "Clarity HR Customer Support Screener",
          systemPrompt: "You are Clarity AI, a highly professional senior HR recruiter running a phone screening interview for a Customer Support role. Speak in a warm, friendly, smooth, and highly conversational tone, just like a supportive human interviewer. Pause naturally and wait for candidate responses. Never output markdown formatting or bullet points. Your screening flow consists of three distinct questions: 1. \"First, could you share a specific situation where you successfully resolved a conflict with a frustrated customer?\" 2. \"Second, how do you manage high call volumes while keeping a positive and warm tone throughout the day?\" 3. \"And finally, what are your expected salary bounds for this Customer Support position?\" Be polite, listen actively, and say \"uh-huh\" or \"got it\" when they finish speaking to show smooth, realistic turn-taking. If they talk over you, stop speaking immediately.",
          voiceName: "Puck",
          model: "models/gemini-2.5-flash-native-audio-latest",
          userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          status: "active"
        }
      });

      const result = await CallService.createCall({
        phoneNumber,
        agentId,
        userId: effectiveUserId,
        userData,
        maxDuration,
        fromPhoneNumber,
      });

      res.status(201).json({
        success: true,
        callId: result.callId,
        data: result,
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
      const transcript = await CallService.getCallTranscript(callId);

      res.json({
        success: true,
        data: transcript,
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
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;

      // Search database records for an active call matching either tracking token
      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            { id: requestUuid },
            { id: callUuid },
            { telemetryId: requestUuid }
          ]
        }
      });

      if (!callSession) {
        res.status(200).send('<Response><Speak>Session mismatch</Speak></Response>');
        return;
      }
      const callId = callSession.id;

      logger.info('CallController: Vobiz answer webhook', { callId });

      // Update status to connected
      await CallService.handleStatusUpdate(callId, 'answered');

      // Return XML to tell Vobiz to stream audio to our WebSocket
      const publicUrl = env.PUBLIC_URL;
      const wsUrl = publicUrl.replace(/^http/, 'ws');
      const streamUrl = `${wsUrl}/audio-stream?callId=${callId}`;

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream streamTimeout="1800" keepCallAlive="true" bidirectional="true" contentType="audio/x-l16;rate=16000">
    ${streamUrl}
  </Stream>
</Response>`;

      res.set('Content-Type', 'application/xml');
      res.send(xml);
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
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;

      // Search database records for an active call matching either tracking token
      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            { id: requestUuid },
            { id: callUuid },
            { telemetryId: requestUuid }
          ]
        }
      });

      if (!callSession) {
        res.status(200).send('<Response><Speak>Session mismatch</Speak></Response>');
        return;
      }
      const callId = callSession.id;
      const callStatus = (req.body?.CallStatus as string) || 'unknown';

      logger.info('CallController: Vobiz status webhook', { callId, callStatus });

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
      const requestUuid = req.body?.RequestUUID as string;
      const callUuid = req.body?.CallUUID as string;

      // Search database records for an active call matching either tracking token
      const callSession = await prisma.call.findFirst({
        where: {
          OR: [
            { id: requestUuid },
            { id: callUuid },
            { telemetryId: requestUuid }
          ]
        }
      });

      if (!callSession) {
        res.status(200).send('<Response><Speak>Session mismatch</Speak></Response>');
        return;
      }
      const callId = callSession.id;
      const duration = req.body?.Duration ? parseInt(req.body.Duration as string, 10) : 0;

      logger.info('CallController: Vobiz hangup webhook', { callId, duration });

      if (duration > 0) {
        await prisma.call.update({
          where: { id: callId },
          data: { durationSeconds: duration }
        });
      }

      // End the runtime session
      await callOrchestrator.endCallSession(callId, 'user_hangup');

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
