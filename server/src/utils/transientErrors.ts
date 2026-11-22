/**
 * Classifies failures that are temporary (the database or the auth provider was briefly
 * unreachable, e.g. while the server restarts or the connection pool reconnects) so callers can
 * answer "try again" (HTTP 503) instead of a hard error, and the browser can retry safely.
 */

/** Prisma error codes for "could not reach / lost / timed out on the database". */
const TRANSIENT_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/** Node / pg network error codes. */
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH',
  '57P01', // admin_shutdown (the database restarted)
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now (the database is starting up)
  '53300', // too_many_connections
  '08000', '08003', '08006', '08001', '08004', // connection exceptions
]);

const TRANSIENT_MESSAGE = new RegExp(
  [
    'connection terminated',
    'connection timeout',
    'timeout exceeded when trying to connect',
    'cannot use a pool after calling end',
    'client has encountered a connection error',
    "can't reach database server",
    'server has closed the connection',
    'too many (database )?connections',
    'remaining connection slots are reserved',
    'timed out fetching a new connection',
    'socket hang up',
    'fetch failed',
  ].join('|'),
  'i',
);

function codeOf(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const anyErr = err as { code?: unknown; errorCode?: unknown };
  return String(anyErr.code ?? anyErr.errorCode ?? '');
}

/** True when a database (Prisma / pg) error means "temporarily unavailable", not a bad request or bug. */
export function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const seen = new Set<unknown>();
  let current: unknown = err;
  // Walk the cause chain: driver adapters wrap the pg error inside the Prisma error.
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = codeOf(current);
    if (TRANSIENT_PRISMA_CODES.has(code) || TRANSIENT_NET_CODES.has(code)) return true;
    const name = String((current as { name?: unknown }).name ?? '');
    if (name === 'PrismaClientInitializationError') return true;
    const message = String((current as { message?: unknown }).message ?? '');
    if (TRANSIENT_MESSAGE.test(message)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * True when a Supabase auth error means the auth service could not be reached or failed on its
 * side (network error, timeout, 5xx), as opposed to a rejected token. supabase-js returns these as
 * `AuthRetryableFetchError` (status 0 for network failures, or the 5xx status).
 */
export function isTransientAuthProviderError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, status } = error as { name?: unknown; status?: unknown };
  if (name === 'AuthRetryableFetchError') return true;
  return typeof status === 'number' && (status === 0 || status >= 500);
}
