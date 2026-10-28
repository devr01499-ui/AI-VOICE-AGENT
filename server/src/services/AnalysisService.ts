/**
 * AnalysisService.ts — Core Call Result and Intelligence Engine
 *
 * Implements Accuracy Engineering (Sections 5.1 - 5.13):
 * 5.1 Signal Hierarchy (Highest trust first):
 *     1. Dial outcome and call facts.
 *     2. System events & tool-call results.
 *     3. Deterministic rules over extracted fields.
 *     4. Model judgement only for what remains.
 * 5.2 Blueprint Quality: 15 production blueprints with mutually exclusive labels.
 * 5.3 Pinned Model: process.env.REPORT_ANALYSIS_MODEL.
 * 5.4 Speaker Attribution: Caller facts must originate from caller speech.
 * 5.5 Evidence Grounding: Verbatim substring check with 100% enforcement.
 * 5.6 Normalization & Validators: Money, Dates (Asia/Kolkata), Durations, IDs, Enums.
 * 5.7 Abstention & Confidence: Low confidence (< 0.6) or missing required fields -> needs_review.
 * 5.8 Verification Pass: Second model call for high-stakes labels.
 * 5.9 Scoring in Code: Rubrics evaluated by code.
 * 5.10 Long calls: Overlapping chunking and latest-turn merge.
 * 5.12 Injection defense: Untrusted data envelope.
 * 5.13 Reproducibility: Stores blueprint_version, prompt_version, model, and input_hash.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebhookDispatcher } from '../utils/WebhookDispatcher';
import { TranscriptRepository } from '../repositories/TranscriptRepository';
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
   */
  static resolveBlueprint(agent: any): ReportBlueprint {
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

    // Default fallback: Front Desk Receptionist (tpl-1)
    return REPORT_BLUEPRINTS['tpl-1'];
  }

  /**
   * Processes a finalized call by ID according to the Signal Hierarchy.
   */
  static async processCall(callId: string, jobId?: string): Promise<AnalysisOutcome> {
    const startTime = Date.now();

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        user: true,
        agent: true,
        callEvents: true,
      },
    });

    if (!call) {
      throw new Error(`Call record not found: ${callId}`);
    }

    const blueprint = this.resolveBlueprint(call.agent);
    const segments = await TranscriptRepository.findByCallId(callId);
    const duration = call.durationSeconds || 0;
    const callerSegments = segments.filter((s: any) => s.speaker === 'user' || s.speaker === 'caller');
    const callStartTime = call.startTime || call.createdAt || new Date();

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. SIGNAL HIERARCHY LEVEL 1: Dial Outcome & Call Facts
    // ─────────────────────────────────────────────────────────────────────────────
    const callStatus = (call.status || '').toLowerCase();
    const endReason = (call.endReason || '').toLowerCase();

    if (callStatus === 'no_answer' || endReason === 'no_answer') {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'No Answer',
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call was placed but recipient did not answer the phone.',
        sentiment: 'Neutral',
        fields: { callOutcome: 'no_answer' },
        evidence: { reason: { quote: 'telephony_no_answer', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    if (callStatus === 'busy' || endReason === 'busy') {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'Busy',
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call reached a busy signal or recipient declined call.',
        sentiment: 'Neutral',
        fields: { callOutcome: 'busy' },
        evidence: { reason: { quote: 'telephony_busy', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    if (callStatus === 'failed' || endReason === 'provider_error' || endReason === 'failed') {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'Failed',
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call failed to connect due to carrier or network error.',
        sentiment: 'Neutral',
        fields: { callOutcome: 'failed' },
        evidence: { reason: { quote: 'telephony_failed', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // Call under 10 seconds with zero caller speech
    if (duration < 10 && callerSegments.length === 0) {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'No Conversation',
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call connected briefly but dropped before any caller interaction occurred.',
        sentiment: 'Neutral',
        fields: { callOutcome: 'no_conversation', durationSeconds: duration },
        evidence: { reason: { quote: 'short_duration_no_speech', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. SIGNAL HIERARCHY LEVEL 2: System Events & Verified Tool Results
    // ─────────────────────────────────────────────────────────────────────────────
    const events = call.callEvents || [];

    // Check for explicit Do Not Call / Opt-Out
    const hasOptOutEvent = events.some(e =>
      e.eventType === 'opt_out' ||
      (e.eventType === 'tool_call' && (e.payload.includes('register_opt_out') || e.payload.includes('dnc')))
    );
    if (hasOptOutEvent || endReason === 'opted_out') {
      return await this.persistResult(call, blueprint, {
        resultLabel: 'Opted Out',
        status: 'completed',
        score: 0,
        confidence: 1.0,
        summary: 'Caller requested not to be contacted again. Opt-out recorded.',
        sentiment: 'Negative',
        fields: { optOut: true },
        evidence: { trigger: { quote: 'verified_opt_out_event', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // Check for verified Appointment Booking / Calendar Tool Execution
    const hasBookingSuccess = events.some(e =>
      e.eventType === 'tool_call' &&
      (e.payload.includes('schedule_event') || e.payload.includes('book_appointment')) &&
      !e.payload.includes('"error"') && !e.payload.includes('"success":false')
    );
    if (hasBookingSuccess) {
      const bookingLabel = blueprint.labels.find(l => l.label.toLowerCase().includes('book') || l.label.toLowerCase().includes('scheduled'))?.label || 'Booked';
      return await this.persistResult(call, blueprint, {
        resultLabel: bookingLabel,
        status: 'completed',
        score: 100,
        confidence: 1.0,
        summary: 'Appointment successfully scheduled and confirmed via calendar tool.',
        sentiment: 'Positive',
        fields: { bookingConfirmed: true },
        evidence: { tool: { quote: 'calendar_booking_event', verified: true } },
        model: 'deterministic_signals',
        latencyMs: Date.now() - startTime,
      });
    }

    // Check for Call Transfer Tool Execution
    const hasTransferSuccess = events.some(e =>
      e.eventType === 'tool_call' &&
      (e.payload.includes('transfer_call') || e.payload.includes('live_handoff'))
    );
    if (hasTransferSuccess) {
      const transferLabel = blueprint.labels.find(l => l.label.toLowerCase().includes('transfer') || l.label.toLowerCase().includes('escalat'))?.label || 'Transferred';
      return await this.persistResult(call, blueprint, {
        resultLabel: transferLabel,
        status: 'completed',
        score: null,
        confidence: 1.0,
        summary: 'Call successfully transferred to human representative.',
        sentiment: 'Neutral',
        fields: { transferred: true },
        evidence: { tool: { quote: 'call_transfer_event', verified: true } },
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
      sequenceNumber: s.sequenceNumber ?? idx,
      content: s.content || '',
    }));

    // Long call chunking
    const chunks = chunkTranscriptTurns(turns, 8000, 2);
    const chunkExtractionResults: Array<{ fields: Record<string, any>; evidence: Record<string, any>; lastTurnSequence: number }> = [];

    const apiKey = call.user.geminiApiKey || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
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

    for (const chunk of chunks) {
      const prompt = buildHardenedAnalysisPrompt({
        blueprintName: blueprint.templateName,
        blueprintDefinition: blueprint.labels.map(l => `* ${l.label}: ${l.definition}`).join('\n'),
        labelsEnum,
        fieldsDescription,
        transcriptTurns: chunk.turns,
        responseSchemaJson: responseSchemaExample,
      });

      const genResult = await model.generateContent(prompt);
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

      if (parsed.summary) primarySummary = parsed.summary;
      if (parsed.sentiment) primarySentiment = parsed.sentiment;
      if (parsed.resultLabel && labelsEnum.includes(parsed.resultLabel)) {
        primaryResultLabel = parsed.resultLabel;
      }
      if (typeof parsed.confidence === 'number') {
        primaryConfidence = parsed.confidence;
      }

      const lastSeq = chunk.turns[chunk.turns.length - 1]?.sequenceNumber ?? 0;
      chunkExtractionResults.push({
        fields: parsed.fields || {},
        evidence: parsed.evidence || {},
        lastTurnSequence: lastSeq,
      });
    }

    // Merge facts across chunks
    const { mergedFields, mergedEvidence } = mergeChunkedFacts(chunkExtractionResults);

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. CODE-BASED NORMALIZATION & VALIDATION (Section 5.6)
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
          normalizedFields[fieldDef.name] = res.value;
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
    // 5. EVIDENCE GROUNDING ENFORCEMENT (Section 5.5)
    // ─────────────────────────────────────────────────────────────────────────────
    const {
      groundedFields,
      groundedEvidence,
      evidenceFindings,
      evidenceValidityRate,
    } = enforceEvidenceGrounding(normalizedFields, mergedEvidence, segments);

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. SCORING IN CODE (Section 5.9)
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

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. HIGH-STAKES VERIFICATION PASS (Section 5.8)
    // ─────────────────────────────────────────────────────────────────────────────
    const highStakesLabels = ['Severe Distress / Emergency', 'Promise to Pay', 'Billing Dispute', 'Fraud / Phishing Alert', 'Strong Fit'];
    if (highStakesLabels.includes(primaryResultLabel) && apiKey) {
      try {
        const verifyPrompt = `High-stakes claim audit: The first pass classified this call as "${primaryResultLabel}".
Transcript:
${turns.map(t => `[${t.speaker.toUpperCase()}]: ${t.content}`).join('\n')}

Verify: Did the caller specifically and unambiguously state this?
Return JSON: { "confirm": boolean, "reason": "string" }`;

        const verifyRes = await model.generateContent(verifyPrompt);
        let vText = verifyRes.response.text().trim();
        vText = vText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const vParsed = JSON.parse(vText);

        if (vParsed.confirm === false) {
          logger.warn('AnalysisService: High-stakes verification pass DISAGREED with proposed label', {
            callId,
            proposedLabel: primaryResultLabel,
            reason: vParsed.reason,
          });
          reviewStatus = 'needs_review';
        }
      } catch (err: any) {
        logger.warn('AnalysisService: Verification pass failed to run', { error: err.message });
      }
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
   * Persists the outcome to `call_results` and keeps legacy `call` fields updated.
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

    // 1. Upsert into call_results table
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

    // 2. Backwards compatibility: update call table legacy fields
    let existingUserData: Record<string, any> = {};
    try {
      existingUserData = typeof call.userData === 'string' ? JSON.parse(call.userData) : (call.userData || {});
    } catch {}

    const updatedUserData = JSON.stringify({
      ...existingUserData,
      postCallAnalysis: {
        extractedFields: outcome.fields,
        processedAt: new Date().toISOString(),
        resultLabel: outcome.resultLabel,
        confidence: outcome.confidence,
      },
    });

    await prisma.call.update({
      where: { id: callId },
      data: {
        summary: outcome.summary,
        sentiment: outcome.sentiment,
        userData: updatedUserData,
      },
    });

    // 3. Dispatch call_analyzed webhook
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
