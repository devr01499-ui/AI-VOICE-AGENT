# Removed Integrations ΓÇö Section A Cleanup

**Date removed**: 2026-11-02  
**Branch**: `section/a-integrations-cleanup`  
**Commit**: `feat(section-a): remove non-functional integrations, keep Google Calendar only`

## Root Cause

The `integrationsRoutes` router was imported in `server/src/index.ts` (line 60) but
**never mounted** with `app.use()`. Every request to `/api/v2/integrations/*` has been
silently returning `404` since the route was first added. No integration listed below
has ever been functional in production.

The integration cards existed in `Frontend/src/app/components/integrations/DashIntegrations.tsx`
(lines 24ΓÇô89) and all called `/api/v2/integrations/*`.

## Integrations Removed

| Integration | Type key | Category | Reason for removal |
|---|---|---|---|
| Cal.com Integration | `calcom` | Calendar & Scheduling | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Zapier Workflow | `zapier` | Automation | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Make.com Scenario | `make` | Automation | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Generic Outbound Webhook | `generic_webhook` | Developer & Webhooks | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Slack Alerting | `slack` | Alerts & Messaging | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Google Sheets / CRM Sync | `google_sheets` | Data & CRM | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| HubSpot CRM (OAuth App) | `hubspot` | CRM & Enterprise | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |
| Salesforce CRM (Connected App) | `salesforce` | CRM & Enterprise | Route `/api/v2/integrations` was never mounted in `server/src/index.ts`; all requests have been returning 404. Integration was non-functional. |

## What Remains

**Google Calendar** is the only supported integration. It operates independently via
`/api/v2/calendar` (mounted at line 321 of `server/src/index.ts`) and has always been
fully functional.

### Google Calendar routes available

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v2/calendar/auth` | Generates OAuth URL and redirects user to Google |
| `GET` | `/api/v2/calendar/callback` | Completes token exchange, saves tokens to DB |
| `GET` | `/api/v2/calendar/status` | Returns `{ connected: boolean }` for current user |
| `DELETE` | `/api/v2/calendar/disconnect` | Clears `googleCalendarTokens` from user record (added in this PR) |
| `DELETE` | `/api/v2/calendar` | Same as `/disconnect` ΓÇö retained as backwards-compatible alias |

## Server-Side Stub

`server/src/routes/integrations.ts` now contains a single catch-all handler that
explicitly returns `404` for all methods and paths, making any stale bookmarks or
curl commands fail with a clear error message instead of an Express default 404.

```typescript
router.all('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'This integration is not available.' });
});
```
