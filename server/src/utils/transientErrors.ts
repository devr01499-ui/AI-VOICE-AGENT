/**
 * Classifies failures that are temporary (the database or the auth provider was briefly
 * unreachable, e.g. while the server restarts or the connection pool reconnects) so callers can
 * answer "try again" (HTTP 503) instead of a hard error, and the browser can retry safely.
 */

/** Prisma error codes for "could not reach / lost / timed out on the database / too many connections". */
const TRANSIENT_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037']);

/**
 * Prisma 7 driver-adapter error kinds (adapter-pg `convertDriverError`) that mean "connection
 * problem", not "bad query". Prisma wraps them as `meta.driverAdapterError.cause.kind`.
 */
const TRANSIENT_ADAPTER_KINDS = new Set(['DatabaseNotReachable', 'ConnectionClosed', 'SocketTimeout', 'TooManyConnections']);

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
    // Postgres restart / failover (57P01 text) and Supabase's connection pooler (Supavisor) limits:
    'terminating connection due to administrator command',
    'too many clients',
    'max client connections reached',
    'max clients reached',
    'emaxconn',
    'echeckouttimeout',
    'unable to check out (process|connection)',
    'connection to database closed',
    'dbhandler exited',
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
  const queue: unknown[] = [err];
  // Walk every wrapper: `cause` chains, and Prisma 7's `meta.driverAdapterError` (whose `cause`
  // holds the pg code as `originalCode` / `code`, the adapter `kind` and `originalMessage`).
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const fields = current as {
      name?: unknown; message?: unknown; kind?: unknown; originalCode?: unknown; originalMessage?: unknown;
      cause?: unknown; meta?: { driverAdapterError?: unknown };
    };
    const codes = [codeOf(current), String(fields.originalCode ?? '')];
    if (codes.some((c) => TRANSIENT_PRISMA_CODES.has(c) || TRANSIENT_NET_CODES.has(c))) return true;
    if (TRANSIENT_ADAPTER_KINDS.has(String(fields.kind ?? ''))) return true;
    if (String(fields.name ?? '') === 'PrismaClientInitializationError') return true;
    if (TRANSIENT_MESSAGE.test(String(fields.message ?? '')) || TRANSIENT_MESSAGE.test(String(fields.originalMessage ?? ''))) return true;
    queue.push(fields.cause, fields.meta?.driverAdapterError);
  }
  return false;
}

/**
 * Short, safe description of a database error for logs: the Prisma code plus the driver-adapter
 * kind / pg code, so an AUTH-TRACE reference in the Render log says what actually failed.
 */
export function describeDbError(err: unknown): { code: string; adapterKind?: string; pgCode?: string } {
  const code = codeOf(err);
  const cause = (err as { meta?: { driverAdapterError?: { cause?: { kind?: unknown; originalCode?: unknown; code?: unknown } } } } | null)
    ?.meta?.driverAdapterError?.cause;
  return {
    code,
    ...(cause?.kind ? { adapterKind: String(cause.kind) } : {}),
    ...(cause?.originalCode || cause?.code ? { pgCode: String(cause.originalCode ?? cause.code) } : {}),
  };
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
