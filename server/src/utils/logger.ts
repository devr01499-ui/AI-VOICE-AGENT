// ─────────────────────────────────────────────
// Voice Runtime Engine — Logger Utility
// ─────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

// ── Log redaction (Phase 12, CLAUDE.md §7 "no secrets in logs, PII redaction in logs") ──
// Applied to structured metadata (the second argument). Secrets are removed; phone numbers keep only
// their last 4 digits and emails their first character and domain, which is still enough to match a
// support ticket to a log line. Call/user/agent ids are not personal data and are kept.
const SECRET_KEY = /pass(word)?|secret|token|authorization|api[-_]?key|signature|cookie|private[-_]?key|credential/i;
const PHONE_KEY = /phone|number|^to$|^from$|recipient|caller|callee|msisdn/i;
const EMAIL_KEY = /e-?mail/i;
const PHONE_VALUE = /^\+?\d[\d\s-]{6,16}\d$/;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 ? `***${digits.slice(-4)}` : value;
}

export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  return at > 0 ? `${value[0]}***${value.slice(at)}` : value;
}

export function redactLogMeta(value: unknown, key = '', depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (key && SECRET_KEY.test(key) && !/^(has|is)[A-Z]|Id$|_id$|Count$|Length$|Set$|Configured$/.test(key)) {
    return typeof value === 'boolean' || typeof value === 'number' ? value : '[REDACTED]';
  }
  if (typeof value === 'string') {
    if (key && EMAIL_KEY.test(key) && value.includes('@')) return maskEmail(value);
    if (key && PHONE_KEY.test(key) && PHONE_VALUE.test(value.trim()) && !/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return maskPhone(value);
    return value;
  }
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (depth >= 4 || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactLogMeta(v, key, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactLogMeta(v, k, depth + 1);
  return out;
}

function formatMessage(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? (redactLogMeta(meta) as Record<string, unknown>) : {}),
  };
  try {
    return JSON.stringify(entry);
  } catch {
    // Circular metadata must never crash the caller (e.g. inside an audio loop).
    return JSON.stringify({ timestamp: entry.timestamp, level, message, meta: '[unserialisable]' });
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
};
