/**
 * Carrier callbacks for live transfers to a person (/api/v2/webhooks/transfer/:transferId/...).
 * Every URL carries an HMAC of the transfer id (fail-closed, timing-safe); answers are always XML.
 */
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { CallTransferService, verifyTransferSignature } from '../services/CallTransferService';

const router = Router();
const ID = /^[0-9a-f-]{36}$/i;
const EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const HANGUP = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

const transferWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  validate: false,
  handler: (_req, res) => { res.status(429).type('application/xml').send(EMPTY); },
});

function sendXml(res: Response, status: number, xml: string) {
  res.status(status).set('Content-Type', 'application/xml; charset=utf-8').send(xml);
}

function authorised(req: Request): string | null {
  const id = String(req.params.transferId || '');
  return ID.test(id) && verifyTransferSignature(id, req.query.sig) ? id : null;
}

const params = (req: Request): Record<string, unknown> => ({ ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) });

router.all('/:transferId/xml', transferWebhookLimiter, async (req, res) => {
  const id = authorised(req);
  if (!id) { sendXml(res, 403, EMPTY); return; }
  try {
    sendXml(res, 200, await CallTransferService.dialXml(id));
  } catch (err) {
    logger.error('[CALL_TRANSFER] dial XML failed', { transferId: id, error: String(err) });
    sendXml(res, 200, HANGUP);
  }
});

router.all('/:transferId/dial-event', transferWebhookLimiter, async (req, res) => {
  const id = authorised(req);
  if (!id) { sendXml(res, 403, EMPTY); return; }
  try { await CallTransferService.dialEvent(id, params(req)); } catch (err) {
    logger.warn('[CALL_TRANSFER] dial event not stored', { transferId: id, error: String(err) });
  }
  sendXml(res, 200, EMPTY);
});

router.all('/:transferId/dial-result', transferWebhookLimiter, async (req, res) => {
  const id = authorised(req);
  if (!id) { sendXml(res, 403, EMPTY); return; }
  try {
    const fallback = await CallTransferService.fallbackMessageFor(id).catch(() => undefined);
    sendXml(res, 200, await CallTransferService.dialResult(id, params(req), fallback));
  } catch (err) {
    logger.error('[CALL_TRANSFER] dial result failed', { transferId: id, error: String(err) });
    sendXml(res, 200, HANGUP);
  }
});

export default router;
