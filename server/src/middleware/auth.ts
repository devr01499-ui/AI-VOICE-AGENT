import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../utils/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ADMIN_EMAIL } from '../config/constants';
import { isIpAllowed, getTrustedClientIp } from '../utils/ipChecker';
import { normalizeEmail, isDisposableEmail } from '../utils/emailNormalizer';
import { normalizePhoneNumber } from '../utils/phoneValidator';
import { isTransientDbError, isTransientAuthProviderError, describeDbError } from '../utils/transientErrors';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
  effectiveWorkspaceId?: string;
  workspaceRole?: string;
  auth?: {
    userId: string;
  };
}

/**
 * Requests this middleware has already authenticated. Most routers are mounted with requireAuth
 * AND list it again on each route, so without this every request verified the token with Supabase
 * and read the user rows twice (double load on the auth provider and the connection pool).
 */
const authenticatedRequests = new WeakSet<object>();
/** Requests that already used their one server-side retry after a temporary database error. */
const retriedRequests = new WeakSet<object>();
const AUTH_DB_RETRY_DELAY_MS = 300;

/** A verified session: who the caller is, which workspace they act in, and their profile row. */
interface SessionContext {
  userId: string;
  effectiveWorkspaceId: string;
  workspaceRole: string;
  userProfile: any;
  allowedIpRanges: string[];
}
type SessionResult =
  | { kind: 'ok'; ctx: SessionContext }
  | { kind: 'deny'; status: number; body: Record<string, unknown> }
  | { kind: 'provider_unavailable'; error: { message?: string; status?: number } };

/**
 * One verification per token at a time. A dashboard page fires ~10 API calls in parallel with
 * the same token; they now share one Supabase check and one set of database reads instead of
 * ten (owner reports 2026-11-22/23: AUTH-TRACE under load on the free database plan).
 * Nothing is cached after the promise settles, so a signed-out or suspended user is never
 * served from memory.
 */
const inflightSessions = new Map<string, Promise<SessionResult>>();

function tokenKey(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resolveSessionShared(token: string): Promise<SessionResult> {
  const key = tokenKey(token);
  const existing = inflightSessions.get(key);
  if (existing) return existing;
  const pending = resolveSession(token).finally(() => inflightSessions.delete(key));
  inflightSessions.set(key, pending);
  return pending;
}

/** Throws with `authPhase` set, so the log and the customer-facing reference name the stage. */
async function resolveSession(token: string): Promise<SessionResult> {
  let phase = 'supabase_getUser';
  try {
    // Verify signature via official Supabase client SDK getUser call
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error && isTransientAuthProviderError(error)) {
      // The auth provider could not be reached: the token was not rejected.
      return { kind: 'provider_unavailable', error: { message: error.message, status: (error as { status?: number }).status } };
    }
    if (error || !user) {
      return { kind: 'deny', status: 401, body: { success: false, error: 'Unauthorized: Invalid Supabase signature token' } };
    }

    const userId = user.id;
    const rawEmail = user.email || '';
    const userMetadata: any = user.user_metadata || {};

    let normalizedEmail = '';
    if (rawEmail) {
      try {
        normalizedEmail = normalizeEmail(rawEmail);
      } catch {
        return { kind: 'deny', status: 400, body: { success: false, error: 'Malformed email address in session context' } };
      }
    }

    // Block disposable email addresses immediately
    if (rawEmail && isDisposableEmail(rawEmail)) {
      return {
        kind: 'deny',
        status: 403,
        body: {
          success: false,
          error: 'DISPOSABLE_EMAIL_PROHIBITED',
          message: 'Signups using temporary or disposable email domains are blocked. Please use a permanent email address.',
        },
      };
    }

    phase = 'user_lookup';
    // The full row: it is the request's profile when nothing needs syncing (no write per request).
    let userProfile = await prisma.user.findUnique({ where: { id: userId } });
    const isExistingAdmin = userProfile?.accountType === 'admin';

    // 3. THE EXPLICIT IDENTITY BIND — Require genuine email confirmation (never trust client metadata)
    if (!isExistingAdmin && normalizedEmail !== ADMIN_EMAIL) {
      if (!user.email_confirmed_at) {
        return {
          kind: 'deny',
          status: 403,
          body: {
            success: false,
            error: 'EMAIL_NOT_VERIFIED',
            message: 'Access Denied: Please verify your email address via the link sent to your inbox before accessing workspace features.',
          },
        };
      }
    }

    // 4. DUPLICATE EMAIL PREVENTION — Check if normalized email is registered under a different UUID.
    // When this user's row already holds this email, no other row can (email is unique): skip the query.
    if (normalizedEmail && userProfile?.email !== normalizedEmail) {
      phase = 'duplicate_email_check';
      const existingUserWithEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUserWithEmail && existingUserWithEmail.id !== userId) {
        logger.warn('[requireAuth] Blocked duplicate account signup attempt via alias', {
          incomingUserId: userId,
          existingUserId: existingUserWithEmail.id,
        });
        return {
          kind: 'deny',
          status: 409,
          body: {
            success: false,
            error: 'DUPLICATE_ACCOUNT',
            message: 'An account associated with this email address already exists. Duplicate alias signups are blocked.',
          },
        };
      }
    }

    // Extract profile attributes
    const fullName = typeof userMetadata.full_name === 'string' && userMetadata.full_name.trim()
      ? userMetadata.full_name
      : (normalizedEmail ? normalizedEmail.split('@')[0] : 'Supabase User');
    // Sign-up metadata is client-controlled: store the contact number only if it is a valid phone number.
    const phoneCheck = normalizePhoneNumber(userMetadata.contact_number);
    const contactNumber = phoneCheck.ok ? phoneCheck.e164 : null;

    if (!userProfile) {
      phase = 'database_upsert';
      // First request of a new account. NEVER allow client metadata to set or escalate
      // accountType! accountType is exclusively modified by authoritative BillingService
      // transactions or Staff Admin.
      // Prisma runs this upsert as read-then-insert, so two first requests racing (two tabs, two
      // tokens) made the loser fail with P2002 on users_email_key -> the AUTH-TRACE 500. The
      // winner's row is the answer: read it back instead of failing.
      userProfile = await prisma.user.upsert({
        where: { id: userId },
        update: {
          fullName,
          ...(contactNumber ? { contactNumber } : {}),
        },
        create: {
          id: userId,
          email: normalizedEmail || `user-${userId}@supabase.io`,
          fullName,
          accountType: normalizedEmail === ADMIN_EMAIL ? 'admin' : 'free',
          contactNumber,
          passwordHash: 'seeded-supabase-auth-placeholder',
          billingBalance: 0.0,
          callingBalanceMinutes: 0.0,
        },
      }).catch(async (createErr: any) => {
        if (createErr?.code !== 'P2002') throw createErr;
        const winner = await prisma.user.findUnique({ where: { id: userId } });
        if (!winner) throw createErr; // the email belongs to a different account: a real conflict
        return winner;
      });
    } else if (userProfile.fullName !== fullName || (contactNumber && userProfile.contactNumber !== contactNumber)) {
      phase = 'profile_sync';
      // Same result as the old upsert on every request, written only when something changed.
      // The account exists, so a failed sync must not lock the customer out: keep the stored row.
      try {
        userProfile = await prisma.user.update({
          where: { id: userId },
          data: { fullName, ...(contactNumber ? { contactNumber } : {}) },
        });
      } catch (syncErr: any) {
        logger.warn('[requireAuth] profile sync skipped; using the stored profile', { userId, ...describeDbError(syncErr) });
      }
    }

    phase = 'team_lookup';
    // Oldest membership wins, so a person in two teams always lands in the same one (audit #49).
    const teamMember = await prisma.teamMember.findFirst({
      where: { memberId: userId },
      orderBy: { createdAt: 'asc' },
    });

    let effectiveWorkspaceId = userId;
    let workspaceRole = 'admin';
    if (teamMember) {
      effectiveWorkspaceId = teamMember.ownerId;
      workspaceRole = teamMember.role || 'viewer';
    }

    phase = 'workspace_owner_lookup';
    const workspaceOwner = effectiveWorkspaceId === userId
      ? userProfile
      : await prisma.user.findUnique({ where: { id: effectiveWorkspaceId }, select: { allowedIpRanges: true } });

    // Throttled lastSeenAt update (at most once every 10 minutes), never blocking the request.
    const tenMinutesMs = 10 * 60 * 1000;
    const lastSeen = userProfile.lastSeenAt ? new Date(userProfile.lastSeenAt).getTime() : 0;
    if (!lastSeen || Date.now() - lastSeen > tenMinutesMs) {
      prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      }).catch((updateErr) => {
        logger.warn('[requireAuth] Failed non-blocking lastSeenAt update', { userId, error: updateErr.message });
      });
    }

    return {
      kind: 'ok',
      ctx: {
        userId,
        effectiveWorkspaceId,
        workspaceRole,
        userProfile,
        allowedIpRanges: workspaceOwner?.allowedIpRanges || [],
      },
    };
  } catch (err: any) {
    if (err && typeof err === 'object') err.authPhase = phase;
    throw err;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (authenticatedRequests.has(req) && req.userId) {
    next();
    return;
  }
  let activePhase = 'token_verification';
  try {
    let authHeader = req.headers.authorization;
    if (!authHeader && req.query.token && typeof req.query.token === 'string') {
      authHeader = `Bearer ${req.query.token}`;
    }

    if (!authHeader) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing authenticated session context' });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing or malformed authorization header context' });
      return;
    }

    const token = authHeader.substring(7).trim();

    // Defensive Validation Boundary: Instantly catch undefined or clear non-JWT footprints
    if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) {
      res.status(401).json({ success: false, error: 'Invalid authentication token structure' });
      return;
    }

    activePhase = 'session_resolve';
    const result = await resolveSessionShared(token);

    if (result.kind === 'provider_unavailable') {
      // Answer "try again" (503) instead of 401, because the dashboard signs the customer out on a 401.
      const refCode = `AUTH-TRACE-${Date.now()}`;
      logger.warn(`requireAuth: auth provider temporarily unavailable [${refCode}]`, { ...result.error, refCode });
      sendTemporarilyUnavailable(res, refCode);
      return;
    }
    if (result.kind === 'deny') {
      res.status(result.status).json(result.body);
      return;
    }

    const { userId, effectiveWorkspaceId, workspaceRole, userProfile, allowedIpRanges } = result.ctx;

    // IP Allowlist Check (per request: it depends on this request's address)
    if (allowedIpRanges.length > 0) {
      const clientIp = getTrustedClientIp(req);
      if (!isIpAllowed(clientIp, allowedIpRanges)) {
        logger.warn('[requireAuth] Access denied by workspace IP allowlist', {
          userId,
          effectiveWorkspaceId,
          clientIp,
          allowedIpRanges,
        });
        res.status(403).json({
          success: false,
          error: `Access Denied: IP address (${clientIp}) is not in the workspace allowed IP range. Contact your administrator or refer to database emergency recovery procedures.`
        });
        return;
      }
    }

    // Account Suspension Check (Customer Platform Gate)
    if (userProfile.accountStatus === 'suspended') {
      logger.warn('[requireAuth] Blocked request from suspended customer account', {
        userId,
        reason: userProfile.suspendedReason,
      });
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended.',
        reason: userProfile.suspendedReason || 'Terms violation or administrative hold.',
        contactSupport: 'support@claritiy.com',
      });
      return;
    }

    req.userId = userId;
    req.effectiveWorkspaceId = effectiveWorkspaceId;
    req.workspaceRole = workspaceRole;
    req.user = { ...userProfile }; // own copy per request (the session result may be shared)
    if (req && typeof req === 'object') {
      req.auth = { userId };
    }
    authenticatedRequests.add(req);
    next();
  } catch (err: any) {
    const refCode = `AUTH-TRACE-${Date.now()}`;
    const phase = err?.authPhase || activePhase;
    if (isTransientDbError(err)) {
      // Database briefly unreachable (restart, failover, pooler connection limit): retry once on
      // the server first, so a short blip never reaches the customer.
      if (!retriedRequests.has(req) && !res.headersSent) {
        retriedRequests.add(req);
        logger.warn(`requireAuth: temporary database error, retrying once [Phase: ${phase}]`, describeDbError(err));
        await new Promise((resolve) => setTimeout(resolve, AUTH_DB_RETRY_DELAY_MS));
        return requireAuth(req, res, next);
      }
      logger.warn(`requireAuth: database temporarily unavailable [${refCode}] [Phase: ${phase}]`, {
        error: err?.message,
        ...describeDbError(err),
        refCode,
      });
      sendTemporarilyUnavailable(res, refCode);
      return;
    }
    const diag = describeDbError(err);
    logger.error(`requireAuth Middleware Authentication Exception [${refCode}] [Phase: ${phase}]`, {
      error: err?.message,
      name: err?.name,
      ...diag,
      stack: err?.stack,
      refCode,
    });
    // Stage + error code only (never the message): enough to diagnose from a customer screenshot.
    const errorCode = diag.pgCode || diag.code || String(err?.name || 'Error');
    const stageTag = `${phase}/${errorCode}`.replace(/[^A-Za-z0-9_/-]/g, '').slice(0, 60);
    const displayError = env.NODE_ENV === 'development'
      ? `Session check failed during ${phase} (${err?.message || 'unknown error'})`
      : `We could not verify your session. Please refresh the page; if this keeps happening, contact support with reference ${refCode} (${stageTag}).`;
    res.status(500).json({ success: false, error: displayError });
  }
}

/** 503 + Retry-After: the browser retries read requests by itself (Frontend api.ts). */
function sendTemporarilyUnavailable(res: Response, refCode: string): void {
  res.set('Retry-After', '2');
  res.status(503).json({
    success: false,
    code: 'AUTH_TEMPORARILY_UNAVAILABLE',
    error: `The service is briefly unavailable. Please try again in a few seconds (reference ${refCode}).`,
  });
}

export function requireEditor(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const role = req.workspaceRole || 'admin';
  if (role === 'viewer' || role === 'analyst') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Read-only members are not authorized to perform modifications in this workspace.'
    });
    return;
  }
  next();
}

/**
 * Enterprise RBAC Middleware: Enforces permissions based on workspace role.
 * Role Hierarchy: admin > developer > analyst > viewer
 * Account owners (effectiveWorkspaceId === userId) automatically hold permanent admin privileges.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.workspaceRole || 'admin';

    // Account owners or admins always have unrestricted access
    if (
      role === 'admin' ||
      role === 'owner' ||
      req.user?.accountType === 'admin' ||
      req.effectiveWorkspaceId === req.userId
    ) {
      next();
      return;
    }

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Your workspace role (${role}) is not authorized to perform this action.`
      });
      return;
    }

    next();
  };
}

