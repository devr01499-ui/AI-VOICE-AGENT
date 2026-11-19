/**
 * Claritiy Voice Server — Webhook Routes
 *
 * Endpoints that Vobiz hits during call lifecycle events.
 * These are registered as answer_url, ring_url, and hangup_url
 * when initiating outbound calls.
 */

import { Router } from 'express';
import { CallController } from '../controllers/CallController';
import { verifyVobizWebhook } from '../middleware/vobizWebhook';
import { verifyPlivoWebhook } from '../middleware/plivoWebhook';
import { handleRecordingCallback, streamRecording } from '../services/RecordingService';
import { webhookRateLimiter, generalApiLimiter } from '../middleware/rateLimiter';

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

/**
 * ─────────────────────────────────────────────
 * PLIVO XML & VOICE APPLICATION WEBHOOKS
 * ─────────────────────────────────────────────
 */

/**
 * ALL /api/v2/webhooks/plivo/answer
 * Returns Plivo XML <Stream> directive with clean WebSocket URL and extraHeaders.
 */
router.all('/plivo/answer', verifyPlivoWebhook, CallController.handlePlivoAnswer);

/**
 * ALL /api/v2/webhooks/plivo/status
 * Plivo call status transitions: ringing, answered, in-progress, etc.
 */
router.all('/plivo/status', verifyPlivoWebhook, CallController.handlePlivoStatus);

/**
 * ALL /api/v2/webhooks/plivo/hangup
 * Plivo call termination: triggers session cleanup, metrics, and transcript finalization.
 */
router.all('/plivo/hangup', verifyPlivoWebhook, CallController.handlePlivoHangup);

/**
 * ALL /api/v2/webhooks/plivo/fallback
 * Plivo fallback route if primary Answer URL encounters network timeout.
 */
router.all('/plivo/fallback', verifyPlivoWebhook, CallController.handlePlivoAnswer);

/**
 * POST /api/v2/webhooks/plivo/compliance
 * Plivo business-KYC review result (submitted -> accepted / rejected). The payload format is not
 * documented, so it is only a trigger: the state is read back from Plivo's Compliance API.
 */
router.post('/plivo/compliance', webhookRateLimiter, verifyPlivoWebhook, async (req, res) => {
  try {
    const { PlivoComplianceService } = await import('../services/PlivoComplianceService');
    const svc = new PlivoComplianceService();
    const complianceId = String((req.body && (req.body.compliance_id || req.body.ComplianceId)) || '');
    const { prisma } = await import('../lib/prisma');
    const app = complianceId ? await prisma.plivoComplianceApplication.findUnique({ where: { complianceId }, select: { userId: true } }) : null;
    if (app) await svc.refresh(app.userId);
    else await svc.refreshPending();
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(200).json({ success: false });
  }
});

/**
 * POST /api/v2/webhooks/recording — carrier posts the finished recording link. Authorised by the
 * per-call HMAC token in the callback URL (see RecordingService).
 */
router.post('/recording', webhookRateLimiter, handleRecordingCallback);

export default router;

/** Public router for /api/v2/recordings — signed, short-lived playback links only. */
export const recordingStreamRouter = Router();
recordingStreamRouter.get('/:callId/stream', generalApiLimiter, streamRecording);
