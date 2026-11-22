/**
 * The customer API exactly as production mounts it (server/src/index.ts), for local checks against
 * the TEST database. Only the Supabase token check is replaced: `tokenToUser(token)` decides who a
 * bearer token belongs to. Callers must load ./testDbGuard.cjs first.
 */
const express = require('express');
const path = require('path');
const d = (p) => require(path.join(__dirname, '../../dist', p));

function installAuthStub(tokenToUser) {
  const { supabaseClient } = d('utils/supabase');
  supabaseClient.auth.getUser = async (token) => {
    const user = await tokenToUser(token);
    if (!user) return { data: { user: null }, error: { message: 'invalid' } };
    const now = new Date().toISOString();
    // Like a real Supabase session: sign-up stores the person's name in user_metadata.full_name
    // (requireAuth copies it to the user row on every request).
    return { data: { user: { id: user.id, email: user.email, email_confirmed_at: now, user_metadata: { email_confirmed_at: now, ...(user.fullName ? { full_name: user.fullName } : {}) } } }, error: null };
  };
}

function buildApp({ corsOrigin } = {}) {
  const app = express();
  if (corsOrigin) {
    const cors = require('cors');
    app.use(cors({ origin: corsOrigin, credentials: true }));
  }
  // Like src/index.ts: keep the raw body for signed webhooks (WhatsApp X-Hub-Signature-256).
  app.use(express.json({ limit: '25mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true }));
  app.use(d('middleware/requestId').requestIdMiddleware);
  app.use(d('middleware/rejectNullCharacters').rejectNullCharacters);
  app.use(d('utils/whiteLabel').whiteLabelResponses);
  const { requireAuth } = d('middleware/auth');
  const { requireAuthOrApiKey } = d('middleware/authWrapper');
  app.use('/api/v2/calls', requireAuthOrApiKey, d('routes/calls').default);
  app.use('/api/v2/agents', requireAuth, d('routes/agents').default);
  app.use('/api/v2/numbers', requireAuth, d('routes/numbers').default);
  app.use('/api/v2/knowledge-base', requireAuth, d('routes/knowledgeBase').default);
  d('routes/user').mountUserRoutes(app, requireAuth);
  app.use('/api/v2/team', requireAuth, d('routes/team').default);
  app.use('/api/v2/apikeys', requireAuth, d('routes/apikeys').default);
  app.use('/api/v2/calendar', d('routes/calendar').default);
  app.use('/api/v2/kyc', d('routes/kyc').default);
  app.use('/api/v2/billing', requireAuth, d('routes/billing').default);
  app.use('/api/v2/chat-history', requireAuth, d('routes/chatHistory').default);
  app.use('/api/v2/contacts', requireAuth, d('routes/contacts').default);
  app.use('/api/v2/whatsapp', requireAuth, d('routes/whatsapp').default);
  app.use('/api/v2/webhooks/whatsapp', d('routes/whatsapp').whatsappWebhookRouter);
  app.use('/api/v2/webhooks/transfer', d('routes/transferWebhooks').default);
  app.use('/api/v2/analytics', requireAuth, d('routes/analytics').default);
  app.use('/api/v2/qa', requireAuth, d('routes/qa').default);
  app.use('/api/v2/alerting', requireAuth, d('routes/alerting').default);
  app.use('/api/v2/audit-logs', requireAuth, d('routes/auditLog').default);
  app.use('/api/v2/reports', requireAuth, d('routes/reports').default);
  app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));
  app.use(d('utils/errorHandler').errorHandler);
  return app;
}

module.exports = { buildApp, installAuthStub };
