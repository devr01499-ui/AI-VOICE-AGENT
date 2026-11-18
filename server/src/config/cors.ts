/**
 * Browser origins allowed to call the API with credentials (CLAUDE.md §7: strict CORS allowlist).
 *
 * Production allows only the product's own domains (claritiy.com, www/app/admin subdomains,
 * FRONTEND_URL, ADMIN_ORIGIN). Local development origins (localhost) are allowed only when
 * NODE_ENV is not production: in production they let any page served from a visitor's own machine
 * call the API with that visitor's session.
 */
export interface CorsPolicyEnv {
  nodeEnv?: string;
  frontendUrl?: string;
  adminOrigin?: string;
}

const PRODUCTION_ORIGINS = ['https://www.claritiy.com', 'https://claritiy.com'];
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
];
const ANCHORED_DOMAIN = /^https:\/\/(www\.|app\.|admin\.)?claritiy\.com$/;
const BACKEND_DOMAIN = /^https:\/\/ai-voice-agent-backend-mv32\.onrender\.com$/;

function originOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isAllowedCorsOrigin(origin: string, cfg: CorsPolicyEnv): boolean {
  const allowed = new Set<string>(PRODUCTION_ORIGINS);
  allowed.add(cfg.adminOrigin || 'https://admin.claritiy.com');
  const frontend = originOf(cfg.frontendUrl);
  if (frontend) allowed.add(frontend);
  if (cfg.nodeEnv !== 'production') DEV_ORIGINS.forEach((o) => allowed.add(o));
  return allowed.has(origin) || ANCHORED_DOMAIN.test(origin) || BACKEND_DOMAIN.test(origin);
}
