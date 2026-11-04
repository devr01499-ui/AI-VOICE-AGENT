import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';
import { logger } from './logger';

export interface EventLoopStats {
  p50Ms: number;
  p99Ms: number;
  maxMs: number;
  activeCalls: number;
  rssMb: number;
  heapUsedMb: number;
  [key: string]: unknown;
}

class EventLoopMonitor {
  private histogram: IntervalHistogram | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private latestStats: EventLoopStats = {
    p50Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    activeCalls: 0,
    rssMb: 0,
    heapUsedMb: 0,
  };

  /**
   * Initializes the event loop delay monitor and schedules 30-second periodic telemetry.
   * Enabled by default (flag EVENT_LOOP_MONITOR !== 'false').
   */
  start(getActiveCalls: () => number): void {
    if (process.env.EVENT_LOOP_MONITOR === 'false') {
      logger.info('EventLoopMonitor: disabled via EVENT_LOOP_MONITOR=false');
      return;
    }

    try {
      this.histogram = monitorEventLoopDelay({ resolution: 10 });
      this.histogram.enable();

      this.intervalTimer = setInterval(() => {
        if (!this.histogram) return;

        // Convert nanoseconds to milliseconds rounded to two decimals
        const p50Ms = Math.round((this.histogram.percentile(50) / 1e6) * 100) / 100;
        const p99Ms = Math.round((this.histogram.percentile(99) / 1e6) * 100) / 100;
        const maxMs = Math.round((this.histogram.max / 1e6) * 100) / 100;
        const mem = process.memoryUsage();
        const rssMb = Math.round(mem.rss / 1024 / 1024);
        const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
        const activeCalls = getActiveCalls();

        this.latestStats = { p50Ms, p99Ms, maxMs, activeCalls, rssMb, heapUsedMb };
        this.histogram.reset();

        if (p99Ms > 40) {
          logger.warn('[EVENT_LOOP_LAG] Event loop p99 delay exceeds 40ms threshold', this.latestStats);
        } else {
          logger.info('[EVENT_LOOP_STATS]', this.latestStats);
        }
      }, 30000);

      this.intervalTimer.unref();
      logger.info('EventLoopMonitor: initialized (30s interval, 10ms resolution)');
    } catch (err) {
      logger.error('EventLoopMonitor: initialization failed', { error: String(err) });
    }
  }

  /**
   * Returns the most recent event loop and memory telemetry snapshot.
   */
  getStats(): EventLoopStats {
    return this.latestStats;
  }

  /**
   * Stops the monitor timer and disables the histogram.
   */
  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.histogram) {
      this.histogram.disable();
      this.histogram = null;
    }
  }
}

export const eventLoopMonitor = new EventLoopMonitor();
