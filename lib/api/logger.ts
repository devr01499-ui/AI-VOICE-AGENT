/**
 * Bolna API — Structured Logger
 *
 * JSON output in production for log aggregation (ELK, Datadog, Loki).
 * Colorized console output in development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LEVEL];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

function emit(entry: LogEntry): void {
  if (process.env.NODE_ENV === 'production') {
    // Structured JSON — pipe to log aggregator
    const stream = entry.level === 'error' || entry.level === 'fatal' ? console.error : console.log;
    stream(JSON.stringify(entry));
  } else {
    // Dev-friendly output
    const color: Record<LogLevel, string> = {
      debug: '\x1b[90m',   // gray
      info: '\x1b[36m',    // cyan
      warn: '\x1b[33m',    // yellow
      error: '\x1b[31m',   // red
      fatal: '\x1b[35m',   // magenta
    };
    const reset = '\x1b[0m';
    const { level, message, timestamp, ...rest } = entry;
    const metaStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    console.log(`${color[level]}[${level.toUpperCase()}]${reset} ${timestamp} — ${message}${metaStr}`);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) emit(formatEntry('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) emit(formatEntry('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) emit(formatEntry('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) emit(formatEntry('error', message, meta));
  },
  fatal(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('fatal')) emit(formatEntry('fatal', message, meta));
  },

  /** Log an incoming API request */
  request(method: string, path: string, requestId: string, meta?: Record<string, unknown>) {
    this.info(`→ ${method} ${path}`, { requestId, ...meta });
  },

  /** Log an outgoing API response */
  response(method: string, path: string, status: number, durationMs: number, requestId: string) {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    if (shouldLog(level)) {
      emit(formatEntry(level, `← ${method} ${path} ${status} (${durationMs}ms)`, { requestId, status, durationMs }));
    }
  },
};
