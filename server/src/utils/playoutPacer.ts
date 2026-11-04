/**
 * Claritiy Voice Server — Drift-Corrected Playout Pacer (Task T2)
 *
 * Implements a monotonic clock scheduler with a jitter buffer (PLAYOUT_LEAD_MS)
 * to deliver audio chunks to telephony carriers at a smooth, stable 20ms cadence,
 * preventing robotic/choppy voice caused by event-loop timer jitter and cumulative drift.
 */

export interface PlayoutPacerConfig {
  leadMs?: number;
  onSendFrame: (frameBase64: string, frameBytes: number) => void;
  onPlayoutStateChange?: (isPlaying: boolean) => void;
}

export interface PlayoutPacerStats {
  framesSent: number;
  underruns: number;
  maxGapMs: number;
  totalLeadMs: number;
  leadSamplesCount: number;
  maxQueueMs: number;
  lastFrameSentAt?: number;
}

export class PlayoutPacer {
  public static readonly FRAME_SIZE_BYTES = 640; // 20ms @ 16kHz 16-bit mono PCM (320 samples * 2)
  public static readonly FRAME_DURATION_MS = 20;

  private readonly leadMs: number;
  private readonly onSendFrame: (frameBase64: string, frameBytes: number) => void;
  private readonly onPlayoutStateChange?: (isPlaying: boolean) => void;

  private queue: Buffer[] = [];
  private remainderBuffer?: Buffer;
  private timer?: NodeJS.Timeout | NodeJS.Immediate;
  private carrierPlayoutUntil?: number; // Monotonic ms (performance.now()) when carrier audio empties
  private nextSendAt?: number;
  private isDestroyed = false;

  public readonly stats: PlayoutPacerStats = {
    framesSent: 0,
    underruns: 0,
    maxGapMs: 0,
    totalLeadMs: 0,
    leadSamplesCount: 0,
    maxQueueMs: 0,
  };

  constructor(config: PlayoutPacerConfig) {
    const rawLead = config.leadMs ?? parseInt(process.env.PLAYOUT_LEAD_MS || '80', 10);
    this.leadMs = Math.max(40, Math.min(200, isNaN(rawLead) ? 80 : rawLead));
    this.onSendFrame = config.onSendFrame;
    this.onPlayoutStateChange = config.onPlayoutStateChange;
  }

  /**
   * Enqueues an audio chunk (base64 PCM16 16kHz mono), reframes into 20ms slices,
   * carries remainders across chunks, and triggers playout pump.
   */
  enqueueAudio(base64Payload: string): void {
    if (this.isDestroyed || !base64Payload) return;

    const chunk = Buffer.from(base64Payload, 'base64');
    if (chunk.length === 0) return;

    let input = chunk;
    if (this.remainderBuffer && this.remainderBuffer.length > 0) {
      input = Buffer.concat([this.remainderBuffer, chunk]);
      this.remainderBuffer = undefined;
    }

    let offset = 0;
    while (offset + PlayoutPacer.FRAME_SIZE_BYTES <= input.length) {
      this.queue.push(input.subarray(offset, offset + PlayoutPacer.FRAME_SIZE_BYTES));
      offset += PlayoutPacer.FRAME_SIZE_BYTES;
    }

    if (offset < input.length) {
      this.remainderBuffer = Buffer.from(input.subarray(offset));
    }

    const currentQueueMs = this.queue.length * PlayoutPacer.FRAME_DURATION_MS;
    if (currentQueueMs > this.stats.maxQueueMs) {
      this.stats.maxQueueMs = currentQueueMs;
    }

    this.pump();
  }

  /**
   * Core pacing pump: bursts up to target lead immediately (0ms first-audio latency),
   * then meters subsequent frames on a monotonic clock to maintain steady 20ms cadence.
   */
  private pump(): void {
    if (this.isDestroyed) return;

    const now = performance.now();

    // Check if carrier buffer starved (underrun)
    if (this.carrierPlayoutUntil === undefined || this.carrierPlayoutUntil < now) {
      if (this.carrierPlayoutUntil !== undefined && this.carrierPlayoutUntil < now) {
        this.stats.underruns++;
      }
      this.carrierPlayoutUntil = now;
      this.nextSendAt = undefined;
    }

    // Burst initial frames immediately up to PLAYOUT_LEAD_MS
    while (this.queue.length > 0 && (this.carrierPlayoutUntil - now) < this.leadMs) {
      const frame = this.queue.shift()!;
      this.transmitFrame(frame, now);
      this.carrierPlayoutUntil += PlayoutPacer.FRAME_DURATION_MS;
      this.nextSendAt = this.carrierPlayoutUntil - this.leadMs;
    }

    this.scheduleNext();
  }

  /**
   * Schedules transmission of the next 20ms frame using hybrid timer for sub-5ms variance.
   */
  private scheduleNext(): void {
    if (this.isDestroyed) return;

    if (this.queue.length === 0) {
      // Queue empty: set completion callback after carrier finishes playing
      if (this.onPlayoutStateChange && this.carrierPlayoutUntil !== undefined) {
        const remainingPlayMs = Math.max(0, Math.round(this.carrierPlayoutUntil - performance.now()));
        this.cancelTimer();
        this.timer = setTimeout(() => {
          this.timer = undefined;
          if (this.queue.length === 0 && this.onPlayoutStateChange) {
            this.onPlayoutStateChange(false);
          }
        }, remainingPlayMs + 30);
      }
      return;
    }

    const now = performance.now();
    const targetTime = this.nextSendAt ?? (this.carrierPlayoutUntil ? this.carrierPlayoutUntil - this.leadMs : now);
    const diff = targetTime - now;

    if (diff <= 1.0) {
      // Due now: transmit single frame and advance target by 20ms
      const frame = this.queue.shift()!;
      this.transmitFrame(frame, now);
      this.carrierPlayoutUntil = Math.max(now, (this.carrierPlayoutUntil || now)) + PlayoutPacer.FRAME_DURATION_MS;
      this.nextSendAt = targetTime + PlayoutPacer.FRAME_DURATION_MS;
      this.scheduleNext();
    } else if (diff > 12) {
      // Coarse sleep via setTimeout
      this.cancelTimer();
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.scheduleNext();
      }, Math.floor(diff - 8));
    } else {
      // Fine sleep via setImmediate
      this.cancelTimer();
      this.timer = setImmediate(() => {
        this.timer = undefined;
        this.scheduleNext();
      });
    }
  }

  /**
   * Transmits a 20ms frame to the carrier and updates jitter and gap metrics.
   */
  private transmitFrame(frame: Buffer, nowPerf: number): void {
    if (this.stats.lastFrameSentAt !== undefined) {
      const gap = nowPerf - this.stats.lastFrameSentAt;
      if (gap > this.stats.maxGapMs) {
        this.stats.maxGapMs = Math.round(gap);
      }
    }
    this.stats.lastFrameSentAt = nowPerf;
    this.stats.framesSent++;

    const currentLead = Math.max(0, (this.carrierPlayoutUntil || nowPerf) - nowPerf);
    this.stats.totalLeadMs += currentLead;
    this.stats.leadSamplesCount++;

    if (this.onPlayoutStateChange) {
      this.onPlayoutStateChange(true);
    }

    this.onSendFrame(frame.toString('base64'), frame.length);
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer as NodeJS.Timeout);
      clearImmediate(this.timer as NodeJS.Immediate);
      this.timer = undefined;
    }
  }

  /**
   * Purges the queue and cancels scheduled timers immediately on user interruption (barge-in).
   * Ensures ZERO leftover frames leak into the subsequent turn.
   */
  clear(): void {
    this.queue = [];
    this.remainderBuffer = undefined;
    this.cancelTimer();
    this.carrierPlayoutUntil = undefined;
    this.nextSendAt = undefined;
    if (this.onPlayoutStateChange) {
      this.onPlayoutStateChange(false);
    }
  }

  /**
   * Returns current unplayed lead held by carrier in milliseconds.
   */
  getCarrierLeadMs(): number {
    const now = performance.now();
    return this.carrierPlayoutUntil && this.carrierPlayoutUntil > now
      ? Math.round(this.carrierPlayoutUntil - now)
      : 0;
  }

  /**
   * Returns milliseconds of audio currently buffered in the queue + carrier lead.
   */
  getRemainingMs(): number {
    const queueMs = this.queue.length * PlayoutPacer.FRAME_DURATION_MS;
    return queueMs + this.getCarrierLeadMs();
  }

  /**
   * Cleans up timers and resources when the call connection closes.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
  }
}
