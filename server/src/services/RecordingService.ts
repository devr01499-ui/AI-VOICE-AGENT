import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getWebhookSigningSecret } from '../utils/security';

/**
 * Call recordings.
 *
 * How it works:
 *  1. Recording happens at the CARRIER (both sides mixed, a playable file), only when the agent's
 *     recording setting is on. The answer XML first plays a short recording notice (consent), then
 *     starts a session recording, then streams the call to the AI.
 *  2. The carrier posts the finished recording link to our callback; the callback URL carries an
 *     HMAC token for that call, so nobody else can attach a recording to a call.
 *  3. Nobody gets the carrier link. The owner asks for a playback link (authenticated, ownership
 *     checked) and receives a short-lived signed URL to our own stream endpoint, which fetches the
 *     file from the carrier server-side (allow-listed hosts only, no redirects) and passes Range
 *     requests through so the player can seek.
 *
 * (The old in-process recorder concatenated AI audio and caller audio of different sample rates
 * into one raw .pcm file, capped at a few minutes, and was never asked of the carrier: no playable
 * recording could exist. It is removed.)
 */

export const DEFAULT_RECORDING_NOTICE = 'This call is recorded for quality and training purposes.';
const CALLBACK_TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // recordings arrive after the call ends (max 60 min)
export const PLAYBACK_LINK_TTL_MS = 5 * 60 * 1000;
const MAX_NOTICE_CHARS = 200;

/** Carrier hosts that may serve recordings (extend with RECORDING_HOST_ALLOWLIST, comma-separated). */
function allowedRecordingHosts(): string[] {
  const extra = (process.env.RECORDING_HOST_ALLOWLIST || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return ['plivo.com', 'vobiz.ai', ...extra];
}

export function isAllowedRecordingUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return allowedRecordingHosts().some((h) => host === h || host.endsWith(`.${h}`));
}

function hmac(parts: string): string {
  return crypto.createHmac('sha256', getWebhookSigningSecret()).update(parts).digest('hex');
}
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** The agent's recording choice (same keys the call orchestrator reads). */
export function agentRecordingSettings(agentConfig: unknown): { enabled: boolean; notice: string } {
  let cfg: any = {};
  try { cfg = typeof agentConfig === 'string' ? JSON.parse(agentConfig || '{}') : (agentConfig || {}); } catch { cfg = {}; }
  // The editor saves callSettings.recordingEnabled / recordingNotice; older keys are still honoured.
  const enabled = Boolean(cfg.callSettings?.recordingEnabled ?? cfg.isRecordingEnabled ?? cfg.settings?.isRecordingEnabled ?? false);
  const rawNotice = cfg.callSettings?.recordingNotice ?? cfg.recordingNotice ?? cfg.settings?.recordingNotice;
  const custom = typeof rawNotice === 'string' ? rawNotice.trim() : '';
  // The notice cannot be switched off while recording is on; a custom text must still mention recording.
  const notice = custom && /record/i.test(custom) && custom.length <= MAX_NOTICE_CHARS ? custom : DEFAULT_RECORDING_NOTICE;
  return { enabled, notice };
}

/**
 * XML placed before <Stream> in the answer: the spoken notice, then a background session
 * recording whose result is posted to our signed callback. Empty when recording is off.
 */
export function recordingXml(callId: string, publicUrl: string, agentConfig: unknown, now = Date.now()): string {
  const { enabled, notice } = agentRecordingSettings(agentConfig);
  if (!enabled || !publicUrl) return '';
  const exp = now + CALLBACK_TOKEN_TTL_MS;
  const sig = hmac(`rec-cb:${callId}:${exp}`);
  const callbackUrl = `${publicUrl.replace(/\/+$/, '')}/api/v2/webhooks/recording?c=${encodeURIComponent(callId)}&e=${exp}&s=${sig}`;
  return [
    `  <Speak>${escapeXml(notice)}</Speak>`,
    `  <Record recordSession="true" maxLength="3600" fileFormat="mp3" redirect="false" callbackUrl="${escapeXml(callbackUrl)}" callbackMethod="POST"/>`,
  ].join('\n');
}

/** POST /api/v2/webhooks/recording — the carrier tells us where the finished recording is. */
export async function handleRecordingCallback(req: Request, res: Response): Promise<void> {
  const callId = String(req.query.c || '');
  const exp = Number(req.query.e || 0);
  const sig = String(req.query.s || '');
  if (!callId || !Number.isFinite(exp) || !sig || !safeEqual(sig, hmac(`rec-cb:${callId}:${exp}`))) {
    res.status(403).json({ success: false, error: 'Invalid recording callback' });
    return;
  }
  if (Date.now() > exp) {
    res.status(410).json({ success: false, error: 'Recording callback expired' });
    return;
  }
  const body: any = req.body || {};
  const url = body.RecordUrl || body.record_url || body.RecordingUrl || body.recording_url;
  if (!isAllowedRecordingUrl(url)) {
    logger.warn('Recording callback with a missing or non-carrier URL ignored', { callId });
    res.status(200).json({ success: true, ignored: true });
    return;
  }
  await prisma.call.updateMany({ where: { id: callId }, data: { recordingUrl: url } });
  logger.info('Recording stored for call', { callId, durationSeconds: body.RecordingDuration || body.recording_duration });
  res.status(200).json({ success: true });
}

/** Owner-only, short-lived link to our stream endpoint (the carrier link is never shown). */
export async function createPlaybackLink(userId: string, callId: string, now = Date.now()): Promise<{ url: string; downloadUrl: string; expiresAt: string } | null> {
  const call = await prisma.call.findFirst({ where: { id: callId, userId }, select: { id: true, recordingUrl: true } });
  if (!call || !isAllowedRecordingUrl(call.recordingUrl)) return null;
  const exp = now + PLAYBACK_LINK_TTL_MS;
  const sig = hmac(`rec-play:${callId}:${userId}:${exp}`);
  const url = `/api/v2/recordings/${encodeURIComponent(callId)}/stream?u=${encodeURIComponent(userId)}&e=${exp}&s=${sig}`;
  return { url, downloadUrl: `${url}&download=1`, expiresAt: new Date(exp).toISOString() };
}

/** GET /api/v2/recordings/:callId/stream — signed, short-lived; streams the file with Range support. */
export async function streamRecording(req: Request, res: Response): Promise<void> {
  const callId = String(req.params.callId || '');
  const userId = String(req.query.u || '');
  const exp = Number(req.query.e || 0);
  const sig = String(req.query.s || '');
  if (!callId || !userId || !sig || !safeEqual(sig, hmac(`rec-play:${callId}:${userId}:${exp}`))) {
    res.status(403).json({ success: false, error: 'Invalid recording link' });
    return;
  }
  if (Date.now() > exp) {
    res.status(410).json({ success: false, error: 'This recording link has expired. Open the recording again.' });
    return;
  }
  const call = await prisma.call.findFirst({ where: { id: callId, userId }, select: { recordingUrl: true } });
  if (!call || !isAllowedRecordingUrl(call.recordingUrl)) {
    res.status(404).json({ success: false, error: 'Recording not found' });
    return;
  }
  let upstream: globalThis.Response;
  try {
    const headers: Record<string, string> = {};
    if (typeof req.headers.range === 'string' && /^bytes=\d*-\d*$/.test(req.headers.range)) headers.Range = req.headers.range;
    upstream = await fetch(call.recordingUrl, { headers, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch (err: any) {
    logger.error('Recording fetch from carrier failed', { callId, error: err?.message });
    res.status(502).json({ success: false, error: 'The recording could not be loaded. Please try again.' });
    return;
  }
  if (upstream.status !== 200 && upstream.status !== 206) {
    res.status(upstream.status === 404 ? 404 : 502).json({ success: false, error: 'The recording is not available.' });
    return;
  }
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="call-${callId}.mp3"`);
  if (!upstream.body) { res.end(); return; }
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) await new Promise((r) => res.once('drain', r));
    }
  } catch (err: any) {
    logger.warn('Recording stream interrupted', { callId, error: err?.message });
  } finally {
    res.end();
  }
}

/**
 * Deletes a recording at the carrier (data retention / DPDP). Best effort: returns false when it
 * could not be confirmed, so the caller can alert a person. The recording id is the file name.
 */
export async function deleteCarrierRecording(recordingUrl: string): Promise<boolean> {
  if (!isAllowedRecordingUrl(recordingUrl)) return false;
  const u = new URL(recordingUrl);
  const recordingId = (u.pathname.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
  if (!/^[A-Za-z0-9-]{8,80}$/.test(recordingId)) return false;
  try {
    let res: globalThis.Response;
    if (u.hostname.endsWith('plivo.com')) {
      const id = process.env.PLIVO_AUTH_ID; const token = process.env.PLIVO_AUTH_TOKEN;
      if (!id || !token) return false;
      res = await fetch(`https://api.plivo.com/v1/Account/${id}/Recording/${recordingId}/`, {
        method: 'DELETE', headers: { Authorization: `Basic ${Buffer.from(`${id}:${token}`).toString('base64')}` }, signal: AbortSignal.timeout(10_000),
      });
    } else {
      const id = process.env.VOBIZ_AUTH_ID; const token = process.env.VOBIZ_AUTH_TOKEN;
      const base = (process.env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
      if (!id || !token) return false;
      res = await fetch(`${base}/api/v1/Account/${id}/Recording/${recordingId}/`, {
        method: 'DELETE', headers: { 'X-Auth-ID': id, 'X-Auth-Token': token }, signal: AbortSignal.timeout(10_000),
      });
    }
    return res.status === 204 || res.status === 200 || res.status === 404;
  } catch {
    return false;
  }
}
