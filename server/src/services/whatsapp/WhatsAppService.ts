/**
 * WhatsApp messages from voice agents (replaces the never-working SMS step).
 *
 * Meta policy, implemented here (docs/COMPLIANCE_NOTES.md "WhatsApp"):
 *  - The customer connects THEIR OWN WhatsApp Business number; messages are sent in their name.
 *  - Opt-in first: the agent asks the caller, naming the business and WhatsApp, and sends only after
 *    a clear yes. The consent (call, time, transcript excerpt) is stored before the message is sent.
 *  - Only APPROVED templates (utility or marketing) are sent; one-time-passcode templates, media
 *    headers and variable buttons are refused. Variables are cleaned the way Meta requires.
 *  - Only to the person on the call (never a number the AI chooses), at most 3 messages per call and
 *    5 per person per 24 hours, each template once per call.
 *  - "STOP" (and similar) on WhatsApp opts the person out; later sends are refused.
 *  - Webhooks are fail-closed: signature (X-Hub-Signature-256, the customer's app secret) checked
 *    with a timing-safe compare before anything is read.
 */
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { AppError } from '../../types/errors';
import { EncryptionService } from '../../utils/EncryptionService';
import { normalizePhoneNumber } from '../../utils/phoneValidator';
import { hasActivePaidPlan } from '../../middleware/planValidation';
import { fetchPhoneNumber, fetchTemplates, sendTemplate, subscribeApp, WhatsAppApiError, type MetaTemplate } from './WhatsAppCloudClient';

export const MAX_WHATSAPP_PER_CALL = 3;
export const MAX_WHATSAPP_PER_RECIPIENT_PER_DAY = 5;
const MAX_VARIABLE_LENGTH = 300;

export interface AnalysedTemplate {
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  variables: Array<{ key: string; named: boolean }>;
  usable: boolean;
  unusableReason?: string;
}

/** What Claritiy can send of a Meta template, and why not when it cannot. */
export function analyseTemplate(t: MetaTemplate): AnalysedTemplate {
  const body = t.components.find((c: any) => String(c?.type).toUpperCase() === 'BODY');
  const header = t.components.find((c: any) => String(c?.type).toUpperCase() === 'HEADER');
  const buttons = t.components.find((c: any) => String(c?.type).toUpperCase() === 'BUTTONS');
  const bodyText = String(body?.text || '');
  const keys: string[] = [];
  for (const m of bodyText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) if (!keys.includes(m[1])) keys.push(m[1]);
  const named = keys.some((k) => !/^\d+$/.test(k));
  const ordered = named ? keys : [...keys].sort((a, b) => Number(a) - Number(b));
  const out: AnalysedTemplate = {
    name: t.name, language: t.language, category: t.category.toUpperCase(), status: t.status.toUpperCase(), bodyText,
    variables: ordered.map((key) => ({ key, named })), usable: true,
  };
  const refuse = (why: string) => { out.usable = false; out.unusableReason = why; return out; };
  if (out.status !== 'APPROVED') return refuse(`Not approved by Meta yet (status ${out.status || 'unknown'}).`);
  if (out.category === 'AUTHENTICATION') return refuse('One-time passcode templates cannot be sent by a voice agent.');
  if (header) {
    const fmt = String(header.format || 'TEXT').toUpperCase();
    if (fmt !== 'TEXT') return refuse(`The header needs a ${fmt.toLowerCase()} file, which a voice agent cannot attach.`);
    if (/\{\{/.test(String(header.text || ''))) return refuse('The header has a variable; use a template whose variables are in the body only.');
  }
  for (const b of Array.isArray(buttons?.buttons) ? buttons.buttons : []) {
    const type = String(b?.type || '').toUpperCase();
    if (type === 'URL' && /\{\{/.test(String(b?.url || ''))) return refuse('A button link has a variable; use a template with a fixed link.');
    if (['COPY_CODE', 'OTP', 'CATALOG', 'MPM', 'SPM'].includes(type)) return refuse(`"${type}" buttons are not supported.`);
  }
  if (!bodyText) return refuse('The template has no body text.');
  return out;
}

/** Meta rejects variables with new lines, tabs or more than 4 spaces in a row. */
export function cleanTemplateVariable(raw: unknown): string {
  return String(raw ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, MAX_VARIABLE_LENGTH);
}

export interface WhatsAppTemplateRoute {
  key: string;
  label: string;
  templateName: string;
  language?: string;
  /** One entry per template variable, in order: a fixed value, or a description for the AI to fill. */
  variables: Array<{ description?: string; fixedValue?: string }>;
  whenToUse: string;
}

function accountView(a: any) {
  const base = (env.PUBLIC_URL || '').replace(/\/+$/, '');
  let templates: AnalysedTemplate[] = [];
  try { templates = JSON.parse(a.templates || '[]'); } catch { templates = []; }
  return {
    id: a.id,
    phoneNumberId: a.phoneNumberId,
    wabaId: a.wabaId,
    displayPhoneNumber: a.displayPhoneNumber,
    verifiedName: a.verifiedName,
    status: a.status,
    lastError: a.lastError,
    webhookUrl: `${base}/api/v2/webhooks/whatsapp/${a.id}`,
    verifyToken: a.verifyToken,
    webhookVerifiedAt: a.webhookVerifiedAt,
    templatesSyncedAt: a.templatesSyncedAt,
    templates,
  };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };
const OPT_OUT = /^\s*(stop|stop all|unsubscribe|opt[\s-]?out|cancel|quit|end|band karo|बंद करो|बंद)\s*[.!]*\s*$/i;
const OPT_IN = /^\s*(start|unstop|subscribe|resume)\s*[.!]*\s*$/i;

export class WhatsAppService {
  static async getAccount(userId: string) {
    const a = await prisma.whatsAppAccount.findUnique({ where: { userId } });
    return a ? accountView(a) : null;
  }

  /** Connects (or re-connects) the customer's WhatsApp Business number after checking it with Meta. */
  static async connect(userId: string, input: { phoneNumberId?: unknown; wabaId?: unknown; accessToken?: unknown; appSecret?: unknown }) {
    const phoneNumberId = String(input.phoneNumberId ?? '').trim();
    const wabaId = String(input.wabaId ?? '').trim();
    const accessToken = String(input.accessToken ?? '').trim();
    const appSecret = String(input.appSecret ?? '').trim();
    const problems: Array<{ field: string; message: string }> = [];
    if (!/^\d{5,25}$/.test(phoneNumberId)) problems.push({ field: 'phoneNumberId', message: 'The Phone number ID is the long number shown under API Setup in Meta (digits only).' });
    if (!/^\d{5,25}$/.test(wabaId)) problems.push({ field: 'wabaId', message: 'The WhatsApp Business Account ID is digits only.' });
    if (accessToken.length < 20 || accessToken.length > 2000 || /\s/.test(accessToken)) problems.push({ field: 'accessToken', message: 'Paste the full permanent access token (System User token).' });
    if (!/^[a-f0-9]{32}$/i.test(appSecret)) problems.push({ field: 'appSecret', message: 'The App secret is 32 letters and numbers, from App settings > Basic in Meta.' });
    if (problems.length) throw new AppError(400, 'VALIDATION_ERROR', problems.map((p) => p.message).join(' '));

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true, email: true, accountStatus: true, planExpiresAt: true } });
    if (!user || !hasActivePaidPlan(user)) throw new AppError(403, 'PAID_PLAN_REQUIRED', 'WhatsApp messages need an active paid plan. Please buy a plan first.');

    const taken = await prisma.whatsAppAccount.findUnique({ where: { phoneNumberId }, select: { userId: true } });
    if (taken && taken.userId !== userId) throw new AppError(409, 'ALREADY_CONNECTED', 'This WhatsApp number is already connected to another Claritiy account.');

    let info; let templates: MetaTemplate[];
    try {
      info = await fetchPhoneNumber(phoneNumberId, accessToken);
      templates = await fetchTemplates(wabaId, accessToken);
    } catch (err) {
      if (err instanceof WhatsAppApiError) throw new AppError(err.status >= 500 ? 502 : 400, 'WHATSAPP_REJECTED', err.message);
      throw err;
    }
    let lastError: string | null = null;
    try { await subscribeApp(wabaId, accessToken); } catch (err) {
      lastError = `Delivery reports may not arrive: ${err instanceof Error ? err.message : 'subscription failed'}`;
    }

    const existing = await prisma.whatsAppAccount.findUnique({ where: { userId }, select: { verifyToken: true } });
    const data = {
      phoneNumberId, wabaId,
      displayPhoneNumber: info.displayPhoneNumber,
      verifiedName: info.verifiedName,
      accessToken: EncryptionService.encrypt(accessToken),
      appSecret: EncryptionService.encrypt(appSecret),
      status: 'connected',
      lastError,
      templates: JSON.stringify(templates.map(analyseTemplate)),
      templatesSyncedAt: new Date(),
    };
    const saved = await prisma.whatsAppAccount.upsert({
      where: { userId },
      create: { userId, verifyToken: crypto.randomBytes(24).toString('hex'), ...data },
      update: { ...data, verifyToken: existing?.verifyToken || crypto.randomBytes(24).toString('hex') },
    });
    logger.info('[WHATSAPP] account connected', { userId, accountId: saved.id, templates: templates.length });
    return accountView(saved);
  }

  static async syncTemplates(userId: string) {
    const a = await prisma.whatsAppAccount.findUnique({ where: { userId } });
    if (!a) throw new AppError(404, 'NOT_FOUND', 'No WhatsApp number is connected.');
    try {
      const templates = await fetchTemplates(a.wabaId, EncryptionService.decrypt(a.accessToken));
      const saved = await prisma.whatsAppAccount.update({ where: { id: a.id }, data: { templates: JSON.stringify(templates.map(analyseTemplate)), templatesSyncedAt: new Date(), status: 'connected', lastError: null } });
      return accountView(saved);
    } catch (err) {
      if (err instanceof WhatsAppApiError) {
        await prisma.whatsAppAccount.update({ where: { id: a.id }, data: { status: 'error', lastError: err.message } });
        throw new AppError(err.status >= 500 ? 502 : 400, 'WHATSAPP_REJECTED', err.message);
      }
      throw err;
    }
  }

  static async disconnect(userId: string): Promise<boolean> {
    const res = await prisma.whatsAppAccount.deleteMany({ where: { userId } });
    return res.count > 0;
  }

  static async listMessages(userId: string, opts: { callId?: string; limit?: number; before?: Date } = {}) {
    const limit = Math.min(Math.max(1, Math.floor(opts.limit || 50)), 100);
    return prisma.whatsAppMessage.findMany({
      where: { userId, ...(opts.callId ? { callId: opts.callId } : {}), ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, callId: true, agentId: true, direction: true, phoneNumber: true, templateName: true, language: true, body: true, status: true, errorMessage: true, createdAt: true, updatedAt: true },
    });
  }

  /** Approved, usable templates of an account (for the agent editor and the live call). */
  static async usableTemplates(userId: string): Promise<{ verifiedName: string | null; templates: AnalysedTemplate[] } | null> {
    const a = await prisma.whatsAppAccount.findUnique({ where: { userId }, select: { templates: true, verifiedName: true, status: true } });
    if (!a || a.status !== 'connected') return null;
    let templates: AnalysedTemplate[] = [];
    try { templates = JSON.parse(a.templates || '[]'); } catch { templates = []; }
    return { verifiedName: a.verifiedName, templates: templates.filter((t) => t.usable) };
  }

  /**
   * Sends one approved template to the person on the call. Every refusal comes back as a sentence the
   * AI can say (or act on); nothing here throws into the call.
   */
  static async sendFromCall(input: {
    userId: string; callId: string; agentId?: string | null; recipient: string;
    route: WhatsAppTemplateRoute; variables: unknown; consentConfirmed: unknown; consentEvidence?: string;
  }): Promise<{ ok: true; status: 'sent' | 'already_sent' } | { ok: false; code: string; message: string }> {
    const { userId, callId, route } = input;
    if (input.consentConfirmed !== true) {
      return { ok: false, code: 'CONSENT_REQUIRED', message: 'Not sent. First ask the caller if they agree to receive this on WhatsApp from the business, and only call send_whatsapp again with consent_confirmed true after a clear yes.' };
    }
    const phone = normalizePhoneNumber(input.recipient);
    if (!phone.ok) return { ok: false, code: 'INVALID_RECIPIENT', message: 'Not sent: the caller\'s number is not a valid mobile number for WhatsApp. Offer to read the details out instead.' };
    const to = phone.e164;

    const account = await prisma.whatsAppAccount.findUnique({ where: { userId } });
    if (!account || account.status !== 'connected') return { ok: false, code: 'NOT_CONNECTED', message: 'Not sent: WhatsApp is not available right now. Offer to read the details out instead.' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountType: true, email: true, accountStatus: true, planExpiresAt: true } });
    if (!user || !hasActivePaidPlan(user)) return { ok: false, code: 'PAID_PLAN_REQUIRED', message: 'Not sent: WhatsApp is not available right now. Offer to read the details out instead.' };

    const consent = await prisma.whatsAppConsent.findUnique({ where: { userId_phoneNumber: { userId, phoneNumber: to } } });
    if (consent?.status === 'opted_out') {
      return { ok: false, code: 'OPTED_OUT', message: 'Not sent: this person has opted out of WhatsApp messages from the business. Do not offer WhatsApp again; offer to read the details out instead.' };
    }

    let templates: AnalysedTemplate[] = [];
    try { templates = JSON.parse(account.templates || '[]'); } catch { templates = []; }
    const tpl = templates.find((t) => t.name === route.templateName && (!route.language || t.language === route.language));
    if (!tpl || !tpl.usable) return { ok: false, code: 'TEMPLATE_UNAVAILABLE', message: 'Not sent: this message is not available on WhatsApp right now. Offer to read the details out instead.' };

    const provided = Array.isArray(input.variables) ? input.variables : [];
    const values: Array<{ value: string; name?: string }> = [];
    const missing: string[] = [];
    tpl.variables.forEach((v, i) => {
      const fixed = route.variables?.[i]?.fixedValue;
      const value = cleanTemplateVariable(fixed !== undefined && String(fixed).trim() !== '' ? fixed : provided[i]);
      if (!value) missing.push(route.variables?.[i]?.description || `value ${i + 1}`);
      values.push(v.named ? { value, name: v.key } : { value });
    });
    if (missing.length) {
      return { ok: false, code: 'MISSING_VARIABLES', message: `Not sent yet: first collect ${missing.join(', ')} from the caller, then call send_whatsapp again with variables in this order.` };
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [perCall, perRecipient] = await Promise.all([
      prisma.whatsAppMessage.count({ where: { userId, callId, direction: 'outbound', status: { not: 'failed' } } }),
      prisma.whatsAppMessage.count({ where: { userId, phoneNumber: to, direction: 'outbound', status: { not: 'failed' }, createdAt: { gte: since } } }),
    ]);
    const idempotencyKey = `${callId}:${route.key}`;
    const previous = await prisma.whatsAppMessage.findUnique({ where: { idempotencyKey } });
    if (previous && previous.status !== 'failed') return { ok: true, status: 'already_sent' };
    if (perCall >= MAX_WHATSAPP_PER_CALL) return { ok: false, code: 'CALL_LIMIT', message: 'Not sent: the limit of WhatsApp messages for this call is reached. Tell the caller what you already sent.' };
    if (perRecipient >= MAX_WHATSAPP_PER_RECIPIENT_PER_DAY) return { ok: false, code: 'RECIPIENT_LIMIT', message: 'Not sent: this person has received several WhatsApp messages today. Offer to read the details out instead.' };

    // Opt-in is recorded BEFORE the message (Meta: consent precedes business-initiated messages).
    await prisma.whatsAppConsent.upsert({
      where: { userId_phoneNumber: { userId, phoneNumber: to } },
      create: { userId, phoneNumber: to, status: 'opted_in', source: 'call_verbal', callId, evidence: input.consentEvidence?.slice(0, 2000) || null, optedInAt: new Date() },
      update: { status: 'opted_in', source: 'call_verbal', callId, evidence: input.consentEvidence?.slice(0, 2000) || null, optedInAt: new Date(), optedOutAt: null },
    });

    let preview = tpl.bodyText;
    tpl.variables.forEach((v, i) => { preview = preview.split(new RegExp(`\\{\\{\\s*${v.key}\\s*\\}\\}`, 'g')).join(values[i].value); });
    let row;
    try {
      row = previous
        ? await prisma.whatsAppMessage.update({ where: { id: previous.id }, data: { status: 'queued', errorCode: null, errorMessage: null, body: preview.slice(0, 4000) } })
        : await prisma.whatsAppMessage.create({ data: { userId, callId, agentId: input.agentId || null, direction: 'outbound', phoneNumber: to, templateName: tpl.name, language: tpl.language, body: preview.slice(0, 4000), status: 'queued', idempotencyKey } });
    } catch (err: any) {
      if (err?.code === 'P2002') return { ok: true, status: 'already_sent' }; // a parallel tool call won the race
      throw err;
    }

    try {
      const wamid = await sendTemplate(account.phoneNumberId, EncryptionService.decrypt(account.accessToken), { to, templateName: tpl.name, language: tpl.language, bodyParams: values });
      await prisma.whatsAppMessage.update({ where: { id: row.id }, data: { status: 'sent', metaMessageId: wamid } });
      logger.info('[WHATSAPP] template sent from call', { userId, callId, template: tpl.name });
      return { ok: true, status: 'sent' };
    } catch (err) {
      const message = err instanceof WhatsAppApiError ? err.message : 'WhatsApp did not accept the message.';
      await prisma.whatsAppMessage.update({ where: { id: row.id }, data: { status: 'failed', errorCode: err instanceof WhatsAppApiError ? err.metaCode : 'ERROR', errorMessage: message.slice(0, 500) } }).catch(() => {});
      logger.warn('[WHATSAPP] send failed', { userId, callId, template: tpl.name, code: err instanceof WhatsAppApiError ? err.metaCode : 'ERROR' });
      return { ok: false, code: 'SEND_FAILED', message: 'Not sent: WhatsApp did not accept the message. Apologise briefly and offer to read the details out instead.' };
    }
  }

  /** GET verification from Meta. Returns the challenge to echo, or null (403). */
  static async verifyWebhook(accountId: string, mode: unknown, token: unknown, challenge: unknown): Promise<string | null> {
    if (mode !== 'subscribe' || typeof token !== 'string' || typeof challenge !== 'string' || challenge.length > 200) return null;
    const a = await prisma.whatsAppAccount.findUnique({ where: { id: accountId }, select: { id: true, verifyToken: true } }).catch(() => null);
    if (!a || !safeEqual(token, a.verifyToken)) return null;
    await prisma.whatsAppAccount.update({ where: { id: a.id }, data: { webhookVerifiedAt: new Date() } }).catch(() => {});
    return challenge;
  }

  /**
   * POST from Meta: delivery statuses and replies. Fail-closed: without a valid signature nothing is
   * read. Returns the HTTP status to answer.
   */
  static async handleWebhook(accountId: string, rawBody: Buffer | undefined, signature: unknown, body: any): Promise<number> {
    const a = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } }).catch(() => null);
    if (!a || !rawBody || typeof signature !== 'string' || !signature.startsWith('sha256=')) return 401;
    let secret: string;
    try { secret = EncryptionService.decrypt(a.appSecret); } catch { return 401; }
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqual(signature, expected)) {
      logger.warn('[WHATSAPP_WEBHOOK] signature mismatch', { accountId });
      return 401;
    }

    for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value || {};
        if (String(value?.metadata?.phone_number_id || '') !== a.phoneNumberId) continue; // another number of the same app
        for (const s of Array.isArray(value.statuses) ? value.statuses.slice(0, 500) : []) {
          await this.applyStatus(a.userId, s).catch((err) => logger.warn('[WHATSAPP_WEBHOOK] status not applied', { accountId, error: String(err) }));
        }
        for (const m of Array.isArray(value.messages) ? value.messages.slice(0, 500) : []) {
          await this.applyInbound(a.userId, m).catch((err) => logger.warn('[WHATSAPP_WEBHOOK] reply not stored', { accountId, error: String(err) }));
        }
      }
    }
    return 200;
  }

  private static async applyStatus(userId: string, s: any): Promise<void> {
    const id = String(s?.id || '');
    const next = String(s?.status || '').toLowerCase() === 'played' ? 'read' : String(s?.status || '').toLowerCase();
    if (!id || !['sent', 'delivered', 'read', 'failed'].includes(next)) return;
    const row = await prisma.whatsAppMessage.findFirst({ where: { metaMessageId: id, userId }, select: { id: true, status: true } });
    if (!row) return;
    const cur = row.status;
    const forward = next === 'failed' ? (cur === 'queued' || cur === 'sent') : (STATUS_RANK[next] ?? -1) > (STATUS_RANK[cur] ?? 99);
    if (!forward) return;
    const err = Array.isArray(s.errors) ? s.errors[0] : null;
    await prisma.whatsAppMessage.update({
      where: { id: row.id },
      data: { status: next, ...(next === 'failed' ? { errorCode: String(err?.code ?? 'failed'), errorMessage: String(err?.title || err?.message || 'Not delivered').slice(0, 500) } : {}) },
    });
  }

  private static async applyInbound(userId: string, m: any): Promise<void> {
    const id = String(m?.id || '');
    const from = String(m?.from || '').replace(/\D/g, '');
    if (!id || !from) return;
    const phone = `+${from}`;
    const text = String(m?.text?.body ?? m?.button?.text ?? m?.interactive?.button_reply?.title ?? m?.interactive?.list_reply?.title ?? `[${String(m?.type || 'message')}]`).slice(0, 4000);
    if (await prisma.whatsAppMessage.findUnique({ where: { metaMessageId: id }, select: { id: true } })) return; // re-delivered
    try {
      await prisma.whatsAppMessage.create({ data: { userId, direction: 'inbound', phoneNumber: phone, body: text, status: 'received', metaMessageId: id } });
    } catch (err: any) {
      if (err?.code === 'P2002') return; // Meta re-delivered the same message
      throw err;
    }
    const now = new Date();
    if (OPT_OUT.test(text)) {
      await prisma.whatsAppConsent.upsert({
        where: { userId_phoneNumber: { userId, phoneNumber: phone } },
        create: { userId, phoneNumber: phone, status: 'opted_out', source: 'whatsapp_reply', evidence: text.slice(0, 200), optedOutAt: now },
        update: { status: 'opted_out', source: 'whatsapp_reply', evidence: text.slice(0, 200), optedOutAt: now },
      });
      logger.info('[WHATSAPP] recipient opted out by reply', { userId });
    } else if (OPT_IN.test(text)) {
      await prisma.whatsAppConsent.upsert({
        where: { userId_phoneNumber: { userId, phoneNumber: phone } },
        create: { userId, phoneNumber: phone, status: 'opted_in', source: 'whatsapp_reply', evidence: text.slice(0, 200), optedInAt: now },
        update: { status: 'opted_in', source: 'whatsapp_reply', evidence: text.slice(0, 200), optedInAt: now, optedOutAt: null },
      });
    }
  }
}
