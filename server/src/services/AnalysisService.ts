/**
 * AnalysisService.ts — Core Call Result and Intelligence Engine
 *
 * Implements Accuracy Engineering (Sections 5.1 - 5.13, C1-C12, D1-D5, E1-E5):
 * 5.1 Signal Hierarchy: Dial outcome -> Verified Events -> Deterministic Rules -> Model.
 * 5.2 Dynamic Blueprint Resolution: Vertical matching, role detection, transcript sensing, fallback to tpl-0.
 * 5.3 Grounded Evidence: Caller facts verified in caller turns, min length >= 4 chars, value inclusion check.
 * 5.4 Long Calls: Highest-priority label preservation across chunks, summary synthesis.
 * 5.5 Resilience: 60s timeout, safe model output schema validation, no silent overwrites of corrected reports.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebhookDispatcher } from '../utils/WebhookDispatcher';
import { textModelCandidates as geminiTextModelCandidates } from '../config/geminiModels';
import { generateText, TextModelError } from './ai/textModel';
import { REPORT_BLUEPRINTS, ReportBlueprint } from '../config/reportBlueprints';
import {
  normalizeMoneyOrNumber,
  normalizeDate,
  normalizeDurationDays,
  validateEnum,
} from '../utils/reportNormalizers';
import { enforceEvidenceGrounding } from '../utils/evidenceValidator';
import { calculateRubricScore } from '../utils/rubricScorer';
import {
  buildHardenedAnalysisPrompt,
  SanitizedTranscriptTurn,
} from '../utils/promptInjectionGuard';
import { chunkTranscriptTurns, mergeChunkedFacts } from '../utils/transcriptChunker';
import crypto from 'crypto';

export interface AnalysisOutcome {
  resultLabel: string;
  status: 'completed' | 'needs_review' | 'failed';
  score: number | null;
  confidence: number;
  summary: string;
  sentiment: string;
  fields: Record<string, any>;
  evidence: Record<string, any>;
  blueprintVersion?: string;
  promptVersion?: string;
  model: string;
  inputHash?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

const POST_CALL_FIELD_TYPES = new Set(['string', 'number', 'boolean', 'enum']);

/** Adds the agent's Post-Call Data Extraction fields and summary instruction to a template copy. */
export function withAgentPostCallConfig(base: ReportBlueprint, agent: any): ReportBlueprint {
  let cfg: any = null;
  try {
    cfg = typeof agent?.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent?.agentConfig;
  } catch {
    cfg = null;
  }
  const post = cfg?.postCallAnalysis;
  const custom: any[] = Array.isArray(post?.fields) ? post.fields : [];
  const fields = [...base.fields];
  for (const f of custom.slice(0, 25)) {
    const name = String(f?.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    if (!name) continue;
    const type = POST_CALL_FIELD_TYPES.has(f?.type) ? f.type : 'string';
    const options = type === 'enum' && Array.isArray(f?.options)
      ? f.options.map((o: unknown) => String(o).slice(0, 80)).filter(Boolean).slice(0, 20)
      : undefined;
    const field = {
      name,
      type,
      description: String(f?.description || name).slice(0, 400),
      required: false,
      ...(options && options.length ? { options } : {}),
      notStatedValue: null,
    } as ReportBlueprint['fields'][number];
    // Template names are camelCase (e.g. callerName); match case- and underscore-insensitively and
    // keep the template's name so reports stay consistent.
    const key = name.replace(/_/g, '');
    const at = fields.findIndex((x) => x.name.toLowerCase().replace(/_/g, '') === key);
    if (at >= 0) fields[at] = { ...field, name: fields[at].name }; else fields.push(field);
  }
  const summary = typeof post?.summaryPrompt === 'string' ? post.summaryPrompt.trim().slice(0, 1000) : '';
  return { ...base, fields, ...(summary ? { summaryInstruction: summary } : {}) };
}

/**
 * Agent role -> report template, most specific first (the first match wins). Each id is checked
 * against the template's own name by test:call-reports, so the table can never drift from
 * config/reportBlueprints.ts again (it had: sales agents got the Medical Clinic template, clinics
 * Home Services, order desks Real Estate, hotels Debt Collections). Phrases are chosen so common
 * prompt words ("24 hr", "in order to", "in the event", "premium service") do not match.
 */
export const AGENT_TEMPLATE_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['tpl-15', /\b(debt collections?|collections? agent|loan recovery|recovery agent|emi overdue|overdue emi|emi reminder|payment recovery)\b/i],
  ['tpl-14', /\b(banking kyc|kyc reminder|kyc verification|re-kyc|account verification)\b/i],
  ['tpl-13', /\b(insurance|policy renewal|insurance claim|claim intake)\b/i],
  ['tpl-12', /\b(recruiter|recruitment|talent acquisition|hiring|job interviews?|candidate screening|pre-screening|human resources|sourcer)\b/i],
  ['tpl-5', /\b(dental|dentist|orthodontist)\b/i],
  ['tpl-2', /\b(doctor|clinic|hospital|patients?|medical)\b/i],
  ['tpl-11', /\b(car dealership|dealership|test drives?|car service|vehicle service|automobile|two-wheeler)\b/i],
  ['tpl-7', /\b(real estate|property|properties|broker|site visits?|apartments?|villas?|bhk|plots?)\b/i],
  ['tpl-10', /\b(restaurant|table reservations?|takeout|takeaway|dine-in)\b/i],
  ['tpl-9', /\b(e-?commerce|online store|order status|order tracking|returns? and refunds?|cash on delivery|cod orders?|order confirmation)\b/i],
  ['tpl-8', /\b(saas|free trial|trial users?|product onboarding)\b/i],
  ['tpl-6', /\b(home services?|plumbers?|plumbing|electricians?|ac repair|appliance repair|pest control|cleaning services?)\b/i],
  ['tpl-4', /\b(win-?back|churn(ed)?|reactivation|lapsed customers?)\b/i],
  ['tpl-3', /\b(sales|b2b|lead qualifi\w*|lead generation|outreach|prospects?|sdr|product demos?)\b/i],
  ['tpl-1', /\b(receptionist|reception desk|front desk|visitors?)\b/i],
];

/** Used only when the agent gives no clue: strong phrases from the conversation itself. */
export const CALL_TEMPLATE_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['tpl-12', /\b(open to a new role|years of experience|current ctc|notice period|job change)\b/i],
  ['tpl-15', /\b(emi overdue|loan repayment|settlement amount|defaulter)\b/i],
  ['tpl-7', /\b(site visit|sqft|bhk|property location)\b/i],
  ['tpl-3', /\b(schedule a demo|product demo|interested in buying)\b/i],
];

/** Bumped when the analysis logic or prompt changes (stored on every report). */
export const REPORT_PROMPT_VERSION = '2.0.0';

/** The model's JSON report, or null when it is not a JSON object. */
export function parseReportJson(text: string): Record<string, any> | null {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const v = JSON.parse(clean);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export class AnalysisService {
  /**
   * Resolves the matching report blueprint for an agent.
   * Checks agentConfig templateId, agent role/name keywords, transcript signals,
   * and falls back cleanly to General Call Analysis (tpl-0). Never defaults to Receptionist.
   */
  /**
   * The report template for a call: the chosen base template PLUS the agent's own Post-Call Data
   * Extraction fields and summary instruction. (Before, the agent's fields were never extracted on
   * live calls.) Always returns a copy; the shared templates are never modified.
   */
  static resolveBlueprint(agent: any, transcriptSegments?: any[]): ReportBlueprint {
    return withAgentPostCallConfig(this.resolveBaseBlueprint(agent, transcriptSegments), agent);
  }

  private static resolveBaseBlueprint(agent: any, transcriptSegments?: any[]): ReportBlueprint {
    if (agent && agent.agentConfig) {
      try {
        const config = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
        if (config?.templateId && REPORT_BLUEPRINTS[config.templateId]) {
          return REPORT_BLUEPRINTS[config.templateId];
        }
      } catch {}
    }

    // 1. The agent's own role (name, description, prompt). One agent keeps one template.
    const agentText = [
      agent?.name || '',
      agent?.description || '',
      agent?.systemPrompt || '',
    ].join(' ');
    const byAgent = AGENT_TEMPLATE_RULES.find(([, re]) => re.test(agentText));
    if (byAgent) return REPORT_BLUEPRINTS[byAgent[0]];

    // 2. Only when the agent gives no clue: strong phrases from the conversation itself.
    if (transcriptSegments && transcriptSegments.length > 0) {
      const transText = transcriptSegments.map((s: any) => s.content || '').join(' ');
      const byCall = CALL_TEMPLATE_RULES.find(([, re]) => re.test(transText));
      if (byCall) return REPORT_BLUEPRINTS[byCall[0]];
    }

    // 3. General Call Analysis (never a specialised template by default).
    return REPORT_BLUEPRINTS['tpl-0'];
  }

  /**
   * Processes a finalized call by ID according to the Signal Hierarchy.
   */
  static async processCall(callId: string, jobId?: string): Promise<AnalysisOutcome> {
    const startTime = Date.now();

    const [call, existingResult] = await Promise.all([
      prisma.call.findUnique({
        where: { id: callId },
        include: {
          user: true,
          agent: true,
          callEvents: true,
        },
      }),
      prisma.callResult.findUnique({
        where: { callId },
      }),
    ]);

    if (!call) {
      throw new Error(`AnalysisService: Call with ID ${callId} not found`);
    }

    // D3: Guard against silently overwriting human-corrected reports
    if (existingResult && existingResult.reviewStatus === 'corrected') {
      logger.info('AnalysisService: Call report has human correction, preserving existing result', {
        callId,
        reviewStatus: existingResult.reviewStatus,
        correctedBy: existingResult.correctedBy,
      });
      return {
        resultLabel: existingResult.resultLabel,
        status: existingResult.status as any,
        score: existingResult.score,
        confidence: existingResult.confidence,
        summary: existingResult.summary || 'Human corrected report',
        sentiment: existingResult.sentiment || 'Neutral',
        fields: (existingResult.fields as Record<string, any>) || {},
        evidence: (existingResult.evidence as Record<string, any>) || {},
        model: existingResult.model || 'human_corrected',
        latencyMs: 0,
      };
    }

    // Load transcript segments
    const segments = await prisma.transcriptSegment.findMany({
      where: { callId },
      orderBy: { sequenceNumber: 'asc' },
    });

    // Resolve blueprint
    const blueprint = this.resolveBlueprint(call.agent, segments);

    const callerSegments = segments.filter(
      (s: any) => s.speaker === 'user' || s.speaker === 'caller' || s.speaker === 'customer'
    );
    const duration = call.durationSeconds ?? 0;
    const endReason = call.endReason || '';
    const callStartTime = call.startTime || new Date();

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. SIGNAL HIERARCHY LEVEL 1: Telephony Outcome & Connection Signals
    // Only apply telephony failure if there was NO real caller conversation (C7)
    // ─────────────────────────────────────────────────────────────────────────────
    const hasCallerConversation = callerSegments.length > 0 && callerSegments.some(s => s.content && s.content.trim().length > 3);

    if (!hasCallerConversation) {
      // ('busy' used to be listed here, so busy calls were reported as No Answer.)
      if (['no_answer', 'timeout_no_answer', 'telephony_no_answer'].includes(endReason) || call.status === 'no-answer' || call.status === 'no_answer') {
        return await this.persistResult(call, blueprint, {
          resultLabel: 'No Answer',
          status: 'completed',
          score: null,
          confidence: 1.0,
          summary: 'Call rang out with no answer from the recipient.',
          sentiment: 'Neutral',
          fields: { callOutcome: 'no_answer', dialAttempts: 1 },
          evidence: {},
          model: 'deterministic_signals',
          latencyMs: Date.now() - startTime,
        });
      }

      if (['busy', 'user_busy', 'call_rejected', 'carrier_rejected'].includes(endReason) || call.status === 'busy') {
        return await this.persistResult(call, blueprint, {
          resultLabel: 'Busy',
          status: 'completed',
          score: null,
          confidence: 1.0,
          summary: 'Line was busy or call was explicitly declined by recipient.',
          sentiment: 'Neutral',
          fields: { callOutcome: 'busy' },
          evidence: {},
          model: 'deterministic_signals',
          latencyMs: Date.now() - startTime,
        });
      }

      if (call.status === 'failed' || endReason === 'stream_closed') {
        return await this.persistResult(call, blueprint, {
          resultLabel: 'Failed',
          status: 'completed',
          score: null,
          confidence: 1.0,
          summary: 'Call failed to connect due to carrier or network error.',
          sentiment: 'Neutral',
          fields: { callOutcome: 'failed' },
          evidence: {},
          model: 'deterministic_signals',
          latencyMs: Date.now() - startTime,
        });
      }

      if (duration < 10 && callerSegments.length === 0) {
        return await this.persistResult(call, blueprint, {
          resultLabel: 'No Conversation',
          status: 'completed',
          score: null,
          confidence: 1.0,
          summary: 'Call connected briefly but dropped before any caller interaction occurred.',
          sentiment: 'Neutral',
          fields: { callOutcome: 'no_conversation', durationSeconds: duration },
          evidence: {},
          model: 'deterministic_signals',
          latencyMs: Date.now() - startTime,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. SIGNAL HIERARCHY LEVEL 2: verified events decide the OUTCOME LABEL (opt-out, booking,
    //    transfer). The conversation is still analysed for the summary, sentiment and fields: these
    //    are the most valuable calls and used to get only a fixed sentence and no extracted data.
    // ─────────────────────────────────────────────────────────────────────────────
    const verified = this.verifiedOutcome(call.callEvents || [], blueprint);

    if (segments.length === 0) {
      return await this.persistResult(call, blueprint, verified
        ? { ...verified, status: 'completed', model: 'deterministic_signals', evidence: {}, latencyMs: Date.now() - startTime }
        : {
          resultLabel: 'No Conversation',
          status: 'completed',
          score: null,
          confidence: 1.0,
          summary: 'No audio transcript segments captured for this call session.',
          sentiment: 'Neutral',
          fields: {},
          evidence: {},
          model: 'deterministic_signals',
          latencyMs: Date.now() - startTime,
        });
    }

    const turns: SanitizedTranscriptTurn[] = segments.map((s: any, idx: number) => ({
      speaker: s.speaker === 'agent' ? 'agent' : 'caller',
      sequenceNumber: s.sequenceNumber ?? idx + 1,
      content: s.content || '',
    }));

    // Long call chunking
    const chunks = chunkTranscriptTurns(turns, 8000, 2);
    const chunkExtractionResults: Array<{ fields: Record<string, any>; evidence: Record<string, any>; lastTurnSequence: number }> = [];

    const labelsEnum = blueprint.labels.map(l => l.label);
    const fieldsDescription = blueprint.fields
      .map(f => `- "${f.name}" (${f.type}): ${f.description}${f.options ? ' Options: [' + f.options.join(', ') + ']' : ''}${f.required ? ' [REQUIRED]' : ''}`)
      .join('\n');

    const responseSchemaExample = JSON.stringify({
      resultLabel: labelsEnum[0] || 'Unclear',
      confidence: 0.95,
      summary: '2-sentence concise outcome summary.',
      sentiment: 'Positive',
      fields: Object.fromEntries(blueprint.fields.map(f => [f.name, f.notStatedValue ?? null])),
      evidence: Object.fromEntries(blueprint.fields.map(f => [f.name, { quote: 'verbatim quote', segmentIndex: 0 }])),
    }, null, 2);

    // The shared text-model helper: JSON output mode, timeout, one retry, fallback model, the
    // workspace's own key first. A model failure is thrown so the worker retries with backoff.
    const reportModels = geminiTextModelCandidates(process.env.REPORT_ANALYSIS_MODEL);
    let reportModelName = reportModels[0];

    let primaryResultLabel = 'Unclear';
    let labelChosen = false;
    let primaryConfidence = 0.5;
    let primarySentiment = 'Neutral';
    const summaries: string[] = [];

    for (const chunk of chunks) {
      const prompt = buildHardenedAnalysisPrompt({
        blueprintName: blueprint.templateName,
        blueprintDefinition: blueprint.labels.map(l => `* ${l.label}: ${l.definition}`).join('\n')
          + (blueprint.summaryInstruction
            ? `\n\nSUMMARY INSTRUCTIONS FROM THE BUSINESS (apply to the "summary" field only):\n${blueprint.summaryInstruction}`
            : ''),
        labelsEnum,
        fieldsDescription,
        transcriptTurns: chunk.turns,
        responseSchemaJson: responseSchemaExample,
      });

      let responseText: string;
      try {
        const out = await generateText({
          workspaceId: call.userId,
          purpose: 'call_report',
          systemInstruction: 'You analyse a business phone call transcript and return only the JSON object requested. Use only what is in the transcript.',
          prompt,
          json: true,
          temperature: 0,
          maxOutputTokens: 8192,
          timeoutMs: 60_000,
          models: reportModels,
        });
        responseText = out.text;
        reportModelName = out.model;
      } catch (err) {
        if (err instanceof TextModelError && err.kind === 'not_configured') {
          logger.warn('AnalysisService: no AI key configured; report keeps the verified facts only', { callId });
          return await this.persistResult(call, blueprint, verified
            ? { ...verified, status: 'completed', model: 'deterministic_signals', evidence: {}, latencyMs: Date.now() - startTime }
            : {
              resultLabel: 'Unclear',
              status: 'needs_review',
              score: null,
              confidence: 0.5,
              summary: 'This call could not be analysed because no AI key is configured. The transcript is available.',
              sentiment: 'Neutral',
              fields: { segmentCount: segments.length },
              evidence: {},
              model: 'fallback_no_api_key',
              latencyMs: Date.now() - startTime,
            });
        }
        throw err;
      }

      const parsed = parseReportJson(responseText);
      if (!parsed) {
        throw new Error('The AI model returned an unreadable report (not JSON); the worker retries.');
      }

      const chunkSummary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      if (chunkSummary) summaries.push(chunkSummary);

      if (typeof parsed.sentiment === 'string' && parsed.sentiment && parsed.sentiment !== 'Neutral') {
        primarySentiment = parsed.sentiment;
      }

      // C8: across chunks the highest-priority label (lowest number) wins; its confidence goes with it.
      if (typeof parsed.resultLabel === 'string' && labelsEnum.includes(parsed.resultLabel)) {
        const candidatePriority = blueprint.labels.find((l) => l.label === parsed.resultLabel)?.priority ?? 999;
        const currentPriority = labelChosen ? (blueprint.labels.find((l) => l.label === primaryResultLabel)?.priority ?? 999) : Infinity;
        if (candidatePriority < currentPriority) {
          primaryResultLabel = parsed.resultLabel;
          labelChosen = true;
          if (typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1) {
            primaryConfidence = parsed.confidence;
          }
        }
      }

      const lastSeq = chunk.turns[chunk.turns.length - 1]?.sequenceNumber ?? 0;
      chunkExtractionResults.push({
        fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
        evidence: parsed.evidence && typeof parsed.evidence === 'object' ? parsed.evidence : {},
        lastTurnSequence: lastSeq,
      });
    }

    // The summary covers the WHOLE call: each part's summary in order (a long call has several).
    const primarySummary = summaries.length > 0
      ? summaries.join(' ')
      : (verified?.summary || 'The AI model returned no summary for this call.');

    // A verified event decides the label with certainty.
    if (verified) {
      primaryResultLabel = verified.resultLabel;
      primaryConfidence = 1.0;
    }

    // Merge facts across chunks
    const { mergedFields, mergedEvidence } = mergeChunkedFacts(chunkExtractionResults);

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. CODE-BASED NORMALIZATION & VALIDATION (Sections 5.6, C2, C3, C4, C5)
    // ─────────────────────────────────────────────────────────────────────────────
    const normalizedFields: Record<string, any> = {};

    for (const fieldDef of blueprint.fields) {
      const rawValue = mergedFields[fieldDef.name];
      if (rawValue === null || rawValue === undefined) {
        normalizedFields[fieldDef.name] = fieldDef.notStatedValue ?? null;
        continue;
      }

      switch (fieldDef.type) {
        case 'currency':
        case 'number': {
          const res = normalizeMoneyOrNumber(rawValue);
          normalizedFields[fieldDef.name] = res.value;
          break;
        }
        case 'date': {
          const res = normalizeDate(rawValue, callStartTime);
          normalizedFields[fieldDef.name] = res.date;
          break;
        }
        case 'duration': {
          const res = normalizeDurationDays(rawValue);
          normalizedFields[fieldDef.name] = res.days;
          break;
        }
        case 'enum': {
          const res = validateEnum(rawValue, fieldDef.options || []);
          normalizedFields[fieldDef.name] = (res as any)?.value !== undefined ? (res as any).value : res;
          break;
        }
        case 'boolean': {
          if (typeof rawValue === 'boolean') normalizedFields[fieldDef.name] = rawValue;
          else if (String(rawValue).toLowerCase() === 'true') normalizedFields[fieldDef.name] = true;
          else if (String(rawValue).toLowerCase() === 'false') normalizedFields[fieldDef.name] = false;
          else normalizedFields[fieldDef.name] = fieldDef.notStatedValue ?? null;
          break;
        }
        default:
          normalizedFields[fieldDef.name] = String(rawValue);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. EVIDENCE GROUNDING ENFORCEMENT (Section 5.5 & C6)
    // ─────────────────────────────────────────────────────────────────────────────
    const {
      groundedFields,
      groundedEvidence,
      evidenceFindings,
    } = enforceEvidenceGrounding(normalizedFields, mergedEvidence, segments);
    // Verified system facts (booking made, transfer, opt-out) are not transcript claims: added after
    // the transcript check, and they win over anything the model extracted for the same field.
    if (verified) Object.assign(groundedFields, verified.fields);

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. SCORING IN CODE (Section 5.9 & C5)
    // ─────────────────────────────────────────────────────────────────────────────
    const rubricScore = calculateRubricScore(blueprint, groundedFields);
    const finalScore = rubricScore ? rubricScore.totalScore : (verified ? verified.score : null);

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. ABSTENTION & CONFIDENCE REVIEW GATING (Section 5.7 & 5.8)
    // ─────────────────────────────────────────────────────────────────────────────
    let reviewStatus: 'completed' | 'needs_review' = 'completed';

    // Rule 1: Low confidence or Unclear label
    if (primaryConfidence < 0.6 || primaryResultLabel === 'Unclear') {
      reviewStatus = 'needs_review';
    }

    // Rule 2: Any required field missing after grounding
    for (const fieldDef of blueprint.fields) {
      if (fieldDef.required && (groundedFields[fieldDef.name] === null || groundedFields[fieldDef.name] === undefined)) {
        reviewStatus = 'needs_review';
      }
    }

    // Rule 3: Any evidence quote failed verification
    if (evidenceFindings.length > 0) {
      reviewStatus = 'needs_review';
    }

    // Reproducibility Input Hash (SHA-256 of transcript turns)
    const transcriptHash = crypto
      .createHash('sha256')
      .update(turns.map(t => `${t.speaker}:${t.content}`).join('|'))
      .digest('hex');

    return await this.persistResult(call, blueprint, {
      resultLabel: primaryResultLabel,
      status: reviewStatus,
      score: finalScore,
      confidence: primaryConfidence,
      summary: primarySummary,
      sentiment: primarySentiment,
      fields: groundedFields,
      evidence: groundedEvidence,
      blueprintVersion: blueprint.version,
      promptVersion: REPORT_PROMPT_VERSION,
      model: verified ? `${reportModelName}+verified_events` : reportModelName,
      inputHash: transcriptHash,
      latencyMs: Date.now() - startTime,
    });
  }

  /**
   * The outcome a recorded event proves with certainty, in priority order: the caller opted out, an
   * appointment was booked by the calendar tool, the call was handed to a person or another agent.
   * Event names are the ones the runtime writes (CallOrchestrator opt_out / transfer_to_agent,
   * CallTransferService transfer_to_human, CalendarService tool_call schedule_event); the older
   * tool_call payloads are still read. Returns null when no event proves the outcome.
   */
  static verifiedOutcome(events: any[], blueprint: ReportBlueprint): {
    resultLabel: string; score: number | null; confidence: number; summary: string; sentiment: string; fields: Record<string, any>;
  } | null {
    const payloadOf = (e: any): any => {
      if (!e?.payload) return {};
      if (typeof e.payload !== 'string') return e.payload;
      try { return JSON.parse(e.payload); } catch { return {}; }
    };
    const tool = (e: any, names: string[]) => e.eventType === 'tool_call' && names.includes(payloadOf(e).toolName) && payloadOf(e).success === true;

    if (events.some((e) => e.eventType === 'opt_out' || tool(e, ['register_opt_out', 'dnc']))) {
      return { resultLabel: 'Opted Out', score: 0, confidence: 1.0, sentiment: 'Negative', fields: { optOut: true },
        summary: 'The caller asked not to be contacted again; the number was added to the do-not-call list.' };
    }
    if (events.some((e) => tool(e, ['schedule_event', 'book_appointment', 'book_follow_up_call']))) {
      const label = blueprint.labels.find((l) => l.priority <= 2 && /book|interview|scheduled/i.test(l.label) && !/not|un/i.test(l.label))?.label || 'Booked';
      return { resultLabel: label, score: 100, confidence: 1.0, sentiment: 'Positive', fields: { bookingConfirmed: true },
        summary: 'An appointment was booked and confirmed in the calendar during the call.' };
    }
    if (events.some((e) => e.eventType === 'transfer_to_human' || e.eventType === 'transfer_to_agent' || tool(e, ['transfer_call', 'live_handoff']))) {
      const label = blueprint.labels.find((l) => /transfer|escalat/i.test(l.label) && !/not|un/i.test(l.label))?.label || 'Transferred';
      return { resultLabel: label, score: null, confidence: 1.0, sentiment: 'Neutral', fields: { transferred: true },
        summary: 'The call was transferred during the conversation.' };
    }
    return null;
  }

  /**
   * Persists the outcome to `call_results` table.
   * Preserves manual human corrections and provides webhook idempotency.
   */
  private static async persistResult(
    call: any,
    blueprint: ReportBlueprint,
    outcome: AnalysisOutcome
  ): Promise<AnalysisOutcome> {
    const callId = call.id;
    const workspaceId = call.userId;
    const agentId = call.agentId || null;
    const batchId = call.batchId || null;

    // 1. Check existing callResult to guard against overwriting human corrections (D3)
    const existing = await prisma.callResult.findUnique({ where: { callId } });
    if (existing && existing.reviewStatus === 'corrected') {
      logger.info('AnalysisService: Preserving human-corrected call result from re-analysis overwrite', {
        callId,
        reviewStatus: existing.reviewStatus,
        correctedBy: existing.correctedBy,
      });
      return {
        resultLabel: existing.resultLabel,
        status: existing.status as any,
        score: existing.score,
        confidence: existing.confidence,
        summary: existing.summary || outcome.summary,
        sentiment: existing.sentiment || outcome.sentiment,
        fields: (existing.fields as Record<string, any>) || {},
        evidence: (existing.evidence as Record<string, any>) || {},
        model: outcome.model,
        latencyMs: outcome.latencyMs,
      };
    }

    // 2. Upsert into call_results table
    await prisma.callResult.upsert({
      where: { callId },
      update: {
        workspaceId,
        agentId,
        batchId,
        status: outcome.status,
        resultLabel: outcome.resultLabel,
        score: outcome.score,
        confidence: outcome.confidence,
        summary: outcome.summary,
        sentiment: outcome.sentiment,
        fields: outcome.fields,
        evidence: outcome.evidence,
        blueprintVersion: outcome.blueprintVersion || blueprint.version || '1.0.0',
        promptVersion: outcome.promptVersion || '1.0.0',
        model: outcome.model,
        inputHash: outcome.inputHash,
        latencyMs: outcome.latencyMs,
      },
      create: {
        callId,
        workspaceId,
        agentId,
        batchId,
        status: outcome.status,
        resultLabel: outcome.resultLabel,
        score: outcome.score,
        confidence: outcome.confidence,
        summary: outcome.summary,
        sentiment: outcome.sentiment,
        fields: outcome.fields,
        evidence: outcome.evidence,
        blueprintVersion: outcome.blueprintVersion || blueprint.version || '1.0.0',
        promptVersion: outcome.promptVersion || '1.0.0',
        model: outcome.model,
        inputHash: outcome.inputHash,
        latencyMs: outcome.latencyMs,
      },
    });

    // 3. Update legacy summary and sentiment on call record without touching userData
    await prisma.call.update({
      where: { id: callId },
      data: {
        summary: outcome.summary,
        sentiment: outcome.sentiment,
      },
    }).catch((e) => logger.warn('AnalysisService: Failed to update legacy call summary', { error: String(e) }));

    // 4. Dispatch call_analyzed webhook with idempotency key
    WebhookDispatcher.dispatch({
      agentId: call.agentId,
      userId: call.userId,
      eventType: 'call_analyzed',
      payload: {
        callId,
        resultLabel: outcome.resultLabel,
        confidence: outcome.confidence,
        sentiment: outcome.sentiment,
        summary: outcome.summary,
        extractedFields: outcome.fields,
        status: outcome.status,
        reanalysis: existing ? true : false,
      },
    });

    logger.info('AnalysisService: Successfully analyzed call and saved result', {
      callId,
      resultLabel: outcome.resultLabel,
      confidence: outcome.confidence,
      model: outcome.model,
      status: outcome.status,
      latencyMs: outcome.latencyMs,
    });

    return outcome;
  }
}
