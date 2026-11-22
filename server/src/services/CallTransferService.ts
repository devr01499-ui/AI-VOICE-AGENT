/**
 * Live-call hand-offs.
 *
 * To a PERSON (transfer_call): the caller's leg is moved (carrier "transfer a call") to signed XML
 * that dials the saved number with our own number as caller ID and a time limit = what is left of
 * the call's maximum duration and the account's minutes. The AI session then stops, but the phone
 * call continues; the carrier's final hangup webhook closes the call and bills the WHOLE call at the
 * carrier's duration (owner decision 2026-11-22). If nobody answers, the caller hears a short message
 * and the customer gets a "call back" notification.
 *
 * To an AI SPECIALIST (agent_transfer): the same call continues with another agent of the same
 * account (CallOrchestrator.handoffToAgent); recorded here for Call History.
 *
 * Limits: at most 3 hand-offs per call; one human transfer in flight at a time.
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { escapeXml } from '../utils/xmlUtils';
import { getWebhookSigningSecret } from '../utils/security';
import { getEffectiveRemainingSeconds } from '../middleware/planValidation';
import { ADMIN_EMAIL } from '../config/constants';
import { ourNumberCandidates } from '../core/telephony/carrierHangup';
import { normalizeTransferNumber, type HumanRoute, type AgentRoute } from '../runtime/callRouting';
import { NotificationService } from './NotificationService';

export const MAX_HANDOFFS_PER_CALL = 3;
const MIN_TRANSFER_SECONDS = 30;
const RING_TIMEOUT_SECONDS = 30;
const ACTIVE_HUMAN_STATUSES = ['requested', 'dialing', 'connected'];
export const DEFAULT_NO_ANSWER_MESSAGE = 'Sorry, nobody from our team could take your call right now. We have noted your request and will call you back soon. Thank you.';

export function transferSignature(transferId: string): string {
  return crypto.createHmac('sha256', getWebhookSigningSecret()).update(`call-transfer:${transferId}`).digest('hex');
}

export function verifyTransferSignature(transferId: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(transferSignature(transferId), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicBase(): string {
  return (env.PUBLIC_URL || '').replace(/\/+$/, '');
}

function transferUrl(transferId: string, action: 'xml' | 'dial-result' | 'dial-event'): string {
  return `${publicBase()}/api/v2/webhooks/transfer/${transferId}/${action}?sig=${transferSignature(transferId)}`;
}

/** Seconds the person-to-person part may last: the call's remaining maximum and the account's minutes. */
async function remainingTransferSeconds(call: { id: string; userId: string; agentId: string; startTime: Date | null; maxDuration: number }): Promise<number> {
  const { resolveMaxCallSeconds } = await import('../core/orchestrator/CallOrchestrator');
  const agent = await prisma.agent.findFirst({ where: { id: call.agentId, userId: call.userId }, select: { agentConfig: true } });
  let cfg: any = {};
  try { cfg = JSON.parse(agent?.agentConfig || '{}'); } catch { cfg = {}; }
  const elapsed = call.startTime ? Math.max(0, Math.round((Date.now() - call.startTime.getTime()) / 1000)) : 0;
  const maxLeft = resolveMaxCallSeconds(cfg?.callSettings?.maxDurationSeconds, call.maxDuration) - elapsed;
  const user = await prisma.user.findUnique({ where: { id: call.userId }, select: { accountType: true, email: true, minutesRemainingSeconds: true, callingBalanceMinutes: true } });
  const unlimited = user?.accountType === 'admin' || user?.email === ADMIN_EMAIL;
  const balanceLeft = unlimited ? Number.POSITIVE_INFINITY : getEffectiveRemainingSeconds(user as any) - elapsed;
  return Math.floor(Math.min(maxLeft, balanceLeft));
}

export type HumanTransferResult =
  | { ok: true; transferId: string }
  | { ok: false; code: string; message: string };

export class CallTransferService {
  /** Moves the live call to the dial XML. Callers must have muted the AI and let it finish speaking. */
  static async startHumanTransfer(input: { callId: string; userId: string; agentId: string; route: HumanRoute; reason?: string }): Promise<HumanTransferResult> {
    const { callId, userId, route } = input;
    const fail = (code: string, message: string): HumanTransferResult => ({ ok: false, code, message });

    const call = await prisma.call.findFirst({ where: { id: callId, userId } });
    if (!call || !['in_progress', 'connected', 'answered'].includes(String(call.status).toLowerCase())) return fail('CALL_NOT_LIVE', 'The call is not live any more.');
    if (!call.telemetryId) return fail('NO_CARRIER_ID', 'This call cannot be transferred.');
    if (!/^https:\/\//.test(publicBase())) {
      logger.error('[ADMIN_ALERT][CALL_TRANSFER] PUBLIC_URL must be https for live transfers', { callId });
      return fail('NOT_CONFIGURED', 'Live transfer is not available right now.');
    }

    const number = normalizeTransferNumber(route.number);
    if (!number.ok) return fail('INVALID_DESTINATION', 'This transfer number is not allowed.');
    const ours = ourNumberCandidates(call);
    const callerSide = String(call.callDirection).toLowerCase() === 'inbound' ? call.fromPhoneNumber : call.recipientPhoneNumber;
    const digits = (n?: string | null) => String(n || '').replace(/\D/g, '').slice(-10);
    if ([...ours, callerSide].some((n) => n && digits(n) === digits(number.e164))) return fail('LOOP', 'The call cannot be transferred to the same number.');

    const existing = await prisma.callTransfer.findMany({ where: { callId, userId }, select: { kind: true, status: true } });
    if (existing.length >= MAX_HANDOFFS_PER_CALL) return fail('LIMIT', 'This call has been transferred too many times.');
    if (existing.some((t) => t.kind === 'human' && ACTIVE_HUMAN_STATUSES.includes(t.status))) return fail('IN_PROGRESS', 'A transfer is already in progress.');

    const seconds = await remainingTransferSeconds(call);
    if (seconds < MIN_TRANSFER_SECONDS) return fail('NO_TIME_LEFT', 'There is not enough call time or minutes left to transfer.');

    const transfer = await prisma.callTransfer.create({
      data: {
        userId, callId, kind: 'human', fromAgentId: input.agentId, destinationLabel: route.label, destinationNumber: number.e164,
        reason: String(input.reason || '').slice(0, 500) || null, status: 'requested',
      },
    });

    // Which carrier: from OUR number (same rule as hangup).
    let record: { telephonyProvider: string; plivoSubAuthId: string | null } | null = null;
    for (const n of ours) {
      const d = n.replace(/\D/g, '');
      record = await prisma.phoneNumber.findFirst({ where: { phoneNumber: { in: [n, d, `+${d}`] } }, select: { telephonyProvider: true, plivoSubAuthId: true } });
      if (record) break;
    }
    const provider = (record?.telephonyProvider || '').toLowerCase();
    const xmlUrl = transferUrl(transfer.id, 'xml');
    let outcome: string = 'failed';
    try {
      if (provider === 'plivo') {
        const { PlivoService } = await import('../core/telephony/PlivoService');
        outcome = await new PlivoService().transferCall(call.telemetryId, xmlUrl, { subAuthId: record?.plivoSubAuthId || null });
      } else if (provider === 'vobiz') {
        const { ProviderManager } = await import('../providers/ProviderManager');
        const tel: any = ProviderManager.instance.getTelephonyProvider();
        outcome = typeof tel.transferCall === 'function' ? await tel.transferCall(call.telemetryId, xmlUrl, userId) : 'failed';
      } else {
        logger.warn('[CALL_TRANSFER] carrier of our number unknown; transfer refused', { callId });
      }
    } catch (err) {
      logger.warn('[CALL_TRANSFER] carrier transfer error', { callId, error: err instanceof Error ? err.message : String(err) });
      outcome = 'failed';
    }

    if (outcome !== 'transferred') {
      await prisma.callTransfer.update({ where: { id: transfer.id }, data: { status: 'failed', errorMessage: `carrier: ${outcome}`, completedAt: new Date() } });
      logger.warn('[CALL_TRANSFER] carrier did not accept the transfer', { callId, outcome });
      return fail('CARRIER_FAILED', 'The transfer could not be started.');
    }
    await prisma.callTransfer.update({ where: { id: transfer.id }, data: { status: 'dialing' } });
    void prisma.callEvent.create({ data: { callId, eventType: 'transfer_to_human', payload: JSON.stringify({ transferId: transfer.id, destination: route.label }) } }).catch(() => {});
    logger.info('[CALL_TRANSFER] caller moved to the dial XML', { callId, transferId: transfer.id, seconds });
    return { ok: true, transferId: transfer.id };
  }

  /** XML the carrier fetches after the transfer: dial the person, then report the outcome. */
  static async dialXml(transferId: string): Promise<string> {
    const t = await prisma.callTransfer.findUnique({ where: { id: transferId }, include: { call: true } });
    if (!t || t.kind !== 'human' || !t.destinationNumber || !['requested', 'dialing'].includes(t.status)) {
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
    }
    const seconds = await remainingTransferSeconds(t.call);
    if (seconds < MIN_TRANSFER_SECONDS) {
      await prisma.callTransfer.update({ where: { id: t.id }, data: { status: 'failed', errorMessage: 'no time left', completedAt: new Date() } });
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${escapeXml(DEFAULT_NO_ANSWER_MESSAGE)}</Speak><Hangup/></Response>`;
    }
    const callerId = ourNumberCandidates(t.call)[0] || '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="${RING_TIMEOUT_SECONDS}" timeLimit="${seconds}" dialMusic="real" redirect="true" action="${escapeXml(transferUrl(t.id, 'dial-result'))}" method="POST" callbackUrl="${escapeXml(transferUrl(t.id, 'dial-event'))}" callbackMethod="POST">
    <Number>${escapeXml(t.destinationNumber)}</Number>
  </Dial>
</Response>`;
  }

  /** Dial progress (DialAnswer / DialHangup). */
  static async dialEvent(transferId: string, body: Record<string, unknown>): Promise<void> {
    const event = String(body.Event || body.DialAction || '').toLowerCase();
    if (event.includes('answer') || event.includes('connected')) {
      await prisma.callTransfer.updateMany({ where: { id: transferId, status: { in: ['requested', 'dialing'] } }, data: { status: 'connected' } });
    }
  }

  /** The person's leg ended (or never answered): what the caller hears next. */
  static async dialResult(transferId: string, body: Record<string, unknown>, fallbackMessage?: string): Promise<string> {
    const dialStatus = String(body.DialStatus || body.DialBLegStatus || '').toLowerCase();
    const t = await prisma.callTransfer.findUnique({ where: { id: transferId } });
    if (!t) return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
    const answered = dialStatus === 'completed' || dialStatus === 'answer' || t.status === 'connected';
    const final = answered ? 'completed' : dialStatus === 'busy' ? 'busy' : (dialStatus === 'no-answer' || dialStatus === 'timeout' || dialStatus === 'cancel') ? 'no_answer' : 'failed';
    const updated = await prisma.callTransfer.updateMany({
      where: { id: t.id, status: { in: ACTIVE_HUMAN_STATUSES } },
      data: { status: final, dialStatus: dialStatus.slice(0, 40) || null, completedAt: new Date() },
    });
    if (answered) return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;

    if (updated.count === 1) {
      const call = await prisma.call.findFirst({ where: { id: t.callId, userId: t.userId }, select: { callDirection: true, fromPhoneNumber: true, recipientPhoneNumber: true } });
      const caller = call ? (String(call.callDirection).toLowerCase() === 'inbound' ? call.fromPhoneNumber : call.recipientPhoneNumber) : null;
      void NotificationService.createNotification({
        userId: t.userId,
        type: 'TRANSFER_MISSED',
        title: 'Missed live transfer: call back',
        message: `A caller${caller ? ` (${caller})` : ''} asked to speak to ${t.destinationLabel || 'your team'}, but nobody answered (${final.replace('_', ' ')}). Please call them back.`,
        severity: 'warning',
        metadata: { callId: t.callId, transferId: t.id },
      });
    }
    const message = (fallbackMessage || '').trim() || DEFAULT_NO_ANSWER_MESSAGE;
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${escapeXml(message)}</Speak><Hangup/></Response>`;
  }

  /** The no-answer message the customer set for this destination (flow node or function). */
  static async fallbackMessageFor(transferId: string): Promise<string | undefined> {
    const t = await prisma.callTransfer.findUnique({ where: { id: transferId }, select: { fromAgentId: true, userId: true, destinationLabel: true } });
    if (!t?.fromAgentId) return undefined;
    const agent = await prisma.agent.findFirst({ where: { id: t.fromAgentId, userId: t.userId }, select: { agentConfig: true, flowGraph: true } });
    if (!agent) return undefined;
    const { extractCallRouting } = await import('../runtime/callRouting');
    let cfg: any = {};
    try { cfg = JSON.parse(agent.agentConfig || '{}'); } catch { cfg = {}; }
    return extractCallRouting(cfg.functions, agent.flowGraph).human.find((h) => h.label === t.destinationLabel)?.fallbackMessage;
  }

  /** Checks for an AI-to-AI hand-off and records it (the orchestrator does the switch). */
  static async recordAgentHandoff(input: { callId: string; userId: string; fromAgentId: string; route: AgentRoute; summary: string }): Promise<{ ok: true; transferId: string } | { ok: false; code: string; message: string }> {
    const { callId, userId, route } = input;
    if (!route.agentId || route.agentId === input.fromAgentId) return { ok: false, code: 'INVALID_TARGET', message: 'That specialist is not available.' };
    const [call, target, count] = await Promise.all([
      prisma.call.findFirst({ where: { id: callId, userId }, select: { status: true } }),
      prisma.agent.findFirst({ where: { id: route.agentId, userId, status: { not: 'inactive' } }, select: { id: true } }),
      prisma.callTransfer.count({ where: { callId, userId } }),
    ]);
    if (!call || !['in_progress', 'connected', 'answered'].includes(String(call.status).toLowerCase())) return { ok: false, code: 'CALL_NOT_LIVE', message: 'The call is not live any more.' };
    if (!target) return { ok: false, code: 'INVALID_TARGET', message: 'That specialist is not available.' };
    if (count >= MAX_HANDOFFS_PER_CALL) return { ok: false, code: 'LIMIT', message: 'This call has been transferred too many times; keep helping the caller yourself.' };
    const t = await prisma.callTransfer.create({
      data: { userId, callId, kind: 'agent', fromAgentId: input.fromAgentId, toAgentId: route.agentId, destinationLabel: route.agentName || route.label, summary: input.summary.slice(0, 2000) || null, status: 'requested' },
    });
    return { ok: true, transferId: t.id };
  }

  static async completeAgentHandoff(transferId: string, ok: boolean, error?: string): Promise<void> {
    await prisma.callTransfer.update({ where: { id: transferId }, data: { status: ok ? 'completed' : 'failed', errorMessage: error ? error.slice(0, 500) : null, completedAt: new Date() } }).catch(() => {});
  }

  static async listForCall(callId: string, userId: string) {
    return prisma.callTransfer.findMany({
      where: { callId, userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, destinationLabel: true, destinationNumber: true, toAgentId: true, reason: true, summary: true, status: true, dialStatus: true, createdAt: true, completedAt: true },
    });
  }
}
