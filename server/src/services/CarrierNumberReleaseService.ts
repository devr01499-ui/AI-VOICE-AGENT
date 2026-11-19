import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Gives a phone number back to its carrier so Claritiy's master account stops paying its monthly
 * fee. One place for both carriers, using only documented endpoints:
 *  - Vobiz "Unrent a Number": DELETE /api/v1/Account/{MA}/numbers/{e164}. A DID that sits on a
 *    sub-account is first returned to the master pool ("Unassign DID from Sub-Account": DELETE
 *    /api/v1/account/{MA}/numbers/{e164}/assign-subaccount), which Vobiz refuses with
 *    409 did_cool_off_in_effect for 15 days after the number's last call.
 *  - Plivo "Unrent a number": DELETE /v1/Account/{auth_id}/Number/{number}/.
 * A 404 means the carrier no longer has the number (already released).
 */
export type ReleaseOutcome =
  | { result: 'released' | 'already_gone' }
  | { result: 'cool_off'; retryAfter: Date | null }
  | { result: 'failed'; detail: string };

export interface ReleasableNumber {
  phoneNumber: string;
  telephonyProvider?: string | null;
}

function vobizBase(): string {
  return `${(env.VOBIZ_API_URL || 'https://api.vobiz.ai').replace(/\/+$/, '').replace(/\/api\/v1$/i, '')}/api/v1`;
}

function vobizConfigured(): boolean {
  const id = (env.VOBIZ_AUTH_ID || '').trim();
  return Boolean(id && env.VOBIZ_AUTH_TOKEN && id !== 'MA_PLACEHOLDER' && !id.includes('placeholder'));
}

async function releaseOnVobiz(e164: string): Promise<ReleaseOutcome> {
  if (!vobizConfigured()) return { result: 'failed', detail: 'carrier credentials not configured' };
  const masterId = String(env.VOBIZ_AUTH_ID).trim();
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Auth-ID': masterId, 'X-Auth-Token': String(env.VOBIZ_AUTH_TOKEN) };
  const num = encodeURIComponent(e164);
  const unrent = () => fetch(`${vobizBase()}/Account/${masterId}/numbers/${num}`, { method: 'DELETE', headers });

  let res = await unrent();
  if (res.ok) return { result: 'released' };
  if (res.status === 404) return { result: 'already_gone' };

  // Still on the customer's sub-account: return it to the master pool, then unrent.
  const unassign = await fetch(`${vobizBase()}/account/${masterId}/numbers/${num}/assign-subaccount`, { method: 'DELETE', headers });
  if (unassign.status === 409) {
    const body: any = await unassign.json().catch(() => ({}));
    const until = body?.cool_off_until ? new Date(body.cool_off_until) : null;
    return { result: 'cool_off', retryAfter: until && !Number.isNaN(until.getTime()) ? until : null };
  }
  if (!unassign.ok && unassign.status !== 404) {
    return { result: 'failed', detail: `unassign ${unassign.status}` };
  }
  res = await unrent();
  if (res.ok) return { result: 'released' };
  if (res.status === 404) return { result: 'already_gone' };
  return { result: 'failed', detail: `unrent ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
}

export async function releaseCarrierNumber(number: ReleasableNumber): Promise<ReleaseOutcome> {
  const provider = String(number.telephonyProvider || 'vobiz').toLowerCase();
  try {
    if (provider === 'plivo') {
      const { PlivoService } = await import('../core/telephony/PlivoService');
      const r = await new PlivoService().unrentNumber(number.phoneNumber);
      if (r === 'released' || r === 'already_gone') return { result: r };
      return { result: 'failed', detail: r };
    }
    return await releaseOnVobiz(number.phoneNumber);
  } catch (err) {
    logger.error('CarrierNumberRelease: carrier request error', { provider, error: String(err) });
    return { result: 'failed', detail: String(err) };
  }
}
