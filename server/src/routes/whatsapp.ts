/**
 * WhatsApp Business connection (customer's own Meta account) and message log.
 *  - /api/v2/whatsapp/*          authenticated; saving credentials is owner/admin only.
 *  - /api/v2/webhooks/whatsapp/* public Meta webhook (verify GET, signed POST).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { requireEditor, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOperationsLimiter } from '../middleware/rateLimiter';
import { WhatsAppService } from '../services/whatsapp/WhatsAppService';
import { AppError } from '../types/errors';

const router = Router();
const ownerOf = (req: AuthenticatedRequest) => String(req.effectiveWorkspaceId || req.userId || req.user?.id || '');

router.get('/account', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const account = await WhatsAppService.getAccount(ownerOf(req));
    // The verify token is a setup value for the owner only.
    const isAdmin = !req.workspaceRole || ['admin', 'owner'].includes(req.workspaceRole) || req.effectiveWorkspaceId === req.userId;
    if (account && !isAdmin) (account as any).verifyToken = undefined;
    res.json({ success: true, data: { connected: Boolean(account), account } });
  } catch (err) { next(err); }
});

router.post('/account', requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const account = await WhatsAppService.connect(ownerOf(req), body);
    res.json({ success: true, data: { connected: true, account } });
  } catch (err) { next(err); }
});

router.post('/account/sync-templates', requireEditor, sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const account = await WhatsAppService.syncTemplates(ownerOf(req));
    res.json({ success: true, data: { connected: true, account } });
  } catch (err) { next(err); }
});

router.delete('/account', requireRole(['admin']), sensitiveOperationsLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const removed = await WhatsAppService.disconnect(ownerOf(req));
    if (!removed) throw new AppError(404, 'NOT_FOUND', 'No WhatsApp number is connected.');
    res.json({ success: true, data: { connected: false } });
  } catch (err) { next(err); }
});

/** Approved templates the agent editor can offer (only ones Claritiy can actually send). */
router.get('/templates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await WhatsAppService.usableTemplates(ownerOf(req));
    res.json({ success: true, data: { connected: Boolean(t), businessName: t?.verifiedName || null, templates: t?.templates || [] } });
  } catch (err) { next(err); }
});

router.get('/messages', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const callId = typeof req.query.callId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.callId) ? req.query.callId : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const beforeRaw = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
    const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : undefined;
    const messages = await WhatsAppService.listMessages(ownerOf(req), { callId, limit: Number.isFinite(limit) ? limit : 50, before });
    res.json({ success: true, data: { messages } });
  } catch (err) { next(err); }
});

export default router;

/** Meta can send many delivery reports at once; still capped per IP. */
const whatsappWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || '127.0.0.1',
  validate: false,
  message: { success: false, error: 'WEBHOOK_RATE_LIMIT_EXCEEDED' },
});

export const whatsappWebhookRouter = Router();
const ACCOUNT_ID = /^[0-9a-f-]{36}$/i;

whatsappWebhookRouter.get('/:accountId', whatsappWebhookLimiter, async (req: Request, res: Response) => {
  const id = String(req.params.accountId || '');
  const challenge = ACCOUNT_ID.test(id)
    ? await WhatsAppService.verifyWebhook(id, req.query['hub.mode'], req.query['hub.verify_token'], req.query['hub.challenge'])
    : null;
  if (challenge === null) { res.status(403).type('text/plain').send('Forbidden'); return; }
  res.status(200).type('text/plain').send(challenge);
});

whatsappWebhookRouter.post('/:accountId', whatsappWebhookLimiter, async (req: Request, res: Response) => {
  const id = String(req.params.accountId || '');
  if (!ACCOUNT_ID.test(id)) { res.status(401).json({ success: false }); return; }
  try {
    const status = await WhatsAppService.handleWebhook(id, (req as any).rawBody, req.headers['x-hub-signature-256'], req.body);
    res.status(status).json({ success: status === 200 });
  } catch {
    // Meta retries on non-2xx; a database blip must not lose the report.
    res.status(500).json({ success: false });
  }
});
