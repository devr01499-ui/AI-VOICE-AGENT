import { logger } from './logger';

export type TimingCheckpoint =
  | 'answer_webhook_received'
  | 'ws_stream_started'
  | 'gemini_ws_open'
  | 'gemini_setup_complete'
  | 'greeting_requested'
  | 'first_audio_chunk_from_gemini'
  | 'first_audio_sent_to_telephony';

export interface TimingRecord {
  callId: string;
  checkpoints: Partial<Record<TimingCheckpoint, number>>;
  deltas: Partial<Record<TimingCheckpoint, number>>;
}

class CallTimingTrackerClass {
  private timings = new Map<string, TimingRecord>();

  mark(callId: string, checkpoint: TimingCheckpoint, metadata?: Record<string, unknown>): number {
    const now = Date.now();
    let record = this.timings.get(callId);
    if (!record) {
      record = {
        callId,
        checkpoints: {},
        deltas: {},
      };
      this.timings.set(callId, record);
    }

    record.checkpoints[checkpoint] = now;
    const base = record.checkpoints.answer_webhook_received || now;
    const delta = now - base;
    record.deltas[checkpoint] = delta;

    logger.info(`[CALL_TIMING] ${checkpoint}`, {
      callId,
      checkpoint,
      timestamp: now,
      deltaFromAnswerMs: delta,
      ...metadata,
    });

    if (checkpoint === 'first_audio_sent_to_telephony') {
      const d = record.deltas;
      logger.info(`[CALL_TIMING_SUMMARY] callId=${callId} totalLatencyMs=${delta}`, {
        callId,
        totalLatencyMs: delta,
        answer_webhook_received: 0,
        ws_stream_started_ms: d.ws_stream_started,
        gemini_ws_open_ms: d.gemini_ws_open,
        gemini_setup_complete_ms: d.gemini_setup_complete,
        greeting_requested_ms: d.greeting_requested,
        first_audio_chunk_from_gemini_ms: d.first_audio_chunk_from_gemini,
        first_audio_sent_to_telephony_ms: d.first_audio_sent_to_telephony,
      });
    }

    return delta;
  }

  getRecord(callId: string): TimingRecord | undefined {
    return this.timings.get(callId);
  }

  clear(callId: string): void {
    this.timings.delete(callId);
  }
}

export const callTimingTracker = new CallTimingTrackerClass();
