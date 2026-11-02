import { Router } from 'express';

/**
 * DISABLED: Third-party integrations route.
 *
 * This router was previously connected to IntegrationsController but was NEVER
 * mounted in server/src/index.ts, meaning every request silently 404-ed.
 * All integration cards (Cal.com, Zapier, Make.com, Generic Webhook, Slack,
 * Google Sheets, HubSpot, Salesforce) have been removed from the frontend.
 *
 * The only supported integration is Google Calendar, which operates via the
 * fully mounted /api/v2/calendar route.
 *
 * See: server/docs/removed-integrations.md
 */
const router = Router();

router.all('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'This integration is not available.' });
});

export default router;
