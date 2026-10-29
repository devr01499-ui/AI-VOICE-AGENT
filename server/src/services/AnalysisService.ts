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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { REPORT_BLUEPRINTS, ReportBlueprint } from '../config/reportBlueprints';
import {
  normalizeMoneyOrNumber,
  normalizeDate,
  normalizeDurationDays,
  validatePhoneNumber,
  validateEmail,
  validatePostalPinCode,
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

export class AnalysisService {
  /**
   * Resolves the matching report blueprint for an agent.
   * Checks agentConfig templateId, agent role/name keywords, transcript signals,
   * and falls back cleanly to General Call Analysis (tpl-0). Never defaults to Receptionist.
   */
  static resolveBlueprint(agent: any, transcriptSegments?: any[]): ReportBlueprint {
    if (agent && agent.agentConfig) {
      try {
        const config = typeof agent.agentConfig === 'string'
          ? JSON.parse(agent.agentConfig)
          : agent.agentConfig;

        if (config?.templateId && REPORT_BLUEPRINTS[config.templateId]) {
          return REPORT_BLUEPRINTS[config.templateId];
        }
      } catch {}
    }

    // C1: First inspect transcript signals from the actual conversation if present
    if (transcriptSegments && transcriptSegments.length > 0) {
      const transText = transcriptSegments.map((s: any) => s.content || '').join(' ').toLowerCase();
      if (/\b(open to a new role|years of experience|ctc|notice period|job change|interview)\b/i.test(transText)) {
        return REPORT_BLUEPRINTS['tpl-12'];
      }
      if (/\b(schedule a demo|pricing|interested in buying|product demo)\b/i.test(transText)) {
        return REPORT_BLUEPRINTS['tpl-2'];
      }
      if (/\b(site visit|sqft|bhk|flat price|property location)\b/i.test(transText)) {
        return REPORT_BLUEPRINTS['tpl-3'];
      }
      if (/\b(emi overdue|loan repayment|settlement amount|defaulter)\b/i.test(transText)) {
        return REPORT_BLUEPRINTS['tpl-4'];
      }
    }

    // Role / Name / Prompt detection
    const textToScan = [
      agent?.name || '',
      agent?.description || '',
      agent?.systemPrompt || '',
      (typeof agent?.agentConfig === 'string' ? agent.agentConfig : JSON.stringify(agent?.agentConfig || {}))
    ].join(' ').toLowerCase();

    // Check specific industry / role patterns
    if (/\b(recruiter|recruitment|talent|hiring|interview|hr|sourcer)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-12'];
    }
    if (/\b(sales|outreach|demo|prospect|pitch|lead gen|qualification)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-2'];
    }
    if (/\b(real estate|property|broker|site visit|apartment|flat)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-3'];
    }
    if (/\b(collection|recovery|emi|overdue|payment reminder)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-4'];
    }
    if (/\b(support|helpdesk|ticket|complaint|troubleshoot)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-5'];
    }
    if (/\b(doctor|clinic|hospital|patient|consultation)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-6'];
    }
    if (/\b(order|delivery|shipping|courier|logistics|dispatch)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-7'];
    }
    if (/\b(loan|credit card|mortgage|banking|finance)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-8'];
    }
    if (/\b(admission|course|student|coaching|university|college)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-9'];
    }
    if (/\b(feedback|survey|nps|rating|review)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-10'];
    }
    if (/\b(password reset|vpn|it support|laptop|software issue)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-11'];
    }
    if (/\b(event|webinar|conference|rsvp)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-13'];
    }
    if (/\b(dealership|test drive|car|vehicle|automobile)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-14'];
    }
    if (/\b(hotel|resort|room booking|check-in|hospitality)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-15'];
    }
    if (/\b(reception|receptionist|front desk|visitor)\b/i.test(textToScan)) {
      return REPORT_BLUEPRINTS['tpl-1'];
    }

    // Explicit General Call Analysis blueprint fallback (never Receptionist)
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
      if (['busy', 'no_answer', 'timeout_no_answer', 'telephony_no_answer'].includes(endReason) || call.status === 'no-answer') {
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

      if (['call_rejected', 'carrier_rejected', 'user_busy'].includes(endReason) || call.status === 'busy') {
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
    // 2. SIGNAL HIERARCHY LEVEL 2: System Events & Verified Tool Results (C9)
    // ─────────────────────────────────────────────────────────────────────────────
    const events = call.callEvents || [];

    // Check for explicit Do Not Call / Opt-Out
    const hasOptOutEvent = events.some((e: any) => {
      if (e.eventType === 'opt_out') return true;
      if (e.eventType === 'tool_call') {
        try {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : (e.payload || {});
          return (payload.toolName === 'register_opt_out' || payload.toolName === 'dnc') && payload.success === true;
        } catch {
          return e.payload && (e.payload.includes('register_opt_out') || e.payload.includes('dnc'));
        }
      }
      return false;
    });

    if (hasOptOutEvent || endReason === 'opted_out') {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'Opted Out',
        status: 'completed',
        score: 0,
        confidence: 1.0,
        summary: 'Caller requested not to be contacted again. Opt-out recorded.',
        sentiment: 'Negative',
        fields: { optOut: true },
        evidence: {},
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // Check for verified Appointment Booking / Calendar Tool Execution
    const hasBookingSuccess = events.some((e: any) => {
      if (e.eventType === 'tool_call') {
        try {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : (e.payload || {});
          return (
            (payload.toolName === 'schedule_event' || payload.toolName === 'book_appointment' || payload.toolName === 'book_follow_up_call') &&
            payload.success === true
          );
        } catch {
          return (
            (e.payload.includes('schedule_event') || e.payload.includes('book_appointment')) &&
            !e.payload.includes('"error"') &&
            !e.payload.includes('"success":false')
          );
        }
      }
      return false;
    });

    if (hasBookingSuccess) {
      const bookingLabel = blueprint.labels.find(
        (l) => l.priority <= 2 && /book|interview|scheduled/i.test(l.label) && !/not|un/i.test(l.label)
      )?.label || 'Booked';

      return await this.persistResult(call, blueprint, {
        resultLabel: bookingLabel,
        status: 'completed',
        score: 100,
        confidence: 1.0,
        summary: 'Appointment successfully scheduled and confirmed via calendar tool.',
        sentiment: 'Positive',
        fields: { bookingConfirmed: true },
        evidence: {},
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // Check for Call Transfer Tool Execution
    const hasTransferSuccess = events.some((e: any) => {
      if (e.eventType === 'tool_call') {
        try {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : (e.payload || {});
          return (payload.toolName === 'transfer_call' || payload.toolName === 'live_handoff') && payload.success === true;
        } catch {
          return e.payload.includes('transfer_call') || e.payload.includes('live_handoff');
        }
      }
      return false;
    });

    if (hasTransferSuccess) {
      const transferLabel = blueprint.labels.find(
        (l) => /transfer|escalat/i.test(l.label) && !/not|un/i.test(l.label)
      )?.label || 'Transferred';

      return await this.persistResult(call, blueprint, {
        resultLabel: transferLabel,
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call successfully transferred to human representative.',
        sentiment: 'Neutral',
        fields: { transferred: true },
        evidence: {},
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. SIGNAL HIERARCHY LEVEL 3 & 4: Model Extraction with Grounding & Rules
    // ─────────────────────────────────────────────────────────────────────────────
    if (segments.length === 0) {
      return await this.persistResult(call, blueprint, {
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

    const apiKey = call.user?.geminiApiKey || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('AnalysisService: Missing Gemini API key for deep extraction, falling back to basic transcript summary', { callId });
      return await this.persistResult(call, blueprint, {
        resultLabel: blueprint.labels[blueprint.labels.length - 1]?.label || 'Unclear',
        status: 'needs_review',
        score: null,
        confidence: 0.5,
        summary: `Call completed with ${segments.length} transcript segments. Model extraction skipped due to missing API key.`,
        sentiment: 'Neutral',
        fields: { segmentCount: segments.length },
        evidence: {},
        model: 'fallback_no_api_key',
        latencyMs: Date.now() - startTime,
      });
    }

    const reportModelName = process.env.REPORT_ANALYSIS_MODEL || 'gemini-2.0-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: reportModelName,
      generationConfig: {
        temperature: 0.0,
      },
    });

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

    let primarySummary = 'Call completed.';
    let primarySentiment = 'Neutral';
    let primaryResultLabel = 'Unclear';
    let primaryConfidence = 0.7;

    const summaries: string[] = [];

    for (const chunk of chunks) {
      const prompt = buildHardenedAnalysisPrompt({
        blueprintName: blueprint.templateName,
        blueprintDefinition: blueprint.labels.map(l => `* ${l.label}: ${l.definition}`).join('\n'),
        labelsEnum,
        fieldsDescription,
        transcriptTurns: chunk.turns,
        responseSchemaJson: responseSchemaExample,
      });

      // 60-second timeout isolation (E1)
      const genPromise = model.generateContent(prompt);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Analysis model generation timed out after 60s')), 60000)
      );

      const genResult = await Promise.race([genPromise, timeoutPromise]);
      let responseText = genResult.response.text().trim();
      responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {
          resultLabel: 'Unclear',
          confidence: 0.5,
          summary: responseText.slice(0, 200),
          sentiment: 'Neutral',
          fields: {},
          evidence: {},
        };
      }

      if (parsed.summary) {
        summaries.push(parsed.summary);
      }

      if (parsed.sentiment && parsed.sentiment !== 'Neutral') {
        primarySentiment = parsed.sentiment;
      }

      // C8: Multi-chunk label preservation:
      // The highest priority label (lowest priority number) wins across chunks!
      if (parsed.resultLabel && labelsEnum.includes(parsed.resultLabel)) {
        const candidatePriority = blueprint.labels.find((l) => l.label === parsed.resultLabel)?.priority ?? 999;
        const currentPriority = blueprint.labels.find((l) => l.label === primaryResultLabel)?.priority ?? 999;

        if (candidatePriority < currentPriority) {
          primaryResultLabel = parsed.resultLabel;
          if (typeof parsed.confidence === 'number') {
            primaryConfidence = parsed.confidence;
          }
          if (parsed.summary) {
            primarySummary = parsed.summary;
          }
        }
      }

      const lastSeq = chunk.turns[chunk.turns.length - 1]?.sequenceNumber ?? 0;
      chunkExtractionResults.push({
        fields: parsed.fields || {},
        evidence: parsed.evidence || {},
        lastTurnSequence: lastSeq,
      });
    }

    if (summaries.length > 1 && primarySummary === 'Call completed.') {
      primarySummary = summaries.join(' ');
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
      evidenceValidityRate,
    } = enforceEvidenceGrounding(normalizedFields, mergedEvidence, segments);

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. SCORING IN CODE (Section 5.9 & C5)
    // ─────────────────────────────────────────────────────────────────────────────
    const rubricScore = calculateRubricScore(blueprint, groundedFields);
    const finalScore = rubricScore ? rubricScore.totalScore : null;

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
      promptVersion: '1.0.0',
      model: reportModelName,
      inputHash: transcriptHash,
      latencyMs: Date.now() - startTime,
    });
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
