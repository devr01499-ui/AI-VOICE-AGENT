/**
 * Claritiy Voice — Deterministic Conversation Quality Linter
 * 
 * Verifies real-world conversation hygiene and catches verified robotic failure modes:
 * 1. Forbidden system phrases ("unable to check", "system error", "calendar not connected", etc.)
 * 2. Decisive scheduling: "you tell me" requires proposing ONE specific time
 * 3. Clean confirmation: when caller states a time, agent says "noted" without redundant re-confirmation
 * 4. Specific follow-up: why/when team reaches out answered with specifics (who, when, purpose)
 * 5. Neutral figure confirmation: high numbers (e.g. 5 lakh per month) acknowledged neutrally without shock
 * 6. Apology cap: maximum 1 apology per conversation
 * 7. Clean goodbye: call terminates with end_call after goodbye
 * 8. Natural register matching: Hinglish caller receives natural conversational response
 */

import { logger } from './logger';
import { prisma } from '../lib/prisma';

export interface TranscriptTurn {
  role: 'agent' | 'assistant' | 'model' | 'user' | 'caller';
  content?: string;
  text?: string;
  toolCalls?: Array<{ name: string; args?: any }>;
}

export interface LintFinding {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  turnIndex?: number;
  snippet?: string;
}

export interface LintResult {
  passed: boolean;
  score: number; // 0 to 100
  findings: LintFinding[];
  summary: {
    totalTurns: number;
    errorCount: number;
    warningCount: number;
    apologyCount: number;
    systemPhrasesDetected: string[];
  };
}

export const FORBIDDEN_SYSTEM_PATTERNS = [
  { pattern: /\bunable to check\b/i, name: 'unable to check' },
  { pattern: /\bcalendar not connected\b/i, name: 'calendar not connected' },
  { pattern: /\bgoogle calendar\b/i, name: 'google calendar' },
  { pattern: /\bcalendar error\b/i, name: 'calendar error' },
  { pattern: /\bcheck the calendar\b/i, name: 'check the calendar' },
  { pattern: /\bsystem error\b/i, name: 'system error' },
  { pattern: /\bsystem glitch\b/i, name: 'system glitch' },
  { pattern: /\btechnical glitch\b/i, name: 'technical glitch' },
  { pattern: /\btechnical error\b/i, name: 'technical error' },
  { pattern: /\bdatabase error\b/i, name: 'database error' },
  { pattern: /\bmy database\b/i, name: 'my database' },
  { pattern: /\binternal system\b/i, name: 'internal system' },
  { pattern: /\bour system\b/i, name: 'our system' },
];

export function parseTranscript(raw: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^\[?(agent|assistant|model|user|caller)\]?:\s*(.+)$/i);
    if (match) {
      const speaker = match[1].toLowerCase();
      const role = (speaker === 'user' || speaker === 'caller') ? 'user' : 'agent';
      turns.push({
        role,
        text: match[2].trim(),
      });
    }
  }

  return turns;
}

export function lintConversation(turnsOrTranscript: TranscriptTurn[] | string): LintResult {
  const turns: TranscriptTurn[] = typeof turnsOrTranscript === 'string'
    ? parseTranscript(turnsOrTranscript)
    : turnsOrTranscript.map(t => ({
        ...t,
        role: (t.role === 'user' || t.role === 'caller') ? 'user' : 'agent',
        text: t.text || t.content || '',
      }));

  const findings: LintFinding[] = [];
  const systemPhrasesDetected: string[] = [];
  let apologyCount = 0;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const text = turn.text || '';

    if (turn.role === 'agent') {
      // 1. FORBIDDEN SYSTEM TERMS CHECK
      for (const { pattern, name } of FORBIDDEN_SYSTEM_PATTERNS) {
        if (pattern.test(text)) {
          systemPhrasesDetected.push(name);
          findings.push({
            rule: 'FORBIDDEN_SYSTEM_TERMS',
            severity: 'error',
            message: `Agent leaked internal system phrase: "${name}"`,
            turnIndex: i,
            snippet: text.substring(0, 100),
          });
        }
      }

      // 6. APOLOGY COUNT CHECK
      const apologyMatches = text.match(/\b(sorry|apologize|apologies|apologise|maaf)\b/gi);
      if (apologyMatches) {
        apologyCount += apologyMatches.length;
      }
    }

    if (turn.role === 'user') {
      const nextAgentTurn = turns.slice(i + 1).find(t => t.role === 'agent');
      const nextAgentText = nextAgentTurn?.text || '';

      // 2. DECISIVE SCHEDULING: "you tell me" requires proposing ONE specific time
      const isOpenScheduling = /(you tell me|whenever|any\s*time|kabhi bhi|tum batao|aap batao|when can you do it|what does your schedule look like)/i.test(text);
      if (isOpenScheduling && nextAgentTurn) {
        const proposesSpecificTime = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*baje|tomorrow\s+(?:at\s+)?\d{1,2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(nextAgentText);
        const bouncesQuestionBack = /(what time works|when are you free|what does your schedule look like|it depends on your)/i.test(nextAgentText);

        if (!proposesSpecificTime || bouncesQuestionBack) {
          findings.push({
            rule: 'OPEN_SCHEDULING_PROPOSAL',
            severity: 'error',
            message: 'When caller expressed open availability ("you tell me"), agent failed to propose ONE specific time',
            turnIndex: i + 1,
            snippet: nextAgentText.substring(0, 100),
          });
        }
      }

      // 3. CLEAN CONFIRMATION: when caller states a time, agent says "noted" without redundant re-confirmation
      const statesSpecificTime = /\b(tomorrow\s+(?:at\s+)?\d{1,2}|\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*baje|monday\s+\d{1,2}|friday\s+\d{1,2})\b/i.test(text);
      if (statesSpecificTime && nextAgentTurn) {
        const redundantConfirm = /(would (?:tomorrow|that|\d{1,2}).*work for you\?|are you sure|can you confirm|please confirm|is that.*work for you)/i.test(nextAgentText);
        if (redundantConfirm) {
          findings.push({
            rule: 'NO_REDUNDANT_CONFIRMATION',
            severity: 'error',
            message: 'Caller stated a time, but agent redundantly asked them to confirm it again instead of acknowledging ("noted")',
            turnIndex: i + 1,
            snippet: nextAgentText.substring(0, 100),
          });
        }
      }

      // 4. SPECIFIC FOLLOW-UP: why team reaches out must be answered with specifics
      const asksWhyReachOut = /(why (?:will|would|is|your )?(?:the )?(?:recruitment )?team reach out|why.*reach out|what (?:is|are) the next steps?|kya hoga next)/i.test(text);
      if (asksWhyReachOut && nextAgentTurn) {
        const hasWho = /\b(recruiter|hiring manager|team|talent acquisition|specialist)\b/i.test(nextAgentText);
        const hasWhen = /\b(within|hours|days|tomorrow|shortly|business days|24)\b/i.test(nextAgentText);
        const hasPurpose = /\b(interview|slot|screening notes|details|profile|formal round)\b/i.test(nextAgentText);
        const isVague = /(discuss the next steps in the process|provide more details.*discussing any further requirements)/i.test(nextAgentText) && (!hasWhen || !hasPurpose);

        if (!hasWho || !hasWhen || !hasPurpose || isVague) {
          findings.push({
            rule: 'SPECIFIC_FOLLOWUP_DETAILS',
            severity: 'error',
            message: 'When caller asked why team will reach out, agent failed to answer with specifics (who, roughly when, interview slot)',
            turnIndex: i + 1,
            snippet: nextAgentText.substring(0, 100),
          });
        }
      }

      // 5. NEUTRAL FIGURE CONFIRMATION: unusual figures acknowledged neutrally
      const statesUnusualFigure = /(5 lakh|five lakh|50 lpa|10 lakh|1 crore|\b\d{2,}\s*lakh)/i.test(text);
      if (statesUnusualFigure && nextAgentTurn) {
        const expressesDisbelief = /(are you sure\?|really\?!|that('s| is) (?:very|too) high|five lakh\?!|that much\?)/i.test(nextAgentText);
        if (expressesDisbelief) {
          findings.push({
            rule: 'NEUTRAL_UNUSUAL_FIGURE',
            severity: 'error',
            message: 'Caller stated unusual figure, but agent expressed disbelief or skepticism instead of neutral acknowledgment',
            turnIndex: i + 1,
            snippet: nextAgentText.substring(0, 100),
          });
        }
      }

      // 8. NATURAL HINGLISH MATCHING: Hinglish caller receives natural conversational reply
      const isHinglishCaller = /(haan|theek hai|batao|acha|suno|main free hoon|kal chalega|kar sakte|kahiye)/i.test(text);
      if (isHinglishCaller && nextAgentTurn) {
        const isStiffTextbook = /(i shall endeavor|with the utmost diligence|i understand the confusion|pertaining to our)/i.test(nextAgentText);
        if (isStiffTextbook) {
          findings.push({
            rule: 'NATURAL_HINGLISH_MATCHING',
            severity: 'warning',
            message: 'Caller spoke in Hinglish, but agent responded with stiff, textbook formal English',
            turnIndex: i + 1,
            snippet: nextAgentText.substring(0, 100),
          });
        }
      }
    }
  }

  // Check 6: APOLOGY CAP (Max 1 apology)
  if (apologyCount > 1) {
    findings.push({
      rule: 'MAX_APOLOGIES',
      severity: 'error',
      message: `Agent apologized ${apologyCount} times (maximum allowed: 1)`,
    });
  }

  // Check 7: GOODBYE & END CALL
  const lastUserTurn = [...turns].reverse().find(t => t.role === 'user');
  if (lastUserTurn && /(thank you.*bye|goodbye|bye|have a nice day|have a great day)/i.test(lastUserTurn.text || '')) {
    const subsequentAgentTurns = turns.slice(turns.indexOf(lastUserTurn) + 1).filter(t => t.role === 'agent');
    if (subsequentAgentTurns.length > 2) {
      findings.push({
        rule: 'END_CALL_AFTER_GOODBYE',
        severity: 'warning',
        message: 'Agent continued lingering conversation for multiple turns after goodbye instead of invoking end_call',
      });
    }
  }

  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;

  let score = 100;
  score -= errorCount * 25;
  score -= warningCount * 10;
  score = Math.max(0, score);

  return {
    passed: errorCount === 0 && score >= 75,
    score,
    findings,
    summary: {
      totalTurns: turns.length,
      errorCount,
      warningCount,
      apologyCount,
      systemPhrasesDetected,
    },
  };
}

/**
 * Runs conversation quality lint on a completed call and stores findings in CallQaResult.
 * Triggers an alert if more than 5% of today's completed calls have findings.
 */
export async function runPostCallQualityAudit(callId: string): Promise<LintResult | null> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        transcriptSegments: {
          orderBy: { sequenceNumber: 'asc' },
          select: { speaker: true, content: true },
        },
      },
    });

    if (!call || call.transcriptSegments.length === 0) {
      return null;
    }

    const turns: TranscriptTurn[] = call.transcriptSegments.map(s => ({
      role: (s.speaker === 'user' || s.speaker === 'caller') ? 'user' : 'agent',
      text: s.content || '',
    }));

    const result = lintConversation(turns);

    // Ensure a Daily System QA Cohort exists for today
    const todayStr = new Date().toISOString().split('T')[0];
    const cohortName = `Daily Live Quality Audit — ${todayStr}`;

    let cohort = await prisma.qaCohort.findFirst({
      where: { name: cohortName },
    });

    if (!cohort) {
      cohort = await prisma.qaCohort.create({
        data: {
          name: cohortName,
          userId: call.userId,
          status: 'in_progress',
        },
      });
    }

    // Upsert CallQaResult
    await prisma.callQaResult.upsert({
      where: {
        cohortId_callId: {
          cohortId: cohort.id,
          callId: call.id,
        },
      },
      update: {
        overallScore: result.score,
        passed: result.passed,
        hallucinationFlag: result.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
        flaggedIssues: JSON.stringify(result.findings.map(f => f.message)),
        evaluationSummary: result.passed
          ? 'Passed conversation quality thresholds.'
          : `Failed QA checks: ${result.findings.map(f => f.message).join('; ')}`,
      },
      create: {
        cohortId: cohort.id,
        callId: call.id,
        overallScore: result.score,
        passed: result.passed,
        hallucinationFlag: result.findings.some(f => f.rule === 'FORBIDDEN_SYSTEM_TERMS'),
        flaggedIssues: JSON.stringify(result.findings.map(f => f.message)),
        evaluationSummary: result.passed
          ? 'Passed conversation quality thresholds.'
          : `Failed QA checks: ${result.findings.map(f => f.message).join('; ')}`,
      },
    });

    // Check if more than 5% of today's evaluated calls have any quality finding
    const todayResults = await prisma.callQaResult.findMany({
      where: { cohortId: cohort.id },
      select: { passed: true, flaggedIssues: true },
    });

    const totalToday = todayResults.length;
    const failedToday = todayResults.filter(r => !r.passed || (r.flaggedIssues && r.flaggedIssues !== '[]')).length;
    const failRate = totalToday > 0 ? failedToday / totalToday : 0;

    if (totalToday >= 10 && failRate > 0.05) {
      logger.warn('[QA_CONVERSATION_ALERT_THRESHOLD_EXCEEDED] Over 5% of calls failed quality lint today', {
        date: todayStr,
        totalCalls: totalToday,
        failedCalls: failedToday,
        failRate: `${(failRate * 100).toFixed(1)}%`,
        threshold: '5%',
      });
    }

    return result;
  } catch (err: any) {
    logger.error('Failed to run post-call quality audit', { callId, error: err?.message || String(err) });
    return null;
  }
}
