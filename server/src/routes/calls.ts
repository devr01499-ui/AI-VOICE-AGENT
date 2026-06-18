/**
 * Bolna Server — Call Routes
 *
 * Maps HTTP endpoints to CallController methods with validation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { CallController } from '../controllers/CallController';
import { validateBody, validateParams } from '../middleware/validation';

const router = Router();

// ─── Validation Schemas ──────────────────────────

const initiateCallSchema = z.object({
  phoneNumber: z
    .string()
    .min(7, 'Phone number too short')
    .max(16, 'Phone number too long'),
  agentId: z.string().uuid('agentId must be a valid UUID'),
  userId: z.string().optional(),
  userData: z.record(z.unknown()).optional(),
  maxDuration: z.number().int().min(30).max(7200).optional(),
});

const callIdParamSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
});

// ─── Routes ──────────────────────────────────────

/** POST /api/v2/calls — Initiate a new outbound call. */
router.post(
  '/',
  validateBody(initiateCallSchema),
  CallController.initiateCall
);

/** GET /api/v2/calls/:callId — Get call status and details. */
router.get(
  '/:callId',
  validateParams(callIdParamSchema),
  CallController.getCallStatus
);

/** POST /api/v2/calls/:callId/terminate — End an active call. */
router.post(
  '/:callId/terminate',
  validateParams(callIdParamSchema),
  CallController.terminateCall
);

/** GET /api/v2/calls/:callId/transcript — Get call transcript. */
router.get(
  '/:callId/transcript',
  validateParams(callIdParamSchema),
  CallController.getCallTranscript
);

export default router;
