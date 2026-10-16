/**
 * Claritiy Voice Server — Turn Aggregator
 * 
 * Aggregates fragmented streaming transcript deltas from Gemini / STT into coherent conversational turns.
 * Flushes turns on:
 * 1. Speaker change (caller <-> agent)
 * 2. Gemini turnComplete signal (isFinal = true)
 * 3. User interruption
 * 4. Idle timeout (~1500ms)
 * 5. Call termination
 * 
 * Guarantees monotonic sequence numbers and persists exactly ONE segment per conversational turn
 * to prevent database transcript shredding.
 */

import { logger } from '../utils/logger';
import { eventBus, PROVIDER_EVENTS } from '../core/provider-sdk/provider.events';
import { TranscriptManager } from './TranscriptManager';
import type { Speaker } from '../types';

export interface TurnState {
  turnId: string;
  seq: number;
  speaker: 'agent' | 'user';
  text: string;
  startTime: number;
  lastUpdateTime: number;
}

export class TurnAggregator {
  private callId: string;
  private sessionStartTime: number;
  private currentTurn: TurnState | null = null;
  private turnSeq: number = 0;
  private idleTimeoutMs: number = 1500;
  private idleTimer: NodeJS.Timeout | null = null;
  private transcriptManager: TranscriptManager;
  private isDestroyed: boolean = false;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(callId: string, sessionStartTime: number = Date.now(), idleTimeoutMs: number = 1500) {
    this.callId = callId;
    this.sessionStartTime = sessionStartTime;
    this.idleTimeoutMs = idleTimeoutMs;
    this.transcriptManager = new TranscriptManager();
  }

  /**
   * Ingest a fragment delta from the AI or User STT stream
   */
  public handleFragment(rawSpeaker: 'agent' | 'user' | 'caller' | 'assistant', delta: string, isFinal: boolean): void {
    if (this.isDestroyed) return;

    const speaker: 'agent' | 'user' = (rawSpeaker === 'caller' || rawSpeaker === 'user') ? 'user' : 'agent';
    const nowOffset = Math.max(0, Math.floor((Date.now() - this.sessionStartTime) / 1000));

    // Case 1: Empty text with isFinal=true indicates turn completion from provider (e.g. Gemini turnComplete)
    if ((!delta || !delta.trim()) && isFinal) {
      if (this.currentTurn) {
        this.flushTurn(true);
      }
      return;
    }

    if (!delta) return;

    // Case 2: Speaker change -> Flush existing turn immediately before starting next
    if (this.currentTurn && this.currentTurn.speaker !== speaker) {
      this.flushTurn(true);
    }

    // Case 3: Start new turn if none active
    if (!this.currentTurn) {
      this.turnSeq += 1;
      this.currentTurn = {
        turnId: `${this.callId}_turn_${this.turnSeq}_${Date.now()}`,
        seq: this.turnSeq,
        speaker,
        text: '',
        startTime: nowOffset,
        lastUpdateTime: Date.now(),
      };
    }

    // Append text fragment
    this.currentTurn.text += delta;
    this.currentTurn.lastUpdateTime = Date.now();

    // Broadcast live interim event over EventBus
    eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, {
      callId: this.callId,
      turnId: this.currentTurn.turnId,
      seq: this.currentTurn.seq,
      speaker: this.currentTurn.speaker,
      text: this.currentTurn.text,
      isFinal: Boolean(isFinal),
    });

    // Reset idle flush timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (isFinal) {
      this.flushTurn(true);
    } else {
      this.idleTimer = setTimeout(() => {
        this.flushTurn(true);
      }, this.idleTimeoutMs);
    }
  }

  /**
   * Handle user interruption -> close turn immediately
   */
  public handleInterruption(): void {
    if (this.currentTurn) {
      logger.info('TurnAggregator: user interruption flushed active turn', {
        callId: this.callId,
        turnId: this.currentTurn.turnId,
        speaker: this.currentTurn.speaker
      });
      this.flushTurn(true);
    }
  }

  /**
   * Flush current turn and persist to database
   */
  public flushTurn(isFinal: boolean = true): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (!this.currentTurn) return;

    const turn = this.currentTurn;
    const trimmedText = turn.text.trim();

    if (!trimmedText) {
      this.currentTurn = null;
      return;
    }

    const endOffset = Math.max(turn.startTime, Math.floor((Date.now() - this.sessionStartTime) / 1000));

    // Emit final transcript update for the live monitor
    eventBus.publish(PROVIDER_EVENTS.TRANSCRIPT_UPDATED, {
      callId: this.callId,
      turnId: turn.turnId,
      seq: turn.seq,
      speaker: turn.speaker,
      text: trimmedText,
      isFinal: true,
    });

    // Persist single unified segment to database sequentially using monotonic turn.seq
    this.persistQueue = this.persistQueue.then(async () => {
      try {
        await this.transcriptManager.addUtterance(
          this.callId,
          turn.speaker as Speaker,
          trimmedText,
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

    this.currentTurn = null;
  }

  /**
   * Wait for all queued segment database writes to complete
   */
  public async waitForPersistence(): Promise<void> {
    await this.persistQueue;
  }

  /**
   * Teardown on call end
   */
  public destroy(): void {
    this.flushTurn(true);
    this.isDestroyed = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
