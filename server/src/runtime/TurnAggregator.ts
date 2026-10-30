/**
 * Claritiy Voice Server — Turn Aggregator (v2: independent caller / agent buffers)
 *
 * Gemini Live delivers the caller's transcription and the agent's transcription as TWO independent,
 * delayed streams. The caller's words routinely keep arriving after the agent has already started
 * replying, and the agent's words arrive after its audio.
 *
 * v1 kept ONE buffer and cut a "turn" every time the speaker changed. With interleaved streams that
 * shredded sentences ("They'll be reaching out to discuss the next steps in the" | caller fragment |
 * "process."), split a caller's sentence at every thinking pause, and stored fragments out of order.
 *
 * v2 rules:
 *  - Caller and agent each have their OWN open turn. A fragment is appended to its speaker's turn
 *    no matter what the other speaker is doing.
 *  - The sequence number is taken when a turn STARTS, so the transcript reads in the order people
 *    began speaking, even though turns finish at different times.
 *  - The caller's turn is closed shortly after the agent starts answering (a short grace window lets
 *    late transcription fragments still land in the right sentence), on turnComplete, after a longer
 *    idle gap, or at call end. A thinking pause no longer splits a sentence.
 *  - The agent's turn is closed on turnComplete, on barge-in (the caller interrupted), after idle, or at call end.
 *  - Text is tidied for display (spacing, punctuation spacing, leading capital) without changing words.
 *
 * Persists exactly ONE segment per turn, with explicit sequence numbers, so history is never shredded.
 */

import { logger } from '../utils/logger';
import { eventBus, PROVIDER_EVENTS } from '../core/provider-sdk/provider.events';
import { TranscriptManager } from './TranscriptManager';
import type { Speaker } from '../types';

type Who = 'agent' | 'user';

export interface TurnState {
  turnId: string;
  seq: number;
  speaker: Who;
  text: string;
  startTime: number;
  lastUpdateTime: number;
}

export interface TurnAggregatorOptions {
  /** How long after the agent starts answering the caller's turn stays open for late fragments. */
  userGraceMs?: number;
  /** Idle gap that closes the caller's turn when the agent has not answered. Longer than a thinking pause. */
  userIdleMs?: number;
  /** Idle gap that closes the agent's turn if turnComplete never arrives. */
  agentIdleMs?: number;
  /** Test seam: replaces database persistence. */
  transcriptManager?: Pick<TranscriptManager, 'addUtterance'>;
  /** Test seam: replaces the live event bus publish. */
  publish?: (payload: any) => void;
}

/**
 * Tidy a transcript for display. Never adds, removes or reorders words.
 */
export function normalizeTranscriptText(raw: string): string {
  let t = (raw || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.replace(/\s+([,.;:!?])/g, '$1');                 // "word ." -> "word."
  t = t.replace(/([a-z])([.!?])(?=[A-Z][a-z])/g, '$1$2 '); // "Hello.How" -> "Hello. How"
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase()); // sentence capitals
  return t;
}

export class TurnAggregator {
  private callId: string;
  private sessionStartTime: number;
  private turnSeq = 0;
  private readonly open: Record<Who, TurnState | null> = { user: null, agent: null };
  private readonly timers: Record<Who, NodeJS.Timeout | null> = { user: null, agent: null };
  private readonly userGraceMs: number;
  private readonly userIdleMs: number;
  private readonly agentIdleMs: number;
  private transcriptManager: Pick<TranscriptManager, 'addUtterance'>;
  private publishFn: (payload: any) => void;
  private isDestroyed = false;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(
    callId: string,
    sessionStartTime: number = Date.now(),
    idleTimeoutMs: number = 1500,
    options: TurnAggregatorOptions = {}
  ) {
    this.callId = callId;
    this.sessionStartTime = sessionStartTime;
    this.userGraceMs = options.userGraceMs ?? 900;
    this.userIdleMs = options.userIdleMs ?? Math.max(2500, idleTimeoutMs);
    this.agentIdleMs = options.agentIdleMs ?? Math.max(2500, idleTimeoutMs);
    this.transcriptManager = options.transcriptManager ?? new TranscriptManager();
    this.publishFn = options.publish ?? ((payload) => eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, payload));
  }

  /**
   * Ingest a fragment delta from the AI or caller transcription stream.
   */
  public handleFragment(rawSpeaker: 'agent' | 'user' | 'caller' | 'assistant', delta: string, isFinal: boolean): void {
    if (this.isDestroyed) return;
    const speaker: Who = (rawSpeaker === 'caller' || rawSpeaker === 'user') ? 'user' : 'agent';

    // turnComplete from the provider: the model finished its reply, so both open turns are complete.
    if ((!delta || !delta.trim()) && isFinal) {
      this.closeTurn('agent');
      // Close the caller's turn too, unless they have already started talking again (barge-in /
      // next utterance): cutting that one here would split their sentence.
      const u = this.open.user;
      if (u && Date.now() - u.lastUpdateTime >= 700) this.closeTurn('user');
      return;
    }
    if (!delta) return;

    const now = Date.now();
    let turn = this.open[speaker];
    if (!turn) {
      this.turnSeq += 1;
      turn = {
        turnId: `${this.callId}_turn_${this.turnSeq}_${now}`,
        seq: this.turnSeq,
        speaker,
        text: '',
        startTime: Math.max(0, Math.floor((now - this.sessionStartTime) / 1000)),
        lastUpdateTime: now,
      };
      this.open[speaker] = turn;
    }
    turn.text += delta;
    turn.lastUpdateTime = now;

    this.publishFn({
      callId: this.callId,
      turnId: turn.turnId,
      seq: turn.seq,
      speaker: turn.speaker,
      text: normalizeTranscriptText(turn.text),
      isFinal: false,
    });

    if (speaker === 'agent') {
      // The agent is answering, so the caller's turn is essentially complete. Keep it open only for a
      // short grace window so late transcription fragments still land in the right sentence.
      if (this.open.user) this.arm('user', this.userGraceMs);
      this.arm('agent', this.agentIdleMs);
    } else {
      // Caller still talking (or late fragments): extend the right timer.
      const agentSpeaking = Boolean(this.open.agent);
      this.arm('user', agentSpeaking ? this.userGraceMs : this.userIdleMs);
    }

    if (isFinal) this.closeTurn(speaker);
  }

  /**
   * Caller barged in: the agent's current sentence was cut off, so close it. The caller's turn stays open.
   */
  public handleInterruption(): void {
    if (this.open.agent) {
      logger.info('TurnAggregator: caller interruption closed the agent turn', {
        callId: this.callId,
        turnId: this.open.agent.turnId,
      });
      this.closeTurn('agent');
    }
  }

  /**
   * Close all open turns now (kept for API compatibility).
   */
  public flushTurn(_isFinal: boolean = true): void {
    this.closeTurn('agent');
    this.closeTurn('user');
  }

  private arm(who: Who, ms: number): void {
    const existing = this.timers[who];
    if (existing) clearTimeout(existing);
    this.timers[who] = setTimeout(() => this.closeTurn(who), ms);
  }

  private closeTurn(who: Who): void {
    const t = this.timers[who];
    if (t) { clearTimeout(t); this.timers[who] = null; }

    const turn = this.open[who];
    if (!turn) return;
    this.open[who] = null;

    const text = normalizeTranscriptText(turn.text);
    if (!text) return;

    const endOffset = Math.max(turn.startTime, Math.floor((Date.now() - this.sessionStartTime) / 1000));

    this.publishFn({
      callId: this.callId,
      turnId: turn.turnId,
      seq: turn.seq,
      speaker: turn.speaker,
      text,
      isFinal: true,
    });

    // One segment per turn, explicit sequence number = order in which the turn STARTED.
    this.persistQueue = this.persistQueue.then(async () => {
      try {
        await this.transcriptManager.addUtterance(
          this.callId,
          turn.speaker as Speaker,
          text,
          turn.startTime,
          endOffset,
          undefined,
          turn.seq
        );
      } catch (err: any) {
        logger.error('TurnAggregator: Failed to persist turn segment', {
          callId: this.callId,
          turnId: turn.turnId,
          seq: turn.seq,
          error: err?.message || String(err),
        });
      }
    });
  }

  /**
   * Wait for all queued segment database writes to complete
   */
  public async waitForPersistence(): Promise<void> {
    await this.persistQueue;
  }

  /**
   * Teardown on call end: flush everything, then stop accepting fragments.
   */
  public destroy(): void {
    this.closeTurn('agent');
    this.closeTurn('user');
    this.isDestroyed = true;
    for (const who of ['agent', 'user'] as Who[]) {
      const t = this.timers[who];
      if (t) { clearTimeout(t); this.timers[who] = null; }
    }
  }
}
