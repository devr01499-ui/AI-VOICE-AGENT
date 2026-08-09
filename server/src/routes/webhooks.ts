/**
 * Bolna Server — Webhook Routes
 *
 * Endpoints that Vobiz hits during call lifecycle events.
 * These are registered as answer_url, ring_url, and hangup_url
 * when initiating outbound calls.
 */

import { Router } from 'express';
import { CallController } from '../controllers/CallController';
import { verifyVobizWebhook } from '../middleware/vobizWebhook';

const router = Router();

/**
 * POST /api/v2/webhooks/vobiz/answer
 *
 * Called when the recipient answers. Returns XML with a <Stream>
 * directive that tells Vobiz to open a bidirectional WebSocket
 * audio stream to our server.
 */
router.post('/vobiz/answer', verifyVobizWebhook, CallController.handleVobizAnswer);

/**
 * POST /api/v2/webhooks/vobiz/status
 *
 * Called on call status transitions: ringing, answered, etc.
 * Updates the call record in the database.
 */
router.post('/vobiz/status', verifyVobizWebhook, CallController.handleVobizStatus);

/**
 * POST /api/v2/webhooks/vobiz/hangup
 *
 * Called when the call is hung up (by either party).
 * Triggers session cleanup and transcript finalization.
 */
router.post('/vobiz/hangup', verifyVobizWebhook, CallController.handleVobizHangup);

export default router;
