/**
 * Live-call routing: hand-off to a person (phone number), to another of the customer's agents, and
 * WhatsApp messages. Shared by prompt agents (editor "Functions") and conversational flows (nodes).
 *
 * Safety model: the AI never chooses a phone number, an agent id or a template. It picks one KEY from
 * the list the customer configured; the server maps the key to the saved target and re-checks it
 * (destination policy, agent ownership, template approval, paid plan) before anything happens.
 *
 * Keys: an editor function's name; a flow node's id. Frontend/src/app/components/agents/flowCompiler.ts
 * uses the same routeKey() so the compiled flow prompt names the same keys.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { checkOutboundDestination } from '../utils/destinationPolicy';
import { hasActivePaidPlan } from '../middleware/planValidation';
import { WhatsAppService, type WhatsAppTemplateRoute } from '../services/whatsapp/WhatsAppService';
import { routeKey } from './routeKey';

export interface HumanRoute { key: string; label: string; number: string; whenToUse: string; fallbackMessage?: string }
export interface AgentRoute { key: string; label: string; agentId?: string; agentName?: string; whenToUse: string }
export interface CallRouting { human: HumanRoute[]; agents: AgentRoute[]; whatsapp: WhatsAppTemplateRoute[] }
export interface ResolvedRouting extends CallRouting { businessName: string | null }

const MAX_ROUTES_PER_KIND = 10;
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export { routeKey };

/**
 * A number a call may be handed to: Indian mobile or landline (+91 and 10 digits) or another country
 * that is enabled for outbound calls. Premium-rate and shared-cost numbers are refused.
 */
export function normalizeTransferNumber(raw: unknown): { ok: true; e164: string } | { ok: false; error: string } {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 32 || /[^\d+\s\-().]/.test(s)) return { ok: false, error: 'Enter the number with country code, for example +91 98765 43210.' };
  const digits = s.replace(/\D/g, '');
  let e164: string | null = null;
  if (s.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 10 && /^[1-9]/.test(digits)) e164 = `+91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) e164 = `+91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) e164 = `+${digits}`;
  if (!e164) return { ok: false, error: 'Enter the number with country code, for example +91 98765 43210.' };
  if (e164.startsWith('+91') && !/^\+91[1-9]\d{9}$/.test(e164)) return { ok: false, error: 'An Indian number has 10 digits after +91.' };
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return { ok: false, error: 'Enter the number with country code, for example +91 98765 43210.' };
  const policy = checkOutboundDestination(e164);
  if (!policy.allowed) return { ok: false, error: policy.reason };
  return { ok: true, e164 };
}

function uniqueKey(base: string, used: Set<string>): string {
  let k = base;
  for (let i = 2; used.has(k); i++) k = `${base.slice(0, 36)}_${i}`;
  used.add(k);
  return k;
}

function parseGraph(flowGraph: unknown): any {
  if (!flowGraph) return null;
  if (typeof flowGraph === 'string') { try { return JSON.parse(flowGraph); } catch { return null; } }
  return flowGraph;
}

/** Reads the configured routes from the editor's functions and the flow's nodes (no database). */
export function extractCallRouting(functions: unknown, flowGraph: unknown): CallRouting {
  const out: CallRouting = { human: [], agents: [], whatsapp: [] };
  const used = { human: new Set<string>(), agents: new Set<string>(), whatsapp: new Set<string>() };

  const addHuman = (key: string, label: string, number: unknown, whenToUse: string, fallback?: unknown) => {
    const n = normalizeTransferNumber(number);
    if (!n.ok) { logger.warn('callRouting: transfer target skipped (invalid number)', { key }); return; }
    if (out.human.length >= MAX_ROUTES_PER_KIND) return;
    out.human.push({ key: uniqueKey(key, used.human), label, number: n.e164, whenToUse, ...(text(fallback, 300) ? { fallbackMessage: text(fallback, 300) } : {}) });
  };
  const addAgent = (key: string, label: string, agentId: unknown, agentName: unknown, whenToUse: string) => {
    const id = text(agentId, 64);
    const name = text(agentName, 120);
    if ((!id && !name) || out.agents.length >= MAX_ROUTES_PER_KIND) return;
    out.agents.push({ key: uniqueKey(key, used.agents), label, ...(id ? { agentId: id } : {}), ...(name ? { agentName: name } : {}), whenToUse });
  };
  const addWhatsApp = (key: string, label: string, templateName: unknown, language: unknown, variables: unknown, whenToUse: string) => {
    const name = text(templateName, 512);
    if (!name || out.whatsapp.length >= MAX_ROUTES_PER_KIND) return;
    const vars = Array.isArray(variables) ? variables.slice(0, 20).map((v: any) => ({
      ...(text(v?.description, 200) ? { description: text(v?.description, 200) } : {}),
      ...(text(v?.fixedValue, 300) ? { fixedValue: text(v?.fixedValue, 300) } : {}),
    })) : [];
    out.whatsapp.push({ key: uniqueKey(key, used.whatsapp), label, templateName: name, ...(text(language, 15) ? { language: text(language, 15) } : {}), variables: vars, whenToUse });
  };

  if (Array.isArray(functions)) {
    for (const fn of functions as any[]) {
      if (!fn || typeof fn !== 'object') continue;
      const key = routeKey(fn.name);
      const when = text(fn.description, 500);
      if (fn.type === 'transfer_call') addHuman(key, text(fn.name, 80), fn.targetNumber, when, fn.fallbackMessage);
      else if (fn.type === 'agent_transfer') addAgent(key, text(fn.name, 80), fn.targetAgentId, fn.targetAgentName, when);
      else if (fn.type === 'send_whatsapp') addWhatsApp(key, text(fn.name, 80), fn.whatsappTemplate, fn.whatsappLanguage, fn.whatsappVariables, when);
    }
  }

  const graph = parseGraph(flowGraph);
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    const d = node?.data || {};
    const key = routeKey(node?.id);
    const label = text(d.label, 80) || key;
    const when = text(d.instructions || d.transferCondition || d.label, 500);
    if (node?.type === 'transferCall') addHuman(key, label, d.targetNumber, when, d.fallbackMessage);
    else if (node?.type === 'agentTransfer' || node?.type === 'subagent') addAgent(key, label, d.targetAgentId, d.subagentName, when);
    else if (node?.type === 'whatsapp' || node?.type === 'sendWhatsapp') addWhatsApp(key, label, d.templateName, d.language, d.variables, when);
  }
  return out;
}

/**
 * Checks every configured route against the account: paid plan, agents that exist in THIS account
 * (never the current agent), approved WhatsApp templates. Anything not usable is dropped.
 */
export async function resolveCallRouting(agent: { id: string; userId: string; agentConfig?: unknown; flowGraph?: unknown }): Promise<ResolvedRouting> {
  const empty: ResolvedRouting = { human: [], agents: [], whatsapp: [], businessName: null };
  let cfg: any = {};
  try { cfg = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig || '{}') : (agent.agentConfig || {}); } catch { cfg = {}; }
  const routing = extractCallRouting(cfg.functions, agent.flowGraph);
  if (!routing.human.length && !routing.agents.length && !routing.whatsapp.length) return empty;

  const user = await prisma.user.findUnique({ where: { id: agent.userId }, select: { accountType: true, email: true, accountStatus: true, planExpiresAt: true } });
  if (!user || !hasActivePaidPlan(user)) {
    logger.info('callRouting: transfers and WhatsApp need a paid plan; not offered on this call', { agentId: agent.id });
    return empty;
  }

  const result: ResolvedRouting = { human: routing.human, agents: [], whatsapp: [], businessName: null };

  if (routing.agents.length) {
    const ids = routing.agents.map((a) => a.agentId).filter((x): x is string => Boolean(x));
    const names = routing.agents.map((a) => a.agentName).filter((x): x is string => Boolean(x));
    const rows = await prisma.agent.findMany({
      where: { userId: agent.userId, status: { not: 'inactive' }, OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(names.length ? [{ name: { in: names, mode: 'insensitive' as const } }] : [])] },
      select: { id: true, name: true },
      take: 50,
    });
    for (const r of routing.agents) {
      const match = rows.find((row) => (r.agentId && row.id === r.agentId)) || rows.find((row) => r.agentName && row.name.toLowerCase() === r.agentName.toLowerCase());
      if (!match || match.id === agent.id) continue;
      result.agents.push({ ...r, agentId: match.id, agentName: match.name });
    }
  }

  if (routing.whatsapp.length) {
    const usable = await WhatsAppService.usableTemplates(agent.userId);
    if (usable) {
      result.businessName = usable.verifiedName;
      for (const r of routing.whatsapp) {
        const tpl = usable.templates.find((t) => t.name === r.templateName && (!r.language || t.language === r.language));
        if (tpl) result.whatsapp.push({ ...r, language: tpl.language });
      }
    }
  }
  return result;
}

const list = (items: Array<{ key: string; label: string; whenToUse: string }>) =>
  items.map((i) => `"${i.key}" (${i.label})${i.whenToUse ? `: ${i.whenToUse}` : ''}`).join('; ');

/** Tool declarations for the model (only kinds that have at least one usable route). */
export function buildRoutingTools(r: ResolvedRouting): any[] {
  const tools: any[] = [];
  if (r.human.length) {
    tools.push({
      type: 'function',
      name: 'transfer_call',
      description: `Connect the caller to a person on the team. FIRST tell the caller you are connecting them and ask them to stay on the line, THEN call this. Only when the caller wants a person or the situation matches a destination. Destinations: ${list(r.human)}.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          destination: { type: 'STRING', enum: r.human.map((h) => h.key), description: 'One of the destination keys.' },
          reason: { type: 'STRING', description: 'One sentence: why the caller is being transferred.' },
        },
        required: ['destination'],
      },
    });
  }
  if (r.agents.length) {
    tools.push({
      type: 'function',
      name: 'agent_transfer',
      description: `Hand this live call to another AI specialist of the same business. FIRST tell the caller you are connecting them to a specialist, THEN call this. Specialists: ${list(r.agents)}.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          target: { type: 'STRING', enum: r.agents.map((a) => a.key), description: 'One of the specialist keys.' },
          summary: { type: 'STRING', description: 'What the caller needs and every detail already collected (name, numbers, preferences), so the specialist does not ask again.' },
        },
        required: ['target', 'summary'],
      },
    });
  }
  if (r.whatsapp.length) {
    tools.push({
      type: 'function',
      name: 'send_whatsapp',
      description: `Send an approved WhatsApp message to the caller's own number. Only after the caller clearly said yes to receiving it on WhatsApp. Messages: ${r.whatsapp.map((w) => `"${w.key}" (${w.label})${w.whenToUse ? `: ${w.whenToUse}` : ''}${w.variables.some((v) => !v.fixedValue) ? ` [variables, in order: ${w.variables.map((v, i) => (v.fixedValue ? `#${i + 1} fixed` : `#${i + 1} ${v.description || 'value'}`)).join(', ')}]` : ''}`).join('; ')}.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          template: { type: 'STRING', enum: r.whatsapp.map((w) => w.key), description: 'One of the message keys.' },
          variables: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Values for the message variables, in order (leave fixed ones empty).' },
          consent_confirmed: { type: 'BOOLEAN', description: 'true only if the caller just clearly agreed to receive this on WhatsApp.' },
        },
        required: ['template', 'consent_confirmed'],
      },
    });
  }
  return tools;
}

/** Instructions added to the system prompt when routes exist. */
export function buildRoutingPrompt(r: ResolvedRouting): string {
  const parts: string[] = [];
  if (r.human.length || r.agents.length) {
    parts.push(`[LIVE TRANSFERS] You can hand this call over. ${r.human.length ? `To a person: use transfer_call (${list(r.human)}).` : ''} ${r.agents.length ? `To an AI specialist: use agent_transfer (${list(r.agents)}).` : ''}
- Transfer only when the caller asks for a person, or the situation clearly matches a destination. Never transfer someone who is just asking a question you can answer.
- Before the tool: one short sentence, e.g. "I'll connect you to our team now, please stay on the line." Then call the tool and say nothing more.
- If the tool says the transfer failed, apologise once and offer a callback.
- These instructions replace any earlier step text that says a transfer is not available.`.replace(/ {2,}/g, ' '));
  }
  if (r.whatsapp.length) {
    const biz = r.businessName ? `"${r.businessName}"` : 'the business';
    parts.push(`[WHATSAPP] You can send these approved WhatsApp messages to the caller's own number: ${r.whatsapp.map((w) => `"${w.key}" (${w.label})`).join(', ')}.
- Always ask first, naming the business and WhatsApp, for example: "Can ${biz} send you this on WhatsApp on this number?" Send only after a clear yes, with consent_confirmed true. If they say no, do not ask again.
- Never claim it was sent until the tool says it was. Never promise SMS, email or links by any other channel.
- Collect the needed details before sending; do not invent values.`);
  }
  return parts.join('\n\n');
}

/**
 * Save-time check of transfer / WhatsApp settings (server side; the editor checks the same). Returns
 * the first problem as a sentence for the customer, or null.
 */
export function routingConfigProblem(functions: unknown, flowGraph: unknown, previous: { functions?: unknown; flowGraph?: unknown } = {}): string | null {
  // Entries saved before (unchanged) are not re-judged: an old step must never block saving other
  // changes. Live calls skip unusable entries anyway.
  const seenFns = new Set((Array.isArray(previous.functions) ? previous.functions : []).map((f) => JSON.stringify(f)));
  const prevNodes = new Map<string, string>();
  for (const n of Array.isArray(parseGraph(previous.flowGraph)?.nodes) ? parseGraph(previous.flowGraph).nodes : []) prevNodes.set(String(n?.id), String(n?.data?.targetNumber ?? ''));
  if (Array.isArray(functions)) {
    for (const fn of functions as any[]) {
      if (!fn || typeof fn !== 'object' || seenFns.has(JSON.stringify(fn))) continue;
      const name = String(fn.name || 'this function');
      if (fn.type === 'transfer_call') {
        const n = normalizeTransferNumber(fn.targetNumber);
        if (!n.ok) return `Transfer function "${name}": ${n.error}`;
      } else if (fn.type === 'agent_transfer') {
        if (!String(fn.targetAgentId || '').trim()) return `Agent transfer "${name}": choose the agent to hand the call to.`;
      } else if (fn.type === 'send_whatsapp') {
        const t = String(fn.whatsappTemplate || '').trim();
        if (!t || t.length > 512) return `WhatsApp function "${name}": choose an approved WhatsApp template.`;
      }
    }
  }
  const graph = parseGraph(flowGraph);
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (node?.type !== 'transferCall') continue;
    const raw = String(node?.data?.targetNumber ?? '').trim();
    if (!raw) continue; // not configured yet: the node is simply not offered on calls
    if (prevNodes.get(String(node?.id)) === String(node?.data?.targetNumber ?? '')) continue;
    const n = normalizeTransferNumber(raw);
    if (!n.ok) return `Call transfer step "${String(node?.data?.label || node?.id || '')}": ${n.error}`;
  }
  return null;
}
