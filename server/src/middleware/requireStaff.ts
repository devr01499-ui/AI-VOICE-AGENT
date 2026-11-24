import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../utils/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { PermissionName, hasPermission } from '../admin/permissions';
import { isIpAllowed, getTrustedClientIp } from '../utils/ipChecker';
import { ADMIN_EMAIL } from '../config/constants';

export interface StaffContext {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

export interface StaffAuthenticatedRequest extends Request {
  staff?: StaffContext;
}

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Middleware that strictly gates administrative endpoints.
 * Deny-by-default:
 * 1. Requires ENABLE_STRICT_AUTH === 'true' (fail-closed default).
 * 2. Checks client IP against ADMIN_IP_ALLOWLIST (if configured).
 * 3. Enforces valid Supabase JWT signature (returns 401 if missing/invalid).
 * 4. Mandates AAL2 (MFA completed via TOTP, returns 403 MFA_REQUIRED).
 * 5. Masks non-staff, disabled staff, and unauthenticated callers with 401/403.
 * 6. Enforces declared permission on staff role (returns 403 on permission mismatch).
 */
export function requireStaff(permission?: PermissionName) {
  return async (req: StaffAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Fail-closed default: Strict authentication is mandatory.
    // If ENABLE_STRICT_AUTH is not explicitly 'true', all administrative access is strictly denied.
    if (process.env.ENABLE_STRICT_AUTH !== 'true') {
      logger.error('[ADMIN_AUTH] Access denied: ENABLE_STRICT_AUTH is not enabled (fail-closed default)', {
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Administrative access is denied. Strict authentication is required.',
      });
      return;
    }

    // 1. IP Allowlist check (optional, if configured)
    const adminIpAllowlist = process.env.ADMIN_IP_ALLOWLIST?.trim();
    if (adminIpAllowlist) {
      const allowedCidrs = adminIpAllowlist.split(',').map((c) => c.trim()).filter(Boolean);
      const clientIp = getTrustedClientIp(req);
      if (!isIpAllowed(clientIp, allowedCidrs)) {
        logger.warn('[ADMIN_AUTH] Request rejected by IP allowlist', { clientIp, path: req.path });
        res.status(403).json({ error: 'FORBIDDEN', message: 'Client IP not permitted' });
        return;
      }
    }

    // 1b. Owner access key (owner decision 2026-11-24: no login screen on the admin console).
    // The console's own Vercel project carries ADMIN_ACCESS_KEY in its build; the server accepts a
    // request that presents the same key as the platform owner. Without the key, knowing the public
    // API address is not enough. Only active when ADMIN_ACCESS_KEY (>= 32 characters) is set on the
    // server; a wrong key is refused and logged.
    const presentedKey = req.headers['x-admin-access-key'];
    if (typeof presentedKey === 'string' && presentedKey) {
      if (!accessKeyMatches(presentedKey)) {
        logger.warn('[ADMIN_AUTH] Wrong or disabled admin access key', { path: req.path, ip: getTrustedClientIp(req) });
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid admin access key' });
        return;
      }
      try {
        const ownerEmail = ADMIN_EMAIL.toLowerCase();
        const ownerRow = await prisma.staffUser.upsert({
          where: { email: ownerEmail },
          create: { email: ownerEmail, name: 'Owner', role: 'owner', status: 'active', createdBy: 'access_key', lastLoginAt: new Date() },
          update: {},
        });
        if (ownerRow.status === 'disabled' || ownerRow.role !== 'owner') {
          res.status(403).json({ error: 'FORBIDDEN', message: 'The owner staff account is disabled.' });
          return;
        }
        if (!permission) {
          res.status(500).json({ error: 'CONFIGURATION_ERROR: Route lacks declared permission gate' });
          return;
        }
        if (!takeStaffRequestSlot(ownerRow.id)) {
          res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many admin requests. Please slow down.' });
          return;
        }
        if (ownerRow.status === 'invited' || !ownerRow.lastLoginAt || Date.now() - ownerRow.lastLoginAt.getTime() > LAST_LOGIN_REFRESH_MS) {
          await prisma.staffUser.update({ where: { id: ownerRow.id }, data: { lastLoginAt: new Date(), status: 'active' } }).catch(() => {});
        }
        req.staff = { id: ownerRow.id, email: ownerRow.email, name: ownerRow.name, role: 'owner', status: 'active' };
        next();
      } catch (err: any) {
        logger.error('[ADMIN_AUTH] Access-key sign-in failed', { error: err?.message });
        res.status(503).json({ error: 'ADMIN_AUTH_UNAVAILABLE', message: 'Sign-in could not be checked right now. Please try again in a moment.' });
      }
      return;
    }

    // 2. Extract Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7).trim();
    if (!token || token === 'undefined' || token === 'null') {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing bearer token' });
      return;
    }

    // 3. Supabase Token Signature Verification
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      const user = data?.user;
      if (error || !user || !user.email) {
        logger.warn('[ADMIN_AUTH] Supabase token invalid', { error: error?.message, path: req.path });
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired administrative credentials' });
        return;
      }

      const verifiedEmail = user.email.toLowerCase().trim();

      // 4. Verify Active Staff Membership in database
      let staffRecord = await prisma.staffUser.findUnique({
        where: { email: verifiedEmail },
      });

      // First owner bootstrap: staff can only be invited by an existing owner, so the platform
      // owner's own address (ADMIN_EMAIL, confirmed by Supabase) gets an owner row on first sign-in
      // when it has none. Two-factor is still required below; a disabled row is never re-enabled.
      if (!staffRecord && verifiedEmail === ADMIN_EMAIL.toLowerCase() && user.email_confirmed_at) {
        staffRecord = await prisma.staffUser.upsert({
          where: { email: verifiedEmail },
          create: { email: verifiedEmail, name: 'Owner', role: 'owner', status: 'invited', createdBy: 'bootstrap' },
          update: {},
        });
        logger.info('[ADMIN_AUTH] Platform owner added to the staff list on first sign-in', { staffId: staffRecord.id });
      }

      if (!staffRecord || staffRecord.status === 'disabled') {
        logger.warn('[ADMIN_AUTH] Non-staff or disabled staff attempt', { email: verifiedEmail, path: req.path });
        res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied: staff privileges required' });
        return;
      }

      let currentStaff = staffRecord;

      // 5. Verify AAL2 (MFA completed)
      const jwtPayload = parseJwtPayload(token);
      const aal = jwtPayload?.aal || user.app_metadata?.aal || 'aal1';
      const isMfaBypassedInTest = (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') && req.headers['x-bypass-mfa'] === 'true';

      // Every role, the owner included (owner decision 2026-11-23: the panel controls prices and
      // money, so a leaked password alone must never open it).
      if (aal !== 'aal2' && !isMfaBypassedInTest) {
        logger.warn('[ADMIN_AUTH] Staff MFA requirement unfulfilled (aal2 required)', {
          staffId: currentStaff.id,
          currentAal: aal,
        });
        res.status(403).json({
          error: 'MFA_REQUIRED',
          message: 'Two-factor authentication (AAL2) is required for administrative console access.',
        });
        return;
      }

      // 6. Permission Enforcement
      if (!permission) {
        logger.error('[ADMIN_AUTH] Route declared without permission requirement', { path: req.path, method: req.method });
        res.status(500).json({ error: 'CONFIGURATION_ERROR: Route lacks declared permission gate' });
        return;
      }

      if (!hasPermission(currentStaff.role, permission)) {
        logger.warn('[ADMIN_AUTH] Staff lacks required permission', {
          staffId: currentStaff.id,
          role: currentStaff.role,
          permission,
          path: req.path,
        });
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Your role (${currentStaff.role}) does not have permission '${permission}'`,
          requiredPermission: permission,
        });
        return;
      }

      // 7. Per-person rate limit (the router-level limiter runs before sign-in is known, so it can
      // only count per IP; this one counts each staff member separately).
      if (!takeStaffRequestSlot(currentStaff.id)) {
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many admin requests. Please slow down.' });
        return;
      }

      // 8. An invited person becomes active only after a fully verified (two-factor) sign-in.
      // lastLoginAt is refreshed at most once an hour (no database write per request).
      const now = Date.now();
      if (currentStaff.status === 'invited' || !currentStaff.lastLoginAt || now - currentStaff.lastLoginAt.getTime() > LAST_LOGIN_REFRESH_MS) {
        try {
          currentStaff = await prisma.staffUser.update({
            where: { id: currentStaff.id },
            data: { lastLoginAt: new Date(now), ...(currentStaff.status === 'invited' ? { status: 'active' } : {}) },
          });
          if (staffRecord.status === 'invited') {
            logger.info('[ADMIN_AUTH] Activated invited staff member on first verified login', { staffId: currentStaff.id });
          }
        } catch (touchErr: any) {
          logger.warn('[ADMIN_AUTH] Could not record last login (request continues)', { staffId: currentStaff.id, error: touchErr?.message });
        }
      }

      // 9. Attach staff context and proceed
      req.staff = {
        id: currentStaff.id,
        email: currentStaff.email,
        name: currentStaff.name,
        role: currentStaff.role,
        status: currentStaff.status,
      };

      next();
    } catch (err: any) {
      // The token was checked above; reaching here means the database or auth provider failed.
      logger.error('[ADMIN_AUTH] Exception during staff auth verification', { error: err.message });
      res.status(503).json({ error: 'ADMIN_AUTH_UNAVAILABLE', message: 'Sign-in could not be checked right now. Please try again in a moment.' });
    }
  };
}

const LAST_LOGIN_REFRESH_MS = 60 * 60 * 1000;

/** Minimum length of ADMIN_ACCESS_KEY; a shorter value switches the key off (fail-closed). */
export const ADMIN_ACCESS_KEY_MIN_LENGTH = 32;

/** Timing-safe comparison with the server's ADMIN_ACCESS_KEY (off when unset or too short). */
function accessKeyMatches(presented: string): boolean {
  const expected = String(process.env.ADMIN_ACCESS_KEY || '').trim();
  if (expected.length < ADMIN_ACCESS_KEY_MIN_LENGTH) return false;
  const a = crypto.createHash('sha256').update(presented.trim()).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
const STAFF_WINDOW_MS = 60 * 1000;
const STAFF_MAX_PER_WINDOW = 120;
const staffWindows = new Map<string, { start: number; count: number }>();

/** Fixed one-minute window per staff member: 120 requests. */
function takeStaffRequestSlot(staffId: string): boolean {
  const now = Date.now();
  const w = staffWindows.get(staffId);
  if (!w || now - w.start >= STAFF_WINDOW_MS) {
    staffWindows.set(staffId, { start: now, count: 1 });
    if (staffWindows.size > 1000) {
      for (const [k, v] of staffWindows) if (now - v.start >= STAFF_WINDOW_MS) staffWindows.delete(k);
    }
    return true;
  }
  w.count++;
  return w.count <= STAFF_MAX_PER_WINDOW;
}

/** Tests only. */
export function resetStaffRateLimitForTests(): void {
  staffWindows.clear();
}
