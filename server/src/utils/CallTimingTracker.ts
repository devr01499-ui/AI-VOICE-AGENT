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

export type TurnType = 'no_kb' | 'kb_query' | 'plain';

export interface TurnTimingRecord {
  callId: string;
  turnIndex: number;
  agentId?: string;
  turnType: TurnType;
  user_speech_end?: number;
  model_first_token?: number;
  first_audio_frame_sent_to_provider?: number;
  tool_call_start?: number;
  tool_call_end?: number;
  tool_name?: string;
  embedding_ms?: number;
  db_query_ms?: number;
  total_tool_ms?: number;
  reply_latency_ms?: number; // first_audio_frame_sent_to_provider - user_speech_end
  ttft_ms?: number;          // model_first_token - user_speech_end
  playout_delay_ms?: number; // first_audio_frame_sent_to_provider - model_first_token
  completed: boolean;
  createdAt: number;
}

export interface AgentLatencyStats {
  agentId: string;
  sampleCount: number;
  p50_ms: number;
  p95_ms: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  turns: TurnTimingRecord[];
}

class CallTimingTrackerClass {
  private timings = new Map<string, TimingRecord>();
  private turnTimings = new Map<string, TurnTimingRecord>(); // key: `${callId}:${turnIndex}`
  private activeTurns = new Map<string, number>();            // key: callId -> current turnIndex
  private completedTurnLog: TurnTimingRecord[] = [];

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

  // ─── Per-Turn Timing Engine ──────────────────────────────────────

  private getTurnKey(callId: string, turnIndex: number): string {
    return `${callId}:${turnIndex}`;
  }

  startTurn(
    callId: string,
    turnIndex: number,
    agentId?: string,
    userSpeechEndMs?: number,
    turnType: TurnType = 'plain'
  ): TurnTimingRecord {
    const key = this.getTurnKey(callId, turnIndex);
    const existing = this.turnTimings.get(key);
    const now = userSpeechEndMs || Date.now();

    if (existing) {
      if (!existing.user_speech_end) {
        existing.user_speech_end = now;
      }
      return existing;
    }

    const record: TurnTimingRecord = {
      callId,
      turnIndex,
      agentId,
      turnType,
      user_speech_end: now,
      completed: false,
      createdAt: now,
    };

    this.turnTimings.set(key, record);
    this.activeTurns.set(callId, turnIndex);

    logger.info('[PER_TURN_TIMING] user_speech_end', {
      callId,
      turnIndex,
      agentId,
      user_speech_end: now,
      turnType,
    });

    return record;
  }

  getActiveTurn(callId: string): TurnTimingRecord | undefined {
    const turnIndex = this.activeTurns.get(callId);
    if (turnIndex === undefined) return undefined;
    return this.turnTimings.get(this.getTurnKey(callId, turnIndex));
  }

  markTurnToolStart(callId: string, turnIndex: number, toolName: string): void {
    const key = this.getTurnKey(callId, turnIndex);
    let record = this.turnTimings.get(key);
    if (!record) {
      record = this.startTurn(callId, turnIndex, undefined, Date.now(), 'kb_query');
    }
    record.tool_call_start = Date.now();
    record.tool_name = toolName;
    record.turnType = 'kb_query';

    logger.info('[PER_TURN_TIMING] tool_call_start', {
      callId,
      turnIndex,
      toolName,
      timestamp: record.tool_call_start,
    });
  }

  markTurnToolEnd(
    callId: string,
    turnIndex: number,
    metrics: { embedding_ms?: number; db_query_ms?: number; total_ms?: number }
  ): void {
    const key = this.getTurnKey(callId, turnIndex);
    const record = this.turnTimings.get(key);
    if (!record) return;

    record.tool_call_end = Date.now();
    record.embedding_ms = metrics.embedding_ms;
    record.db_query_ms = metrics.db_query_ms;
    record.total_tool_ms = metrics.total_ms || (record.tool_call_end - (record.tool_call_start || record.tool_call_end));

    logger.info('[PER_TURN_TIMING] tool_call_end', {
      callId,
      turnIndex,
      toolName: record.tool_name,
      embedding_ms: record.embedding_ms,
      db_query_ms: record.db_query_ms,
      total_tool_ms: record.total_tool_ms,
      timestamp: record.tool_call_end,
    });
  }

  markTurnFirstAudioReceived(callId: string, turnIndex?: number, timestampMs?: number): number | undefined {
    const targetTurn = turnIndex !== undefined ? turnIndex : this.activeTurns.get(callId);
    if (targetTurn === undefined) return undefined;

    const key = this.getTurnKey(callId, targetTurn);
    let record = this.turnTimings.get(key);
    const now = timestampMs || Date.now();
    if (!record) {
      record = this.startTurn(callId, targetTurn, undefined, now);
    }

    if (!record.model_first_token) {
      record.model_first_token = now;
      if (record.user_speech_end) {
        record.ttft_ms = now - record.user_speech_end;
      }

      logger.info('[PER_TURN_TIMING] model_first_token', {
        callId,
        turnIndex: targetTurn,
        timestamp: now,
        ttft_ms: record.ttft_ms,
      });
    }

    return record.ttft_ms;
  }

  markTurnFirstAudioSentToTelephony(callId: string, turnIndex?: number, timestampMs?: number): number | undefined {
    const targetTurn = turnIndex !== undefined ? turnIndex : this.activeTurns.get(callId);
    if (targetTurn === undefined) return undefined;

    const key = this.getTurnKey(callId, targetTurn);
    const record = this.turnTimings.get(key);
    if (!record) return undefined;

    if (!record.first_audio_frame_sent_to_provider) {
      const now = timestampMs || Date.now();
      record.first_audio_frame_sent_to_provider = now;

      if (record.user_speech_end) {
        record.reply_latency_ms = now - record.user_speech_end;
      }
      if (record.model_first_token) {
        record.playout_delay_ms = now - record.model_first_token;
      }

      logger.info('[PER_TURN_TIMING] first_audio_frame_sent_to_provider', {
        callId,
        turnIndex: targetTurn,
        agentId: record.agentId,
        turnType: record.turnType,
        user_speech_end: record.user_speech_end,
        model_first_token: record.model_first_token,
        first_audio_frame_sent_to_provider: now,
        reply_latency_ms: record.reply_latency_ms,
        ttft_ms: record.ttft_ms,
        playout_delay_ms: record.playout_delay_ms,
        embedding_ms: record.embedding_ms,
        db_query_ms: record.db_query_ms,
        total_tool_ms: record.total_tool_ms,
      });

      logger.info(
        `[TURN_LATENCY_SUMMARY] callId=${callId} turn=${targetTurn} replyLatencyMs=${record.reply_latency_ms} ttftMs=${record.ttft_ms} playoutMs=${record.playout_delay_ms}`,
        {
          callId,
          turnIndex: targetTurn,
          reply_latency_ms: record.reply_latency_ms,
          ttft_ms: record.ttft_ms,
          playout_delay_ms: record.playout_delay_ms,
          tool_total_ms: record.total_tool_ms,
        }
      );
    }

    return record.reply_latency_ms;
  }

  completeTurn(callId: string, turnIndex?: number): void {
    const targetTurn = turnIndex !== undefined ? turnIndex : this.activeTurns.get(callId);
    if (targetTurn === undefined) return;

    const key = this.getTurnKey(callId, targetTurn);
    const record = this.turnTimings.get(key);
    if (record) {
      record.completed = true;
      this.completedTurnLog.push({ ...record });
      // Keep last 5000 turns in memory ring buffer
      if (this.completedTurnLog.length > 5000) {
        this.completedTurnLog.shift();
      }
    }
    this.activeTurns.delete(callId);
  }

  getTurnRecords(callId?: string, agentId?: string): TurnTimingRecord[] {
    let list = Array.from(this.turnTimings.values());
    if (callId) {
      list = list.filter((r) => r.callId === callId);
    }
    if (agentId) {
      list = list.filter((r) => r.agentId === agentId);
    }
    return list;
  }

  getAgentTurnStats(agentId: string): AgentLatencyStats {
    const turns = this.getTurnRecords(undefined, agentId).filter(
      (r) => typeof r.reply_latency_ms === 'number'
    );

    if (turns.length === 0) {
      return {
        agentId,
        sampleCount: 0,
        p50_ms: 0,
        p95_ms: 0,
        avg_ms: 0,
        min_ms: 0,
        max_ms: 0,
        turns: [],
      };
    }

    const latencies = turns.map((r) => r.reply_latency_ms!).sort((a, b) => a - b);
    const p50Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.5));
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));

    const sum = latencies.reduce((acc, v) => acc + v, 0);

    return {
      agentId,
      sampleCount: latencies.length,
      p50_ms: latencies[p50Index],
      p95_ms: latencies[p95Index],
      avg_ms: Math.round(sum / latencies.length),
      min_ms: latencies[0],
      max_ms: latencies[latencies.length - 1],
      turns,
    };
  }

  clear(callId: string): void {
    this.timings.delete(callId);
    this.activeTurns.delete(callId);
    for (const key of Array.from(this.turnTimings.keys())) {
      if (key.startsWith(`${callId}:`)) {
        this.turnTimings.delete(key);
      }
    }
  }
}

export const callTimingTracker = new CallTimingTrackerClass();

