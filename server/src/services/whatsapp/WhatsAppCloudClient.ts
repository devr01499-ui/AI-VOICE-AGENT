/**
 * Meta WhatsApp Cloud API client (Graph API). The customer's OWN WhatsApp Business account is used:
 * Meta requires business-initiated messages to come from the business's verified number, and Meta
 * bills that business directly.
 *
 * - Every request has a timeout and never puts the access token in a URL, log line or error text.
 * - Only approved TEMPLATE messages are sent: a phone caller has not messaged the business on
 *   WhatsApp, so no 24-hour customer-service window is open (free-form text is not allowed).
 * - Tests replace the transport (setWhatsAppTransportForTests); production code runs unchanged.
 */
import { logger } from '../../utils/logger';

const GRAPH_BASE = (process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/+$/, '');
/** Graph API version (latest when this was written: v27.0, November 2026). */
export const GRAPH_VERSION = (process.env.WHATSAPP_GRAPH_VERSION || 'v27.0').trim();
const TIMEOUT_MS = 10_000;

export type GraphTransport = (url: string, init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json: any }>;

const fetchTransport: GraphTransport = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
};

let transport: GraphTransport = fetchTransport;

/** Tests only: route Graph API requests to a stub (null restores the real network). */
export function setWhatsAppTransportForTests(t: GraphTransport | null): void {
  transport = t || fetchTransport;
}

export class WhatsAppApiError extends Error {
  constructor(public readonly status: number, public readonly metaCode: string, message: string) {
    super(message);
  }
}

/** Meta error codes the customer can act on, in plain words. */
function friendlyMetaError(status: number, err: any): string {
  const code = Number(err?.code);
  if (code === 190 || status === 401) return 'The WhatsApp access token is invalid or has expired. Create a new permanent token in Meta Business Settings and save it again.';
  if (code === 10 || code === 200 || status === 403) return 'The access token does not have permission for this WhatsApp account (it needs whatsapp_business_messaging and whatsapp_business_management).';
  if (code === 100) return 'Meta did not recognise one of the IDs. Check the Phone number ID and the WhatsApp Business Account ID.';
  if (code === 131026) return 'This number cannot receive WhatsApp messages (not on WhatsApp, or an old WhatsApp version).';
  if (code === 131047) return 'More than 24 hours have passed since the person last messaged you; only approved templates can be sent.';
  if (code === 131050) return 'The person has stopped marketing messages from your business on WhatsApp.';
  if (code === 132000 || code === 132012) return 'The template variables do not match the approved template.';
  if (code === 132001) return 'The template does not exist in this language, or is not approved yet.';
  if (code === 4 || code === 80007 || code === 130429 || code === 131056) return 'Meta is limiting how fast messages can be sent. Please try again shortly.';
  if (code === 368 || code === 131031) return 'Meta has restricted this WhatsApp account. Check Account Quality in WhatsApp Manager.';
  if (status >= 500) return 'WhatsApp is not responding right now. Please try again shortly.';
  return 'WhatsApp refused the request. Check the account details and template, then try again.';
}

async function graph(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<any> {
  const url = `${GRAPH_BASE}/${GRAPH_VERSION}/${path.replace(/^\/+/, '')}`;
  let res: { status: number; json: any };
  try {
    res = await transport(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Claritiy-Voice/2.0' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    logger.warn('[WHATSAPP_GRAPH] request failed', { method, path: path.split('?')[0], timedOut });
    throw new WhatsAppApiError(504, timedOut ? 'TIMEOUT' : 'NETWORK', 'WhatsApp is not responding right now. Please try again shortly.');
  }
  if (res.status >= 200 && res.status < 300 && !res.json?.error) return res.json;
  const err = res.json?.error || {};
  logger.warn('[WHATSAPP_GRAPH] Meta returned an error', { method, path: path.split('?')[0], status: res.status, code: err.code, subcode: err.error_subcode, fbtrace: err.fbtrace_id });
  throw new WhatsAppApiError(res.status, String(err.code ?? res.status), friendlyMetaError(res.status, err));
}

export interface PhoneNumberInfo { displayPhoneNumber: string | null; verifiedName: string | null; qualityRating: string | null }

export async function fetchPhoneNumber(phoneNumberId: string, token: string): Promise<PhoneNumberInfo> {
  const j = await graph('GET', `${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`, token);
  return { displayPhoneNumber: j.display_phone_number || null, verifiedName: j.verified_name || null, qualityRating: j.quality_rating || null };
}

export interface MetaTemplate { name: string; language: string; status: string; category: string; components: any[] }

/** All templates of the WhatsApp Business Account (at most 500, 5 pages). */
export async function fetchTemplates(wabaId: string, token: string): Promise<MetaTemplate[]> {
  const out: MetaTemplate[] = [];
  let after = '';
  for (let page = 0; page < 5; page++) {
    const q = `fields=name,language,status,category,components&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const j = await graph('GET', `${encodeURIComponent(wabaId)}/message_templates?${q}`, token);
    for (const t of Array.isArray(j.data) ? j.data : []) {
      out.push({ name: String(t.name || ''), language: String(t.language || ''), status: String(t.status || ''), category: String(t.category || ''), components: Array.isArray(t.components) ? t.components : [] });
    }
    after = j.paging?.cursors?.after && j.paging?.next ? j.paging.cursors.after : '';
    if (!after) break;
  }
  return out;
}

/** Subscribes the token's app to the account's webhooks (needed for delivery reports). */
export async function subscribeApp(wabaId: string, token: string): Promise<void> {
  await graph('POST', `${encodeURIComponent(wabaId)}/subscribed_apps`, token, {});
}

export interface TemplateSend {
  to: string; // E.164
  templateName: string;
  language: string;
  /** Body variables in order ({{1}}, {{2}} ...) or by name for named-parameter templates. */
  bodyParams: Array<{ value: string; name?: string }>;
}

/** Sends an approved template. Returns Meta's message id (wamid...). */
export async function sendTemplate(phoneNumberId: string, token: string, msg: TemplateSend): Promise<string> {
  const components = msg.bodyParams.length
    ? [{ type: 'body', parameters: msg.bodyParams.map((p) => (p.name ? { type: 'text', parameter_name: p.name, text: p.value } : { type: 'text', text: p.value })) }]
    : [];
  const j = await graph('POST', `${encodeURIComponent(phoneNumberId)}/messages`, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to.replace(/^\+/, ''),
    type: 'template',
    template: { name: msg.templateName, language: { code: msg.language }, ...(components.length ? { components } : {}) },
  });
  const id = j?.messages?.[0]?.id;
  if (!id) throw new WhatsAppApiError(502, 'NO_MESSAGE_ID', 'WhatsApp did not confirm the message. Please try again.');
  return String(id);
}
