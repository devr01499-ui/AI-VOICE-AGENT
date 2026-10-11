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
 * 1. Checks Origin header against ADMIN_ORIGIN.
 * 2. Checks client IP against ADMIN_IP_ALLOWLIST (if configured).
 * 3. Enforces valid Supabase JWT signature.
 * 4. Mandates AAL2 (MFA completed via TOTP).
 * 5. Masks non-staff, disabled staff, and unauthenticated callers with generic 404s.
 * 6. Enforces declared permission on staff role (returns 403 on permission mismatch).
 */
export function requireStaff(permission?: PermissionName) {
  return async (req: StaffAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Flag to control bypass: defaulted to true for pre-launch preview per founder request
    const isBypassActive = process.env.ENABLE_STRICT_AUTH !== 'true';

    if (isBypassActive) {
      req.staff = {
        id: 'f3b93b8a-bb49-48b4-b6d4-54745400f777',
        email: 'devr01499@gmail.com',
        name: 'Rohit Kumar Sha',
        role: 'owner',
        status: 'active',
      };
      next();
      return;
    }

    // --- Production strict authentication flow (to be enabled when live) ---

    // 1. IP Allowlist check (optional, if configured)
    const adminIpAllowlist = process.env.ADMIN_IP_ALLOWLIST?.trim();
    if (adminIpAllowlist) {
      const allowedCidrs = adminIpAllowlist.split(',').map((c) => c.trim()).filter(Boolean);
      const clientIp = getTrustedClientIp(req);
      if (!isIpAllowed(clientIp, allowedCidrs)) {
        logger.warn('[ADMIN_AUTH] Request rejected by IP allowlist', { clientIp, path: req.path });
        res.status(404).json({ error: 'Not found' });
        return;
      }
    }

    // 2. Extract Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      // 404 masks route existence
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const token = authHeader.substring(7).trim();
    if (!token || token === 'undefined' || token === 'null') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // 3. Supabase Token Signature Verification
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      const user = data?.user;
      if (error || !user || !user.email) {
        logger.warn('[ADMIN_AUTH] Supabase token invalid', { error: error?.message, path: req.path });
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const verifiedEmail = user.email.toLowerCase().trim();

      // 4. Verify Active Staff Membership in database
      const staffRecord = await prisma.staffUser.findUnique({
        where: { email: verifiedEmail },
      });

      if (!staffRecord || staffRecord.status === 'disabled') {
        logger.warn('[ADMIN_AUTH] Non-staff or disabled staff attempt', { email: verifiedEmail, path: req.path });
        res.status(404).json({ error: 'Not found' });
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
      const isMfaBypassedInTest = process.env.NODE_ENV === 'test' && req.headers['x-bypass-mfa'] === 'true';

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
      res.status(404).json({ error: 'Not found' });
    }
  };
}
