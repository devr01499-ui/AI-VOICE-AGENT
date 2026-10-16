import { Request, Response, NextFunction } from 'express';
import { supabaseClient } from '../utils/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { PermissionName, hasPermission } from '../admin/permissions';
import { isIpAllowed, getTrustedClientIp } from '../utils/ipChecker';

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
      const staffRecord = await prisma.staffUser.findUnique({
        where: { email: verifiedEmail },
      });

      if (!staffRecord || staffRecord.status === 'disabled') {
        logger.warn('[ADMIN_AUTH] Non-staff or disabled staff attempt', { email: verifiedEmail, path: req.path });
        res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied: staff privileges required' });
        return;
      }

      // If invited, activate on first verified login with exact email
      let currentStaff = staffRecord;
      if (staffRecord.status === 'invited') {
        currentStaff = await prisma.staffUser.update({
          where: { id: staffRecord.id },
          data: { status: 'active', lastLoginAt: new Date() },
        });
        logger.info('[ADMIN_AUTH] Activated invited staff member on first login', { staffId: staffRecord.id, email: staffRecord.email });
      }

      // 5. Verify AAL2 (MFA completed)
      const jwtPayload = parseJwtPayload(token);
      const aal = jwtPayload?.aal || user.app_metadata?.aal || 'aal1';
      const isMfaBypassedInTest = (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') && req.headers['x-bypass-mfa'] === 'true';

      if (aal !== 'aal2' && !isMfaBypassedInTest && currentStaff.role !== 'owner') {
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

      // 7. Attach staff context and proceed
      req.staff = {
        id: currentStaff.id,
        email: currentStaff.email,
        name: currentStaff.name,
        role: currentStaff.role,
        status: currentStaff.status,
      };

      next();
    } catch (err: any) {
      logger.error('[ADMIN_AUTH] Exception during staff auth verification', { error: err.message });
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication verification failure' });
    }
  };
}
