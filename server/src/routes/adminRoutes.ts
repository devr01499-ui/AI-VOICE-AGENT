import { csvLine } from '../utils/csv';
import { Router, Response } from 'express';
import { requireStaff, StaffAuthenticatedRequest } from '../middleware/requireStaff';
import { getPermissionsForRole, StaffRole } from '../admin/permissions';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AccountEnforcementService, SuspensionCategory } from '../services/AccountEnforcementService';
import { MinutesService } from '../services/MinutesService';
import { withAudit } from '../admin/audit';
import { validateGrantCap, getRoleCaps, validateDiscountCap } from '../admin/capEnforcement';
import { BillingService } from '../services/BillingService';
import { CallService } from '../services/CallService';
import { logAdminRead } from '../admin/audit';
import { PLAN_CONFIG, PLAN_VALIDITY_DAYS } from '../config/plans';
import { adminOriginsFrom } from '../config/cors';
import { PlatformConfigService } from '../services/PlatformConfigService';
import { NotificationService, ANNOUNCEMENT_TYPE } from '../services/NotificationService';
import { PAYMENT_REVIEW_TYPE, parseIssueMeta, closeIssuesForPayment, notifyCustomerOfRefund } from '../services/PaymentIssueService';
import rateLimit from 'express-rate-limit';

/** Built per use, so a test (or a key rotation) that swaps the gateway client is honoured. */
const billing = () => new BillingService();

export const adminRouter = Router();

// Pre-sign-in limiter, counted per client IP (who the caller is is not known yet at this point).
// The per-staff limit (120/min) is applied inside requireStaff once the person is verified.
const adminIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many admin requests. Please slow down.' });
  },
});

adminRouter.use(adminIpLimiter);

// ─── Shared input rules ─────────────────────────
/** Largest number of minutes one admin action may add or remove. */
export const MAX_ADMIN_MINUTES = 100_000;
const ACCOUNT_STATUSES = ['active', 'restricted', 'suspended'];
const CUSTOMER_SORTS: Record<string, any> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  minutes: [{ minutesRemainingSeconds: 'desc' }, { id: 'asc' }],
  calls: [{ calls: { _count: 'desc' } }, { id: 'asc' }],
};
const RISK_LEVELS = ['none', 'watch', 'high'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function paramOf(req: StaffAuthenticatedRequest, name = 'id'): string {
  const v = (req.params as Record<string, string | string[]>)[name];
  return String(Array.isArray(v) ? v[0] : v || '');
}

function requestIdOf(req: StaffAuthenticatedRequest): string | undefined {
  const h = req.headers['x-request-id'];
  const v = Array.isArray(h) ? h[0] : h;
  return typeof v === 'string' && v.length <= 100 ? v : undefined;
}

/** A written reason (3-500 characters) is required for every change. */
function reasonOf(body: any): string | null {
  const r = body?.reason;
  if (typeof r !== 'string') return null;
  const t = r.trim();
  return t.length >= 3 && t.length <= 500 ? t : null;
}

/** Whole minutes, 1 .. MAX_ADMIN_MINUTES. Anything else (text, decimals, negatives) is refused. */
function wholeMinutesOf(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_ADMIN_MINUTES ? n : null;
}

/** The browser sends one key per dialog, so a double click or a retry never applies twice. */
function idempotencyKeyOf(req: StaffAuthenticatedRequest): string | null {
  const raw = req.body?.idempotencyKey ?? req.headers['idempotency-key'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && /^[A-Za-z0-9_:.-]{8,128}$/.test(v) ? v : null;
}

async function customerExists(id: string): Promise<boolean> {
  if (!id || id.length > 100) return false;
  return Boolean(await prisma.user.findUnique({ where: { id }, select: { id: true } }));
}

function auditBase(req: StaffAuthenticatedRequest) {
  return { staff: req.staff!, ip: req.ip, userAgent: req.get('User-Agent'), requestId: requestIdOf(req) };
}

/** "ABCDE1234F" -> "******234F": staff can match a document without seeing the full number. */
function maskTail(v: string | null | undefined, keep = 4): string | null {
  if (!v) return v ?? null;
  const s = String(v);
  return s.length <= keep ? '*'.repeat(s.length) : `${'*'.repeat(s.length - keep)}${s.slice(-keep)}`;
}

/** Known service errors become a plain message with the right status; anything else is generic. */
function sendServiceError(res: Response, err: any, fallback: string): void {
  const msg = String(err?.message || '');
  if (msg.startsWith('INSUFFICIENT_BALANCE')) {
    res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: 'The customer does not have that many minutes. Lower the amount (only the owner may push a balance below zero).' });
    return;
  }
  if (msg.startsWith('USER_NOT_FOUND')) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }
  if (msg.startsWith('AUDIT_ERROR')) {
    res.status(400).json({ error: 'REASON_REQUIRED', message: 'A reason is required.' });
    return;
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', message: fallback });
}

/**
 * GET /api/v2/admin/me
 * Returns authenticated staff identity, active status, role, and authorized permissions.
 */
adminRouter.get('/me', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const staff = req.staff!;
  res.status(200).json({
    success: true,
    data: {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      permissions: getPermissionsForRole(staff.role),
    },
  });
});

/**
 * GET /api/v2/admin/health
 * Comprehensive operational health status (Phase 2 Step 3.3).
 */
adminRouter.get('/health', requireStaff('metrics:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch (err: any) {
    // The raw driver message can name hosts and users: it goes to the log, not the screen.
    logger.error('[ADMIN_API] Health: database check failed', { error: err?.message });
    dbStatus = 'unhealthy';
  }

  // Ledger reconciliation check on the 20 most recently active accounts (a fixed sample of the
  // oldest rows never looked at anyone who actually uses the product).
  let ledgerMismatchesCount = 0;
  try {
    const userSample = await prisma.user.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    for (const u of userSample) {
      const rec = await MinutesService.reconcileUser(u.id);
      if (!rec.isReconciled) ledgerMismatchesCount++;
    }
  } catch {
    // Non-fatal
  }

  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const trustProxyActive = req.app.get('trust proxy') === 1;
  const configured = (name: string) => Boolean(process.env[name] && String(process.env[name]).trim());

  res.status(200).json({
    success: true,
    data: {
      status: dbStatus === 'healthy' ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      integrations: {
        gemini: geminiConfigured ? 'configured' : 'missing_key',
        razorpay: razorpayConfigured ? 'configured' : 'missing_credentials',
        razorpayWebhook: configured('RAZORPAY_WEBHOOK_SECRET') ? 'configured' : 'missing_secret',
        carrierVobiz: configured('VOBIZ_AUTH_ID') ? 'configured' : 'not_configured',
        carrierPlivo: configured('PLIVO_AUTH_ID') ? 'configured' : 'not_configured',
        email: configured('RESEND_API_KEY') ? 'configured' : 'not_configured',
        trustProxy: trustProxyActive ? 'active (level 1)' : 'misconfigured',
      },
      // Real state of the admin console's own protections (the Settings page shows these instead of
      // fixed text). Booleans only: no address lists or secrets leave the server.
      security: {
        strictAuth: process.env.ENABLE_STRICT_AUTH === 'true',
        ipAllowlistEnabled: configured('ADMIN_IP_ALLOWLIST'),
        adminOrigin: adminOriginsFrom(process.env.ADMIN_ORIGIN).join(', '),
        encryptionKeySet: configured('ENCRYPTION_KEY'),
        twoFactorRequiredForAllRoles: true,
        staffRateLimitPerMinute: 120,
      },
      audit: {
        ledgerSampleMismatches: ledgerMismatchesCount,
      },
      version: process.env.npm_package_version || '1.0.0',
    },
  });
});

/**
 * POST /api/v2/admin/customers/:id/suspend
 */
export const SUSPENSION_CATEGORIES: SuspensionCategory[] = [
  'illegal_activity', 'telecom_abuse', 'payment_fraud', 'non_compliance', 'suspicious_traffic', 'requested_by_user', 'other',
];

adminRouter.post('/customers/:id/suspend', requireStaff('customers:suspend'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const category = req.body?.category;
  const reason = reasonOf(req.body);

  if (!SUSPENSION_CATEGORIES.includes(category) || !reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: `A category (${SUSPENSION_CATEGORIES.join(', ')}) and a reason of at least 3 characters are required.` });
    return;
  }
  if (!(await customerExists(id))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  const requestId = requestIdOf(req);

  try {
    const updated = await AccountEnforcementService.suspendAccount({
      userId: id,
      category: category as SuspensionCategory,
      details: reason,
      staff: req.staff!,
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to suspend customer', { customerId: id, error: err.message });
    res.status(500).json({ error: 'Failed to suspend account' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/restrict
 */
adminRouter.post('/customers/:id/restrict', requireStaff('customers:restrict'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body);

  if (!reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A reason of at least 3 characters is required.' });
    return;
  }
  if (!(await customerExists(id))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  const requestId = requestIdOf(req);

  try {
    const updated = await AccountEnforcementService.restrictAccount({
      userId: id,
      reason,
      staff: req.staff!,
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to restrict customer', { customerId: id, error: err.message });
    res.status(500).json({ error: 'Failed to restrict account' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/restore
 */
adminRouter.post('/customers/:id/restore', requireStaff('customers:restore'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body);

  if (!reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A reason of at least 3 characters is required.' });
    return;
  }
  if (!(await customerExists(id))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  const requestId = requestIdOf(req);

  try {
    const updated = await AccountEnforcementService.restoreAccount({
      userId: id,
      reason,
      staff: req.staff!,
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to restore customer', { customerId: id, error: err.message });
    res.status(500).json({ error: 'Failed to restore account' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/minutes/grant
 */
adminRouter.post('/customers/:id/minutes/grant', requireStaff('minutes:grant'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const minutes = wholeMinutesOf(req.body?.minutes);
  const reason = reasonOf(req.body);
  const key = idempotencyKeyOf(req);

  if (minutes === null || !reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: `Minutes must be a whole number from 1 to ${MAX_ADMIN_MINUTES.toLocaleString('en-IN')}, and a reason is required.` });
    return;
  }
  if (!key) {
    res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Missing request key. Reload the page and try again.' });
    return;
  }
  if (!(await customerExists(id))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  // A retry of the same dialog (same key) returns the first result without counting against the cap.
  const replay = await prisma.minutesLedger.findUnique({ where: { idempotencyKey: `admin_grant:${key}` } });
  if (!replay) {
    // Enforce staff role grant cap per Founder Decision #3
    const capError = await validateGrantCap(req.staff!.role, req.staff!.id, minutes);
    if (capError) {
      res.status(403).json({ error: 'OVER_ROLE_CAP', message: capError });
      return;
    }
  } else if (replay.userId !== id) {
    res.status(409).json({ error: 'IDEMPOTENCY_KEY_REUSED', message: 'This request key belongs to another action. Reload the page and try again.' });
    return;
  }

  try {
    const result = await withAudit(
      {
        ...auditBase(req),
        action: 'minutes:grant',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason,
        isCustomerVisible: true,
        customerActionDescription: `Granted ${minutes} promotional minutes by Claritiy Support`,
      },
      async (tx) => {
        const credit = await MinutesService.credit(
          {
            userId: id,
            deltaSeconds: minutes * 60,
            reason: 'admin_grant',
            note: reason,
            actorType: 'staff',
            actorId: req.staff!.id,
            idempotencyKey: `admin_grant:${key}`,
          },
          tx
        );
        return { result: credit, after: { grantedMinutes: minutes, newBalanceSeconds: credit.balanceSeconds, idempotent: Boolean(replay) } };
      }
    );

    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to grant minutes', { customerId: id, error: err.message });
    sendServiceError(res, err, 'Failed to grant minutes.');
  }
});

/**
 * POST /api/v2/admin/customers/:id/minutes/deduct
 */
adminRouter.post('/customers/:id/minutes/deduct', requireStaff('minutes:deduct'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const minutes = wholeMinutesOf(req.body?.minutes);
  const reason = reasonOf(req.body);
  const key = idempotencyKeyOf(req);

  if (minutes === null || !reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: `Minutes must be a whole number from 1 to ${MAX_ADMIN_MINUTES.toLocaleString('en-IN')}, and a reason is required.` });
    return;
  }
  if (!key) {
    res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Missing request key. Reload the page and try again.' });
    return;
  }

  // Verify role deduction capability
  const caps = await getRoleCaps(req.staff!.role);
  if (!caps.canDeduct) {
    res.status(403).json({ error: 'FORBIDDEN', message: `Your role (${req.staff!.role}) does not have permission to deduct minutes.` });
    return;
  }
  if (!(await customerExists(id))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }
  const replay = await prisma.minutesLedger.findUnique({ where: { idempotencyKey: `admin_deduct:${key}` }, select: { userId: true } });
  if (replay && replay.userId !== id) {
    res.status(409).json({ error: 'IDEMPOTENCY_KEY_REUSED', message: 'This request key belongs to another action. Reload the page and try again.' });
    return;
  }

  // Only Owner can force negative balance
  const canAllowNegative = req.staff!.role === 'owner' && req.body?.allowNegative === true;

  try {
    const result = await withAudit(
      {
        ...auditBase(req),
        action: 'minutes:deduct',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason,
        isCustomerVisible: true,
        customerActionDescription: `Deducted ${minutes} minutes by Claritiy Support`,
      },
      async (tx) => {
        const debit = await MinutesService.debit(
          {
            userId: id,
            deltaSeconds: minutes * 60,
            reason: 'admin_deduct',
            note: reason,
            actorType: 'staff',
            actorId: req.staff!.id,
            idempotencyKey: `admin_deduct:${key}`,
            allowNegative: canAllowNegative,
          },
          tx
        );
        return { result: debit, after: { deductedMinutes: minutes, newBalanceSeconds: debit.balanceSeconds } };
      }
    );

    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to deduct minutes', { customerId: id, error: err.message });
    sendServiceError(res, err, 'Failed to deduct minutes.');
  }
});

// ─────────────────────────────────────────────
// STAFF GOVERNANCE ENDPOINTS (OWNER ONLY)
// ─────────────────────────────────────────────

/**
 * GET /api/v2/admin/staff
 * Lists all staff members with their current roles and statuses.
 */
adminRouter.get('/staff', requireStaff('staff:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const staffList = await prisma.staffUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdBy: true,
        createdAt: true,
      },
    });

    res.status(200).json({ success: true, data: staffList });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list staff', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve staff members' });
  }
});

/**
 * POST /api/v2/admin/staff/invite
 * Invites a new staff member with a specified role.
 */
adminRouter.post('/staff/invite', requireStaff('staff:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { email, name, role } = req.body || {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254
    || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A valid email address and a name (up to 100 characters) are required.' });
    return;
  }

  const validRoles: StaffRole[] = ['owner', 'admin', 'sales', 'support', 'finance'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'INVALID_ROLE', message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await prisma.staffUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      res.status(409).json({ error: 'A staff member with this email already exists.' });
      return;
    }

    const newStaff = await withAudit(
      {
        staff: req.staff!,
        action: 'staff:invite',
        targetType: 'StaffUser',
        targetId: normalizedEmail,
        reason: `Invited new staff member ${name} (${role})`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const created = await tx.staffUser.create({
          data: {
            email: normalizedEmail,
            name: name.trim(),
            role,
            status: 'invited',
            createdBy: req.staff!.email,
          },
        });
        return { result: created, after: { email: normalizedEmail, role, status: 'invited' } };
      }
    );

    res.status(201).json({ success: true, data: newStaff });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'CONFLICT', message: 'A staff member with this email already exists.' });
      return;
    }
    logger.error('[ADMIN_API] Failed to invite staff', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to invite staff member.' });
  }
});

/**
 * PATCH /api/v2/admin/staff/:id
 * Updates a staff member's role or name.
 * Safeguards:
 * - Cannot modify self.
 * - Non-owner cannot modify owner.
 * - Cannot demote last active owner.
 */
adminRouter.patch('/staff/:id', requireStaff('staff:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { role, name } = req.body;

  // Only a real role (audit #70: a typo was saved and removed every permission of that person).
  const validRoles: StaffRole[] = ['owner', 'admin', 'sales', 'support', 'finance'];
  if (role !== undefined && role !== null && role !== '' && !validRoles.includes(role)) {
    res.status(400).json({ error: 'INVALID_ROLE', message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }
  if (name !== undefined && name !== null && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name must be 1-100 characters.' });
    return;
  }

  if (targetId === req.staff!.id) {
    res.status(400).json({ error: 'SELF_MODIFICATION_FORBIDDEN', message: 'You cannot modify your own staff account.' });
    return;
  }

  try {
    const targetStaff = await prisma.staffUser.findUnique({ where: { id: targetId } });
    if (!targetStaff) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }

    // Owner protection
    if (targetStaff.role === 'owner' && req.staff!.role !== 'owner') {
      res.status(403).json({ error: 'OWNER_PROTECTED', message: 'Only owners can modify owner accounts.' });
      return;
    }

    // Last owner demotion protection
    if (targetStaff.role === 'owner' && role && role !== 'owner') {
      const activeOwners = await prisma.staffUser.count({
        where: { role: 'owner', status: 'active' },
      });
      if (activeOwners <= 1) {
        res.status(400).json({ error: 'LAST_OWNER_PROTECTED', message: 'Cannot demote the last remaining active owner.' });
        return;
      }
    }

    const updated = await withAudit(
      {
        staff: req.staff!,
        action: 'staff:update',
        targetType: 'StaffUser',
        targetId,
        reason: `Updated staff user ${targetStaff.email}: role=${role || targetStaff.role}`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const resStaff = await tx.staffUser.update({
          where: { id: targetId },
          data: {
            role: role || undefined,
            name: name ? name.trim() : undefined,
          },
        });
        return {
          result: resStaff,
          before: { role: targetStaff.role, name: targetStaff.name },
          after: { role: role || targetStaff.role, name: name || targetStaff.name },
        };
      }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update staff', { targetId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update staff member.' });
  }
});

/**
 * POST /api/v2/admin/staff/:id/disable
 * Disables a staff member and revokes their active sessions.
 * Safeguards:
 * - Cannot disable self.
 * - Non-owner cannot disable owner.
 * - Cannot disable the last remaining active owner.
 */
adminRouter.post('/staff/:id/disable', requireStaff('staff:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (targetId === req.staff!.id) {
    res.status(400).json({ error: 'SELF_MODIFICATION_FORBIDDEN', message: 'You cannot disable your own staff account.' });
    return;
  }

  try {
    const targetStaff = await prisma.staffUser.findUnique({ where: { id: targetId } });
    if (!targetStaff) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }

    if (targetStaff.role === 'owner' && req.staff!.role !== 'owner') {
      res.status(403).json({ error: 'OWNER_PROTECTED', message: 'Only owners can disable owner accounts.' });
      return;
    }

    if (targetStaff.role === 'owner') {
      const activeOwners = await prisma.staffUser.count({
        where: { role: 'owner', status: 'active' },
      });
      if (activeOwners <= 1) {
        res.status(400).json({ error: 'LAST_OWNER_PROTECTED', message: 'Cannot disable the last remaining active owner.' });
        return;
      }
    }

    const disabled = await withAudit(
      {
        staff: req.staff!,
        action: 'staff:disable',
        targetType: 'StaffUser',
        targetId,
        reason: `Disabled staff account for ${targetStaff.email}`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const resStaff = await tx.staffUser.update({
          where: { id: targetId },
          data: { status: 'disabled' },
        });
        return {
          result: resStaff,
          before: { status: targetStaff.status },
          after: { status: 'disabled' },
        };
      }
    );

    // No session revocation call is needed: requireStaff re-reads the staff row on every request,
    // so a disabled person is refused from their very next request. (The old code listed only the
    // first 50 sign-in accounts and passed a user id where Supabase expects the user's own token,
    // so it never signed anyone out.)
    res.status(200).json({ success: true, data: disabled });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to disable staff', { targetId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to disable staff member.' });
  }
});

/**
 * POST /api/v2/admin/staff/:id/enable
 * Re-enables a previously disabled staff member.
 */
adminRouter.post('/staff/:id/enable', requireStaff('staff:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const targetStaff = await prisma.staffUser.findUnique({ where: { id: targetId } });
    if (!targetStaff) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }

    const enabled = await withAudit(
      {
        staff: req.staff!,
        action: 'staff:enable',
        targetType: 'StaffUser',
        targetId,
        reason: `Re-enabled staff account for ${targetStaff.email}`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const resStaff = await tx.staffUser.update({
          where: { id: targetId },
          data: { status: 'active' },
        });
        return {
          result: resStaff,
          before: { status: targetStaff.status },
          after: { status: 'active' },
        };
      }
    );

    res.status(200).json({ success: true, data: enabled });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to enable staff', { targetId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to enable staff member.' });
  }
});

// ─────────────────────────────────────────────
// CUSTOMER DIRECTORY & CUSTOMER 360 ENDPOINTS
// ─────────────────────────────────────────────

/**
 * GET /api/v2/admin/customers
 * Paginated list of customers with search and filtering.
 */
adminRouter.get('/customers', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { q, status, risk, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * take;

  const whereClause: any = {};

  if (status && typeof status === 'string' && status !== 'all') {
    if (!ACCOUNT_STATUSES.includes(status)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `status must be one of: all, ${ACCOUNT_STATUSES.join(', ')}` });
      return;
    }
    whereClause.accountStatus = status;
  }
  if (typeof q === 'string' && q.length > 200) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Search text is too long.' });
    return;
  }

  if (risk && typeof risk === 'string' && risk !== 'all') {
    if (!RISK_LEVELS.includes(risk)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `risk must be one of: all, ${RISK_LEVELS.join(', ')}` });
      return;
    }
    const riskProfiles = await prisma.customerAdminProfile.findMany({
      where: { riskLevel: risk },
      select: { userId: true },
    });
    whereClause.id = { in: riskProfiles.map((p) => p.userId) };
  }

  if (q && typeof q === 'string' && q.trim()) {
    const searchTerm = q.trim();
    whereClause.OR = [
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { fullName: { contains: searchTerm, mode: 'insensitive' } },
      { contactNumber: { contains: searchTerm } },
      { id: { equals: searchTerm } },
    ];
  }

  try {
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take,
        // Sorted in the database (sorting one page in the browser showed the wrong customers).
        orderBy: CUSTOMER_SORTS[typeof req.query.sort === 'string' && CUSTOMER_SORTS[req.query.sort] ? req.query.sort : 'newest'],
        select: {
          id: true,
          email: true,
          fullName: true,
          contactNumber: true,
          companyGstin: true,
          accountType: true,
          accountStatus: true,
          suspendedReason: true,
          suspendedAt: true,
          callingBalanceMinutes: true,
          minutesRemainingSeconds: true,
          totalMinutesConsumed: true,
          billingBalance: true,
          lastSeenAt: true,
          createdAt: true,
          _count: {
            select: {
              calls: true,
              agents: true,
              batches: true,
            },
          },
        },
      }),
    ]);

    // Fetch customer admin profiles
    const userIds = users.map((u) => u.id);
    const adminProfiles = await prisma.customerAdminProfile.findMany({
      where: { userId: { in: userIds } },
    });
    const profileMap = new Map(adminProfiles.map((p) => [p.userId, p]));

    const enrichedUsers = users.map((u) => ({
      ...u,
      adminProfile: profileMap.get(u.id) || null,
      callsCount: u._count.calls,
      agentsCount: u._count.agents,
      campaignsCount: u._count.batches,
    }));

    // Filter by risk if requested
    const filteredUsers = risk && typeof risk === 'string' && risk !== 'all'
      ? enrichedUsers.filter((u) => u.adminProfile?.riskLevel === risk)
      : enrichedUsers;

    res.status(200).json({
      success: true,
      data: filteredUsers,
      pagination: {
        page: pageNum,
        limit: take,
        total: totalCount,
        totalPages: Math.ceil(totalCount / take),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list customers', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

/**
 * GET /api/v2/admin/customers/:id
 * Detailed Customer 360 profile.
 */
adminRouter.get('/customers/:id', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    // An explicit field list: the full row carried the password hash, the customer's own AI key,
    // encrypted calendar tokens and the carrier sub-account token to every staff role.
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        fullName: true,
        contactNumber: true,
        companyGstin: true,
        accountType: true,
        accountStatus: true,
        suspendedAt: true,
        suspendedReason: true,
        callingBalanceMinutes: true,
        minutesRemainingSeconds: true,
        totalMinutesConsumed: true,
        billingBalance: true,
        planExpiresAt: true,
        numberLocked: true,
        maxConcurrentCalls: true,
        dataRetentionDays: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        vobizSubAccount: {
          select: { authId: true, kycMode: true, kycStatus: true, businessType: true, kycCallsBlocked: true, kycVerifiedAt: true, createdAt: true },
        },
        phoneNumbers: {
          select: { id: true, phoneNumber: true, status: true, kycStatus: true, telephonyProvider: true, purchasedAt: true },
        },
        kycDocuments: {
          select: {
            id: true, documentType: true, status: true, panNumber: true, panType: true, fullName: true, gstin: true,
            aadhaarNumber: true, failureReason: true, verifiedAt: true, createdAt: true, updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }
    const kycDocuments = user.kycDocuments.map((d) => ({
      ...d,
      panNumber: maskTail(d.panNumber),
      aadhaarNumber: maskTail(d.aadhaarNumber),
    }));

    const [callsCount, agentsCount, phoneNumbersCount, apiKeysCount, adminProfile, totalPayments] = await Promise.all([
      prisma.call.count({ where: { userId: customerId } }),
      prisma.agent.count({ where: { userId: customerId } }),
      prisma.phoneNumber.count({ where: { userId: customerId } }),
      prisma.apiKey.count({ where: { userId: customerId, isActive: true } }),
      prisma.customerAdminProfile.findUnique({ where: { userId: customerId } }),
      // Fulfilled payments are stored as 'completed' ('paid' is kept for older rows).
      prisma.paymentTransaction.aggregate({
        where: { userId: customerId, status: { in: ['completed', 'paid'] } },
        _sum: { amount: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...user,
        kycDocuments,
        adminProfile: adminProfile || null,
        stats: {
          callsCount,
          agentsCount,
          phoneNumbersCount,
          apiKeysCount,
          totalSpentInr: totalPayments._sum?.amount || 0,
        },
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer 360', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load customer details' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/calls
 * Customer calls list.
 */
adminRouter.get('/customers/:id/calls', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * take;

  const isOwner = req.staff!.role === 'owner';

  try {
    const [total, calls] = await Promise.all([
      prisma.call.count({ where: { userId: customerId } }),
      prisma.call.findMany({
        where: { userId: customerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          recipientPhoneNumber: true,
          status: true,
          callDirection: true,
          durationSeconds: true,
          createdAt: true,
          recordingUrl: isOwner ? true : false,
          summary: isOwner ? true : false,
          sentiment: true,
          agent: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      // The carrier recording address never leaves the server: the owner gets hasRecording and
      // asks POST /calls/:id/recording-link for a short-lived, audited playback link.
      data: calls.map(({ recordingUrl, ...c }: any) => ({ ...c, hasRecording: isOwner ? Boolean(recordingUrl) : undefined })),
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer calls', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load customer calls' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/ledger
 * Customer minutes ledger transactions.
 */
adminRouter.get('/customers/:id/ledger', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { limit = '50' } = req.query;
  const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

  try {
    const entries = await prisma.minutesLedger.findMany({
      where: { userId: customerId },
      take,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: entries });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer ledger', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load minutes ledger' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/agents
 * Customer's agents list for the admin detail view.
 */
adminRouter.get('/customers/:id/agents', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * take;

  try {
    const [total, agents] = await Promise.all([
      prisma.agent.count({ where: { userId: customerId } }),
      prisma.agent.findMany({
        where: { userId: customerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          agentType: true,
          direction: true,
          model: true,
          voiceName: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { calls: true, batches: true },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: agents.map((a) => ({ ...a, callsCount: a._count.calls, campaignsCount: a._count.batches })),
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer agents', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load customer agents' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/campaigns
 * Customer's Batch campaigns for the admin detail view.
 */
adminRouter.get('/customers/:id/campaigns', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * take;

  try {
    const [total, campaigns] = await Promise.all([
      prisma.batch.count({ where: { userId: customerId } }),
      prisma.batch.findMany({
        where: { userId: customerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          totalRecipients: true,
          completedCount: true,
          failedCount: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          agent: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: campaigns,
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer campaigns', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load customer campaigns' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/payments
 * Customer's payment transactions and invoices for the admin detail view.
 */
adminRouter.get('/customers/:id/payments', requireStaff('payments:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * take;

  try {
    const [total, transactions] = await Promise.all([
      prisma.paymentTransaction.count({ where: { userId: customerId } }),
      prisma.paymentTransaction.findMany({
        where: { userId: customerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              amountInr: true,
              subtotalInr: true,
              gstRate: true,
              gstAmountInr: true,
              buyerGstin: true,
              sellerGstin: true,
              status: true,
              pdfUrl: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: { page: pageNum, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer payments', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load customer payments' });
  }
});


/**
 * GET /api/v2/admin/customers/:id/notes
 * CRM Notes for customer.
 */
adminRouter.get('/customers/:id/notes', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const notes = await prisma.customerNote.findMany({
      where: { userId: customerId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({ success: true, data: notes });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get customer notes', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/notes
 * Create a CRM note.
 */
adminRouter.post('/customers/:id/notes', requireStaff('customers:edit'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const { body, pinned = false } = req.body || {};

  if (typeof body !== 'string' || !body.trim() || body.length > 5000) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A note of 1-5,000 characters is required.' });
    return;
  }
  if (!(await customerExists(customerId))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  try {
    const note = await prisma.customerNote.create({
      data: {
        userId: customerId,
        staffId: req.staff!.id,
        staffEmail: req.staff!.email,
        body: body.trim(),
        pinned: !!pinned,
      },
    });

    res.status(201).json({ success: true, data: note });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create note', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to create note' });
  }
});

/**
 * GET /api/v2/admin/customers/:id/follow-ups
 * Follow-ups for customer.
 */
adminRouter.get('/customers/:id/follow-ups', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const followUps = await prisma.followUp.findMany({
      where: { userId: customerId },
      orderBy: { dueAt: 'asc' },
    });

    res.status(200).json({ success: true, data: followUps });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to get follow-ups', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to load follow-ups' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/follow-ups
 * Schedule a new follow-up.
 */
adminRouter.post('/customers/:id/follow-ups', requireStaff('customers:edit'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const { note, dueAt } = req.body || {};
  const due = typeof dueAt === 'string' || typeof dueAt === 'number' ? new Date(dueAt) : null;
  const maxDue = Date.now() + 2 * 365 * 86400000;

  if (typeof note !== 'string' || !note.trim() || note.length > 2000 || !due || Number.isNaN(due.getTime()) || due.getTime() > maxDue) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A note (up to 2,000 characters) and a valid due date within two years are required.' });
    return;
  }
  if (!(await customerExists(customerId))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  try {
    const followUp = await prisma.followUp.create({
      data: {
        userId: customerId,
        staffId: req.staff!.id,
        note: note.trim(),
        dueAt: due,
      },
    });

    res.status(201).json({ success: true, data: followUp });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create follow-up', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/follow-ups/:followUpId/done
 * Marks a follow-up as done (it stays in the history).
 */
adminRouter.post('/customers/:id/follow-ups/:followUpId/done', requireStaff('customers:edit'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const followUpId = paramOf(req, 'followUpId');
  try {
    // Compound filter: the follow-up must belong to this customer.
    const updated = await prisma.followUp.updateMany({
      where: { id: followUpId, userId: customerId, doneAt: null },
      data: { doneAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await prisma.followUp.findFirst({ where: { id: followUpId, userId: customerId }, select: { id: true } });
      if (!exists) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Follow-up not found.' });
        return;
      }
    }
    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to complete follow-up', { customerId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update follow-up.' });
  }
});

/**
 * PATCH /api/v2/admin/customers/:id/profile
 * Update tags, risk level, or assigned staff.
 */
adminRouter.patch('/customers/:id/profile', requireStaff('customers:edit'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const { tags, riskLevel, riskNote, assignedStaffId } = req.body || {};
  const reason = reasonOf(req.body) || 'Customer profile updated';

  const cleanTags = tags === undefined ? undefined
    : Array.isArray(tags) && tags.length <= 20 && tags.every((t) => typeof t === 'string' && t.trim() && t.length <= 40)
      ? Array.from(new Set(tags.map((t: string) => t.trim().toLowerCase())))
      : null;
  if (cleanTags === null
    || (riskLevel !== undefined && !RISK_LEVELS.includes(riskLevel))
    || (riskNote !== undefined && riskNote !== null && (typeof riskNote !== 'string' || riskNote.length > 1000))
    || (assignedStaffId !== undefined && assignedStaffId !== null && typeof assignedStaffId !== 'string')) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: `Up to 20 tags of 40 characters; risk level one of ${RISK_LEVELS.join(', ')}; note up to 1,000 characters.` });
    return;
  }

  try {
    if (!(await customerExists(customerId))) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    if (assignedStaffId) {
      const owner = await prisma.staffUser.findUnique({ where: { id: assignedStaffId }, select: { status: true } });
      if (!owner || owner.status === 'disabled') {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Assigned staff member not found or disabled.' });
        return;
      }
    }
    const before = await prisma.customerAdminProfile.findUnique({ where: { userId: customerId } });
    const updated = await withAudit(
      {
        ...auditBase(req),
        action: 'customers:profile_update',
        targetType: 'CustomerAdminProfile',
        targetId: customerId,
        customerId,
        reason,
      },
      async (tx) => {
        const row = await tx.customerAdminProfile.upsert({
          where: { userId: customerId },
          create: {
            userId: customerId,
            tags: cleanTags || [],
            riskLevel: riskLevel || 'none',
            riskNote: riskNote || null,
            assignedStaffId: assignedStaffId || null,
          },
          update: {
            tags: cleanTags,
            riskLevel: riskLevel || undefined,
            riskNote: riskNote !== undefined ? riskNote : undefined,
            assignedStaffId: assignedStaffId !== undefined ? assignedStaffId : undefined,
          },
        });
        return {
          result: row,
          before: before ? { tags: before.tags, riskLevel: before.riskLevel, riskNote: before.riskNote, assignedStaffId: before.assignedStaffId } : undefined,
          after: { tags: row.tags, riskLevel: row.riskLevel, riskNote: row.riskNote, assignedStaffId: row.assignedStaffId },
        };
      }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update customer profile', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/force-logout
 * Revokes customer sessions.
 */
adminRouter.post('/customers/:id/force-logout', requireStaff('security:force_logout'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const reason = reasonOf(req.body) || 'Staff initiated forced session termination';

  try {
    const user = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, sessionsRevokedAt: true } });
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
      return;
    }

    // Every session signed in before now is refused by requireAuth from the next request on
    // (the customer can sign in again). Recorded in the same transaction as the audit entry.
    const revokedAt = new Date();
    await withAudit(
      {
        ...auditBase(req),
        action: 'security:force_logout',
        targetType: 'User',
        targetId: customerId,
        customerId,
        reason,
        isCustomerVisible: true,
        customerActionDescription: 'All sessions were signed out by Claritiy Support',
      },
      async (tx) => {
        await tx.user.update({ where: { id: customerId }, data: { sessionsRevokedAt: revokedAt } });
        return { result: { terminated: true }, before: { sessionsRevokedAt: user.sessionsRevokedAt ? user.sessionsRevokedAt.toISOString() : null }, after: { sessionsRevokedAt: revokedAt.toISOString() } };
      }
    );

    res.status(200).json({ success: true, message: 'All of this customer\'s sessions are signed out. They can sign in again.' });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to force logout customer', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to terminate sessions' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/revoke-api-keys
 * Revokes all API keys for the customer.
 */
adminRouter.post('/customers/:id/revoke-api-keys', requireStaff('security:revoke_keys'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = paramOf(req);
  const reason = reasonOf(req.body) || 'Staff revoked all customer API keys';

  try {
    if (!(await customerExists(customerId))) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    const count = await withAudit(
      {
        ...auditBase(req),
        action: 'security:revoke_keys',
        targetType: 'User',
        targetId: customerId,
        customerId,
        reason,
        isCustomerVisible: true,
        customerActionDescription: 'All API keys were revoked by Claritiy Support',
      },
      async (tx) => {
        const updated = await tx.apiKey.updateMany({
          where: { userId: customerId, isActive: true },
          data: { isActive: false },
        });
        return { result: updated.count, after: { revokedKeysCount: updated.count } };
      }
    );

    res.status(200).json({ success: true, revokedCount: count });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to revoke API keys', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to revoke API keys' });
  }
});

/**
 * GET /api/v2/admin/metrics/overview
 * Platform-wide overview counters including agents, campaigns, call status breakdown.
 * NOTE: Gemini token usage is not tracked at the provider level — reported as unavailable.
 */
adminRouter.get('/metrics/overview', requireStaff('metrics:view'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      restrictedUsers,
      totalCalls,
      completedCalls,
      failedCalls,
      inProgressCalls,
      queuedCalls,
      totalAgents,
      totalCampaigns,
      totalMinutesLedger,
      vobizMinutesUsed,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { accountStatus: 'active' } }),
      prisma.user.count({ where: { accountStatus: 'suspended' } }),
      prisma.user.count({ where: { accountStatus: 'restricted' } }),
      prisma.call.count(),
      prisma.call.count({ where: { status: 'completed' } }),
      // Both spellings are stored (carrier callbacks use hyphens, the app uses underscores).
      prisma.call.count({ where: { status: { in: ['failed', 'no_answer', 'no-answer', 'busy'] } } }),
      prisma.call.count({ where: { status: { in: ['in_progress', 'in-progress'] } } }),
      prisma.call.count({ where: { status: { in: ['queued', 'ringing', 'initiated'] } } }),
      prisma.agent.count(),
      prisma.batch.count(),
      // Free minutes given by staff (purchases are counted separately below).
      prisma.minutesLedger.aggregate({
        where: { reason: 'admin_grant', deltaSeconds: { gt: 0 } },
        _sum: { deltaSeconds: true },
      }),
      prisma.minutesLedger.aggregate({
        where: { reason: 'call_usage', deltaSeconds: { lt: 0 } },
        _sum: { deltaSeconds: true },
      }),
    ]);
    const purchasedMinutes = await prisma.minutesLedger.aggregate({
      where: { reason: 'plan_purchase', deltaSeconds: { gt: 0 } },
      _sum: { deltaSeconds: true },
    });

    res.status(200).json({
      success: true,
      data: {
        totalCustomers: totalUsers,
        activeCustomers: activeUsers,
        suspendedCustomers: suspendedUsers,
        restrictedCustomers: restrictedUsers,
        inactiveCustomers: totalUsers - activeUsers - suspendedUsers - restrictedUsers,
        totalCallsPlaced: totalCalls,
        callsByStatus: {
          completed: completedCalls,
          failed: failedCalls,
          inProgress: inProgressCalls,
          queued: queuedCalls,
        },
        totalAgents,
        totalCampaigns,
        totalMinutesGranted: Math.round((totalMinutesLedger._sum.deltaSeconds || 0) / 60),
        totalMinutesPurchased: Math.round((purchasedMinutes._sum.deltaSeconds || 0) / 60),
        vobizMinutesUsed: Math.round(Math.abs(vobizMinutesUsed._sum.deltaSeconds || 0) / 60),
        geminiTokenUsage: {
          available: false,
          note: 'Gemini token usage is not tracked at the provider level. No GeminiTokenUsage table exists in the current schema.',
        },
        dataSource: 'internal_ledger',
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to fetch metrics overview', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch overview metrics' });
  }
});

/**
 * GET /api/v2/admin/usage
 * Platform usage breakdown by customer, recent telephony ledger activity, and provider health.
 */
adminRouter.get('/usage', requireStaff('metrics:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [topConsumers, recentUsageTransactions, totalUsageAgg, totalGrantedAgg] = await Promise.all([
      prisma.user.findMany({
        take: 25,
        orderBy: { totalMinutesConsumed: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          accountType: true,
          accountStatus: true,
          totalMinutesConsumed: true,
          callingBalanceMinutes: true,
          minutesRemainingSeconds: true,
          createdAt: true,
          _count: {
            select: { calls: true, agents: true },
          },
        },
      }),
      prisma.minutesLedger.findMany({
        where: { reason: 'call_usage' },
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
      prisma.minutesLedger.aggregate({
        where: { reason: 'call_usage' },
        _sum: { deltaSeconds: true },
        _count: true,
      }),
      prisma.minutesLedger.aggregate({
        where: { reason: 'admin_grant', deltaSeconds: { gt: 0 } },
        _sum: { deltaSeconds: true },
      }),
    ]);
    const totalPurchasedAgg = await prisma.minutesLedger.aggregate({
      where: { reason: 'plan_purchase', deltaSeconds: { gt: 0 } },
      _sum: { deltaSeconds: true },
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalMinutesUsed: Math.round(Math.abs(totalUsageAgg._sum.deltaSeconds || 0) / 60),
          totalMinutesGranted: Math.round((totalGrantedAgg._sum.deltaSeconds || 0) / 60),
          totalMinutesPurchased: Math.round((totalPurchasedAgg._sum.deltaSeconds || 0) / 60),
          callUsageRecordsCount: totalUsageAgg._count,
          providerStatus: {
            vobiz: {
              source: 'Internal Ledger',
              isLiveSynced: false,
              note: 'Tracked via MinutesLedger call_usage debits. Reconciliation job with Vobiz vendor API is not yet automated.',
            },
            gemini: {
              source: 'Not Tracked',
              isLiveSynced: false,
              note: 'Unavailable. Gemini token metrics are not intercepted or persisted in database.',
            },
          },
        },
        topConsumers: topConsumers.map((u) => ({
          ...u,
          callsCount: u._count.calls,
          agentsCount: u._count.agents,
        })),
        recentActivity: recentUsageTransactions,
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to fetch usage metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to load usage data' });
  }
});

/**
 * GET /api/v2/admin/calls
 * Platform-wide calls list with filtering and search.
 */
adminRouter.get('/calls', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', status, direction, q } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
  const skip = (pageNum - 1) * take;

  const whereClause: any = {};
  // A status filter matches both stored spellings (no-answer / no_answer, in-progress / in_progress).
  const STATUS_ALIASES: Record<string, string[]> = {
    completed: ['completed'],
    failed: ['failed'],
    no_answer: ['no_answer', 'no-answer'],
    busy: ['busy'],
    in_progress: ['in_progress', 'in-progress'],
    ringing: ['ringing', 'initiated'],
    queued: ['queued'],
    cancelled: ['cancelled', 'canceled'],
  };
  if (status && typeof status === 'string' && status !== 'all') {
    if (!STATUS_ALIASES[status]) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `status must be one of: all, ${Object.keys(STATUS_ALIASES).join(', ')}` });
      return;
    }
    whereClause.status = { in: STATUS_ALIASES[status] };
  }
  if (direction && typeof direction === 'string' && direction !== 'all') {
    if (!['inbound', 'outbound'].includes(direction)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'direction must be all, inbound or outbound' });
      return;
    }
    whereClause.callDirection = direction;
  }
  if (typeof q === 'string' && q.length > 200) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Search text is too long.' });
    return;
  }
  if (q && typeof q === 'string' && q.trim()) {
    const term = q.trim();
    whereClause.OR = [
      { recipientPhoneNumber: { contains: term } },
      { id: { equals: term } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const isOwner = req.staff!.role === 'owner';

  try {
    const [total, calls] = await Promise.all([
      prisma.call.count({ where: whereClause }),
      prisma.call.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          recipientPhoneNumber: true,
          fromPhoneNumber: true,
          status: true,
          endReason: true,
          endDetail: true,
          endedBy: true,
          callDirection: true,
          durationSeconds: true,
          createdAt: true,
          recordingUrl: isOwner,
          summary: isOwner,
          sentiment: true,
          agent: {
            select: { id: true, name: true },
          },
          batch: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      // The carrier recording address never leaves the server: the owner gets hasRecording and
      // asks POST /calls/:id/recording-link for a short-lived, audited playback link.
      data: calls.map(({ recordingUrl, ...c }: any) => ({ ...c, hasRecording: isOwner ? Boolean(recordingUrl) : undefined })),
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list platform calls', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve calls' });
  }
});

/**
 * GET /api/v2/admin/numbers
 * Platform-wide phone numbers list.
 */
adminRouter.get('/numbers', requireStaff('customers:view'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const numbers = await prisma.phoneNumber.findMany({
      orderBy: { purchasedAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        telephonyProvider: true,
        status: true,
        kycStatus: true,
        purchasedAt: true,
        user: {
          select: { id: true, email: true, fullName: true },
        },
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(200).json({ success: true, data: numbers });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list phone numbers', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve phone numbers' });
  }
});

/**
 * GET /api/v2/admin/payments
 * Platform-wide payment transactions and invoices.
 */
adminRouter.get('/payments', requireStaff('payments:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', status } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
  const skip = (pageNum - 1) * take;

  const whereClause: any = {};
  if (status && typeof status === 'string' && status !== 'all') {
    whereClause.status = status;
  }

  try {
    const [total, transactions] = await Promise.all([
      prisma.paymentTransaction.count({ where: whereClause }),
      prisma.paymentTransaction.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true, amountInr: true, status: true, pdfUrl: true },
          },
        },
      }),
    ]);

    // Enrich with user emails
    const userIds = Array.from(new Set(transactions.map((t) => t.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = transactions.map((t) => ({
      ...t,
      user: userMap.get(t.userId) || null,
    }));

    res.status(200).json({
      success: true,
      data: enriched,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list payments', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

/**
 * GET /api/v2/admin/audit-logs
 * Platform-wide immutable audit logs.
 */
adminRouter.get('/audit-logs', requireStaff('audit:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '30', action, staffId, customerId } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
  const skip = (pageNum - 1) * take;

  const whereClause: any = {};
  if (action && typeof action === 'string') whereClause.action = action;
  if (staffId && typeof staffId === 'string') whereClause.staffId = staffId;
  if (customerId && typeof customerId === 'string') whereClause.customerId = customerId;

  try {
    const [total, logs] = await Promise.all([
      prisma.adminAuditLog.count({ where: whereClause }),
      prisma.adminAuditLog.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list audit logs', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

/**
 * GET /api/v2/admin/metrics/daily
 * Daily rollups for the overview charts (IST Asia/Kolkata boundary).
 */
adminRouter.get('/metrics/daily', requireStaff('metrics:view'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // The LATEST 14 days, oldest first for the chart (audit #62: ascending + take returned the
    // oldest 14 days ever recorded).
    const latest = await prisma.dailyMetric.findMany({
      take: 14,
      orderBy: { date: 'desc' },
    });
    const dailyMetrics = latest.reverse();

    res.status(200).json({ success: true, data: dailyMetrics });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to fetch daily metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch daily metrics' });
  }
});

/**
 * Number activation and KYC "reset" routes were removed (fix/admin-panel 2026-11-23):
 *  - PATCH /numbers/:id/activate marked a number active AND its KYC verified without any check,
 *    bypassing the real KYC state and the paid-plan rule (CLAUDE.md B9: never auto-approve).
 *  - POST /customers/:id/kyc/reset only set phone_numbers.kyc_status = pending, which blocked the
 *    customer's calls while the real KYC record (carrier sub-account, documents) stayed unchanged.
 * Neither was called by the admin console. KYC truth comes from the carrier sync (routes/kyc.ts).
 */

/**
 * POST /api/v2/admin/calls/:id/terminate
 * Terminates an in-flight call session immediately (single hang-up path: CallService.terminateCall).
 */
adminRouter.post('/calls/:id/terminate', requireStaff('calls:terminate'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const callId = paramOf(req);
  const reason = reasonOf(req.body) || 'Staff initiated immediate call termination';

  try {
    const callRow = await prisma.call.findUnique({ where: { id: callId }, select: { id: true, userId: true, status: true } });
    if (!callRow) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
      return;
    }
    // Same end path as a supervisor hang-up (final status, minutes billed once, carrier leg closed).
    await CallService.terminateCall(callId, 'user_terminated', `Ended by Claritiy support: ${reason}`.slice(0, 300), 'system');
    await withAudit(
      {
        ...auditBase(req),
        action: 'calls:terminate',
        targetType: 'Call',
        targetId: callId,
        customerId: callRow.userId,
        reason,
      },
      async () => ({ result: { terminated: true }, before: { status: callRow.status } })
    );

    res.status(200).json({ success: true, message: 'Call terminated successfully.' });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to terminate call', { callId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to terminate call.' });
  }
});

// ─── Plans: built-in (server price list) and private custom plans ───

/** Account tiers a custom plan may grant: exactly the tiers the built-in plans use. */
export const PLAN_ACCOUNT_TYPES = ['trial', 'starter', 'developer', 'professional', 'enterprise'];
const PLAN_KEY_RE = /^[a-z0-9_]{3,40}$/;

/** List price per minute of the built-in plan that grants this tier (best public rate as fallback). */
function listRatePerMinute(accountType: string): number {
  const plans = Object.values(PLAN_CONFIG);
  const tier = plans.find((p) => p.accountType === accountType && p.minutes > 0);
  if (tier) return tier.price / tier.minutes;
  return Math.min(...plans.filter((p) => p.accountType !== 'trial' && p.minutes > 0).map((p) => p.price / p.minutes));
}

/** Discount (0-100, one decimal) of a price for some minutes against the tier's list rate. */
export function computedDiscountPercent(priceInr: number, minutes: number, accountType: string): number {
  const list = listRatePerMinute(accountType);
  if (!(list > 0) || !(minutes > 0)) return 0;
  const d = (1 - (priceInr / minutes) / list) * 100;
  return Math.max(0, Math.round(d * 10) / 10);
}

function builtInPlanList() {
  return Object.entries(PLAN_CONFIG).map(([key, p]) => ({
    key,
    name: p.name,
    priceInr: p.price,
    minutes: p.minutes,
    accountType: p.accountType,
    maxConcurrentCalls: p.maxConcurrentCalls,
    purchasable: p.purchasable !== false,
  }));
}

/**
 * GET /api/v2/admin/plans
 * Custom private plans (data) plus the built-in price list as the server applies it right now.
 */
adminRouter.get('/plans', requireStaff('plans:manage'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plans = await prisma.planCatalog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.status(200).json({ success: true, data: plans, builtIn: builtInPlanList() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list plans', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve plans' });
  }
});

/**
 * POST /api/v2/admin/plans/custom
 * Creates a private plan (optionally for one customer). The discount is computed by the server
 * from price and minutes against the list rate of the same tier, and checked against the role cap.
 * A custom plan is sold only through a payment link (or given with "Assign plan").
 */
adminRouter.post('/plans/custom', requireStaff('plans:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const priceInr = Number(body.priceInr);
  const minutes = Number(body.minutes);
  const accountType = typeof body.accountType === 'string' ? body.accountType : '';
  const validityDays = body.validityDays === undefined || body.validityDays === null || body.validityDays === '' ? null : Number(body.validityDays);
  const customerUserId = typeof body.customerUserId === 'string' && body.customerUserId.trim() ? body.customerUserId.trim() : null;
  const reason = reasonOf(body) || `Created custom plan ${name}`;
  const planKey = typeof body.key === 'string' && body.key.trim() ? body.key.trim().toLowerCase() : `custom_${Date.now().toString(36)}`;

  if (!name || name.length > 80
    || !Number.isInteger(priceInr) || priceInr < 1 || priceInr > 10_000_000
    || !Number.isInteger(minutes) || minutes < 1 || minutes > 1_000_000
    || !PLAN_ACCOUNT_TYPES.includes(accountType)
    || (validityDays !== null && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365))) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `Name (up to 80 characters), whole-rupee price 1-1,00,00,000, whole minutes 1-10,00,000, features of one of: ${PLAN_ACCOUNT_TYPES.join(', ')}, and validity 1-365 days are required.`,
    });
    return;
  }
  if (!PLAN_KEY_RE.test(planKey) || (PLAN_CONFIG as Record<string, unknown>)[planKey]) {
    res.status(400).json({ error: 'INVALID_PLAN_KEY', message: 'The plan key must be 3-40 lowercase letters, digits or _ and must not be a built-in plan name.' });
    return;
  }
  if (customerUserId && !(await customerExists(customerUserId))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
    return;
  }

  const discountPercent = computedDiscountPercent(priceInr, minutes, accountType);
  const discountErr = await validateDiscountCap(req.staff!.role, discountPercent);
  if (discountErr) {
    res.status(403).json({ error: 'OVER_DISCOUNT_CAP', message: discountErr });
    return;
  }

  try {
    const newPlan = await withAudit(
      {
        ...auditBase(req),
        action: 'plans:manage',
        targetType: 'PlanCatalog',
        targetId: planKey,
        customerId: customerUserId,
        reason,
      },
      async (tx) => {
        const p = await tx.planCatalog.create({
          data: {
            key: planKey,
            name,
            priceInr,
            minutes,
            accountType,
            isPublic: false,
            customerUserId,
            validityDays,
            active: true,
            createdBy: req.staff!.email,
          },
        });
        return { result: p, after: { planKey, name, priceInr, minutes, accountType, validityDays, customerUserId, discountPercent } };
      }
    );

    res.status(201).json({ success: true, data: { ...newPlan, discountPercent } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'CONFLICT', message: 'A plan with this key already exists.' });
      return;
    }
    logger.error('[ADMIN_API] Failed to create custom plan', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create custom plan' });
  }
});

/**
 * PATCH /api/v2/admin/plans/:id
 * Turns a custom plan on or off (price and minutes are fixed once created: make a new plan instead,
 * so a link or invoice never changes meaning afterwards).
 */
adminRouter.patch('/plans/:id', requireStaff('plans:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const active = req.body?.active;
  const reason = reasonOf(req.body);
  if (typeof active !== 'boolean' || !reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'active (true/false) and a reason are required.' });
    return;
  }
  try {
    const row = await prisma.planCatalog.findUnique({ where: { id } });
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found.' });
      return;
    }
    const updated = await withAudit(
      { ...auditBase(req), action: 'plans:toggle', targetType: 'PlanCatalog', targetId: row.key, customerId: row.customerUserId, reason },
      async (tx) => ({ result: await tx.planCatalog.update({ where: { id }, data: { active } }), before: { active: row.active }, after: { active } })
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update plan', { id, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update plan' });
  }
});

/** The plan a payment link or assignment may use for this customer, or null. */
async function resolveSellablePlan(planKey: string, customerUserId: string) {
  const key = String(planKey || '').trim().toLowerCase();
  const builtIn = (PLAN_CONFIG as Record<string, typeof PLAN_CONFIG[string]>)[key];
  if (builtIn) {
    return { key, name: builtIn.name, priceInr: builtIn.price, minutes: builtIn.minutes, accountType: builtIn.accountType, validityDays: null as number | null, custom: false };
  }
  const row = await prisma.planCatalog.findUnique({ where: { key } });
  if (!row || !row.active || (row.customerUserId && row.customerUserId !== customerUserId)) return null;
  return { key, name: row.name, priceInr: row.priceInr, minutes: row.minutes, accountType: row.accountType, validityDays: row.validityDays, custom: true };
}

/**
 * POST /api/v2/admin/payments/create-link
 * Creates a real Razorpay payment link for one customer and one plan. Price and minutes come from
 * the server (plan price minus the discount, checked against the role cap). When the link is paid,
 * the Razorpay webhook (payment_link.paid) fulfils exactly this amount and these minutes.
 */
adminRouter.post('/payments/create-link', requireStaff('payment_links:create'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const body = req.body || {};
  const customerUserId = typeof body.customerUserId === 'string' ? body.customerUserId.trim() : '';
  const discountPercent = body.discountPercent === undefined || body.discountPercent === '' ? 0 : Number(body.discountPercent);
  const expiresInDays = body.expiresInDays === undefined || body.expiresInDays === '' ? 7 : Number(body.expiresInDays);
  const reason = reasonOf(body) || 'Payment link for a customer';

  if (!customerUserId || typeof body.planKey !== 'string' || !body.planKey.trim()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A customer and a plan are required (price and minutes always come from the plan).' });
    return;
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Discount must be 0-100% and the link must expire in 1-30 days.' });
    return;
  }

  try {
    const customer = await prisma.user.findUnique({ where: { id: customerUserId }, select: { id: true, email: true, fullName: true, contactNumber: true, accountStatus: true } });
    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    if (customer.accountStatus === 'suspended') {
      res.status(409).json({ error: 'ACCOUNT_SUSPENDED', message: 'This account is suspended. Restore it before sending a payment link.' });
      return;
    }
    const plan = await resolveSellablePlan(body.planKey, customerUserId);
    if (!plan) {
      res.status(400).json({ error: 'PLAN_UNKNOWN', message: 'Unknown or inactive plan, or a custom plan made for another customer.' });
      return;
    }

    const amountInr = Math.max(1, Math.round(plan.priceInr * (1 - discountPercent / 100)));
    // The cap applies to the total discount against list price (a custom plan may already be discounted).
    const totalDiscount = computedDiscountPercent(amountInr, plan.minutes, plan.accountType);
    const discountErr = await validateDiscountCap(req.staff!.role, Math.max(discountPercent, totalDiscount));
    if (discountErr) {
      res.status(403).json({ error: 'OVER_DISCOUNT_CAP', message: discountErr });
      return;
    }

    const expireBy = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
    const gatewayLink = await billing().createPaymentLink({
      amountPaise: amountInr * 100,
      description: `Claritiy Voice ${plan.name} plan (${plan.minutes.toLocaleString('en-IN')} minutes)`.slice(0, 2048),
      customer: { name: customer.fullName || undefined, email: customer.email, contact: customer.contactNumber || undefined },
      notes: { userId: customer.id, purpose: 'plan_link', planKey: plan.key, minutes: String(plan.minutes) },
      expireBy,
    });

    const paymentLink = await withAudit(
      {
        ...auditBase(req),
        action: 'payment_links:create',
        targetType: 'PaymentLink',
        targetId: gatewayLink.id,
        customerId: customer.id,
        reason,
      },
      async (tx) => {
        const link = await tx.paymentLink.create({
          data: {
            userId: customer.id,
            planKey: plan.key,
            customPlanId: plan.custom ? plan.key : null,
            amountInr,
            minutes: plan.minutes,
            status: 'created',
            razorpayLinkId: gatewayLink.id,
            shortUrl: gatewayLink.shortUrl || null,
            expiresAt: new Date(expireBy * 1000),
            createdByStaffId: req.staff!.id,
          },
        });
        return { result: link, after: { razorpayLinkId: gatewayLink.id, planKey: plan.key, amountInr, minutes: plan.minutes, discountPercent, testMode: gatewayLink.mock } };
      }
    );

    res.status(201).json({ success: true, data: { ...paymentLink, testMode: gatewayLink.mock } });
  } catch (err: any) {
    if (err?.status && err?.code) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    logger.error('[ADMIN_API] Failed to create payment link', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create payment link' });
  }
});

/**
 * GET /api/v2/admin/payment-links?customerId=
 */
adminRouter.get('/payment-links', requireStaff('payments:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
  try {
    const links = await prisma.paymentLink.findMany({
      where: customerId ? { userId: customerId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.status(200).json({ success: true, data: links });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list payment links', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load payment links' });
  }
});

/**
 * POST /api/v2/admin/payment-links/:id/cancel
 * Cancels an unpaid link at Razorpay first; only then is it marked cancelled here.
 */
adminRouter.post('/payment-links/:id/cancel', requireStaff('payment_links:create'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body) || 'Payment link cancelled';
  try {
    const link = await prisma.paymentLink.findUnique({ where: { id } });
    if (!link) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Payment link not found.' });
      return;
    }
    if (link.status !== 'created') {
      res.status(409).json({ error: 'NOT_CANCELLABLE', message: `This link is already ${link.status}.` });
      return;
    }
    await billing().cancelPaymentLink(link.razorpayLinkId);
    const updated = await withAudit(
      { ...auditBase(req), action: 'payment_links:cancel', targetType: 'PaymentLink', targetId: link.razorpayLinkId, customerId: link.userId, reason },
      async (tx) => ({ result: await tx.paymentLink.update({ where: { id }, data: { status: 'cancelled' } }), before: { status: link.status }, after: { status: 'cancelled' } })
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    if (err?.status && err?.code) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    logger.error('[ADMIN_API] Failed to cancel payment link', { id, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to cancel payment link' });
  }
});

/**
 * POST /api/v2/admin/payments/:id/refund
 * Full refund through Razorpay. Order of operations:
 *   1. claim the payment (completed -> refund_pending) so two clicks can never refund twice;
 *   2. ask Razorpay; on failure the payment goes back to completed and nothing else changes;
 *   3. on success, in one transaction: payment + invoice "refunded", the minutes that purchase added
 *      are taken back (never below zero), and optionally the plan ends now.
 */
adminRouter.post('/payments/:id/refund', requireStaff('refunds:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const transactionId = paramOf(req);
  const reason = reasonOf(req.body);
  const endPlan = req.body?.endPlan === true;

  if (!reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A refund reason (at least 3 characters) is mandatory.' });
    return;
  }

  const txRecord = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } }).catch(() => null);
  if (!txRecord) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Payment transaction not found.' });
    return;
  }
  const refundable = ['completed', 'paid'];
  if (!refundable.includes(txRecord.status) || !txRecord.paymentId || !(Number(txRecord.amount) > 0)) {
    res.status(409).json({ error: 'NOT_REFUNDABLE', message: `This payment cannot be refunded (status: ${txRecord.status}).` });
    return;
  }

  // 1. Claim.
  const claim = await prisma.paymentTransaction.updateMany({
    where: { id: transactionId, status: { in: refundable } },
    data: { status: 'refund_pending' },
  });
  if (claim.count !== 1) {
    res.status(409).json({ error: 'NOT_REFUNDABLE', message: 'This payment is already being refunded or was refunded.' });
    return;
  }

  // 2. Gateway.
  const amountPaise = Math.round(Number(txRecord.amount) * 100);
  const refundResult = await billing().refundOrder(txRecord.paymentId, amountPaise, `Admin refund: ${reason}`.slice(0, 250));
  if (!refundResult.success) {
    await prisma.paymentTransaction.update({ where: { id: transactionId }, data: { status: txRecord.status } }).catch(() => {});
    await withAudit(
      { ...auditBase(req), action: 'refunds:failed', targetType: 'PaymentTransaction', targetId: transactionId, customerId: txRecord.userId, reason },
      async () => ({ result: null, after: { gateway: 'refund_failed', amountPaise } })
    ).catch(() => {});
    res.status(502).json({ error: 'REFUND_FAILED', message: 'Razorpay did not accept the refund. Nothing was changed. Check the Razorpay dashboard, then try again.' });
    return;
  }

  // 3. Record.
  try {
    const updated = await withAudit(
      {
        ...auditBase(req),
        action: 'refunds:manage',
        targetType: 'PaymentTransaction',
        targetId: transactionId,
        customerId: txRecord.userId,
        reason,
        isCustomerVisible: true,
        customerActionDescription: `Payment of INR ${Number(txRecord.amount).toLocaleString('en-IN')} refunded by Claritiy Support`,
      },
      async (tx) => {
        const updatedTx = await tx.paymentTransaction.update({ where: { id: transactionId }, data: { status: 'refunded', refundedAmount: Number(txRecord.amount) } });
        await tx.invoice.updateMany({ where: { paymentTransactionId: transactionId }, data: { status: 'refunded' } });

        // Minutes this purchase added (ledger rows that reference it).
        const credits = await tx.minutesLedger.aggregate({
          where: { userId: txRecord.userId, refType: 'payment_transaction', refId: transactionId, deltaSeconds: { gt: 0 } },
          _sum: { deltaSeconds: true },
        });
        const creditedSeconds = credits._sum.deltaSeconds || 0;
        const user = await tx.user.findUnique({ where: { id: txRecord.userId }, select: { minutesRemainingSeconds: true } });
        const takeBack = Math.min(creditedSeconds, Math.max(0, Math.floor(user?.minutesRemainingSeconds || 0)));
        if (takeBack > 0) {
          await MinutesService.debit(
            {
              userId: txRecord.userId,
              deltaSeconds: takeBack,
              reason: 'refund',
              refType: 'payment_transaction',
              refId: transactionId,
              note: `Refund of ${txRecord.planName}: purchased minutes removed`,
              actorType: 'staff',
              actorId: req.staff!.id,
              idempotencyKey: `refund_${transactionId}`,
            },
            tx
          );
        }
        if (endPlan) {
          await tx.user.update({ where: { id: txRecord.userId }, data: { planExpiresAt: new Date() } });
        }
        return {
          result: { ...updatedTx, refundId: refundResult.refundId, minutesRemoved: Math.round(takeBack / 60), planEnded: endPlan },
          before: { status: txRecord.status },
          after: { status: 'refunded', refundId: refundResult.refundId, minutesRemoved: Math.round(takeBack / 60), planEnded: endPlan },
        };
      }
    );

    // The refund is done and recorded: close any "needs your decision" case for this payment and
    // tell the customer (bell + email). Best effort, never undoes the refund.
    const casesClosed = await closeIssuesForPayment(txRecord.paymentId).catch(() => 0);
    await notifyCustomerOfRefund({ userId: txRecord.userId, amountInr: Number(txRecord.amount), refundId: refundResult.refundId, planName: txRecord.planName });

    res.status(200).json({ success: true, data: { ...updated, casesClosed, customerNotified: true } });
  } catch (err: any) {
    // Money has gone back to the customer but the records could not be updated: leave the payment in
    // refund_pending (visible in the console) and alert loudly so a person finishes it.
    logger.error('[CRITICAL_ADMIN_ALERT] Refund issued at Razorpay but not recorded', { transactionId, refundId: refundResult.refundId, error: err.message });
    res.status(500).json({ error: 'REFUND_NOT_RECORDED', message: `Razorpay refunded the payment (refund ${refundResult.refundId}), but the records could not be updated. The payment stays "refund_pending"; ask engineering to finish it.` });
  }
});

/**
 * GET /api/v2/admin/exports/:type
 * CSV download of customers, calls or payments (latest 5,000 rows). Every export is recorded in the
 * admin audit log as a sensitive read.
 */
adminRouter.get('/exports/:type', requireStaff('exports:csv'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const exportType = paramOf(req, 'type');
  const LIMIT = 5000;

  try {
    let csvData = '';
    const now = new Date().toISOString().slice(0, 10);

    if (exportType === 'customers') {
      const users = await prisma.user.findMany({
        take: LIMIT,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, accountType: true, accountStatus: true, minutesRemainingSeconds: true, planExpiresAt: true, createdAt: true },
      });
      csvData = 'ID,Email,FullName,Plan,AccountStatus,MinutesRemaining,PlanEnds,CreatedAt\n' +
        users.map((u) => csvLine([u.id, u.email, u.fullName || '', u.accountType, u.accountStatus, Math.floor((u.minutesRemainingSeconds || 0) / 60), u.planExpiresAt ? u.planExpiresAt.toISOString() : '', u.createdAt.toISOString()])).join('\n');
    } else if (exportType === 'calls') {
      const calls = await prisma.call.findMany({
        take: LIMIT,
        orderBy: { createdAt: 'desc' },
        select: { id: true, recipientPhoneNumber: true, status: true, callDirection: true, durationSeconds: true, createdAt: true, userId: true },
      });
      csvData = 'ID,Number,Direction,Status,DurationSeconds,UserId,CreatedAt\n' +
        calls.map((c) => csvLine([c.id, c.recipientPhoneNumber, c.callDirection || '', c.status, c.durationSeconds || 0, c.userId, c.createdAt.toISOString()])).join('\n');
    } else if (exportType === 'payments') {
      const payments = await prisma.paymentTransaction.findMany({
        take: LIMIT,
        orderBy: { createdAt: 'desc' },
        select: { id: true, paymentId: true, planName: true, amount: true, status: true, source: true, userId: true, createdAt: true },
      });
      csvData = 'ID,PaymentId,PlanName,AmountINR,Status,Source,UserId,CreatedAt\n' +
        payments.map((p) => csvLine([p.id, p.paymentId, p.planName, p.amount || 0, p.status, p.source || '', p.userId, p.createdAt.toISOString()])).join('\n');
    } else {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid export type. Must be customers, calls, or payments.' });
      return;
    }

    await logAdminRead({ ...auditBase(req), action: 'exports:csv', targetType: 'Export', targetId: exportType, reason: `CSV export of ${exportType}` });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="claritiy_${exportType}_${now}.csv"`);
    // BOM so Excel opens Hindi and other non-Latin names correctly.
    res.status(200).send(`\uFEFF${csvData}`);
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to generate export', { exportType, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate CSV export' });
  }
});

/**
 * GET /api/v2/admin/provisioning-alerts
 * Lists failed phone number orders, KYC-verified users with no number, and system alerts.
 */
adminRouter.get('/provisioning-alerts', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const failedOrders = await prisma.phoneNumberOrder.findMany({
      where: {
        orderStatus: { in: ['failed', 'assignment_failed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const userIds = [...new Set(failedOrders.map(o => o.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const verifiedUsersWithoutNumber = await prisma.user.findMany({
      where: {
        kycDocuments: {
          some: {
            status: 'verified',
            updatedAt: { lte: fifteenMinutesAgo },
          },
        },
        phoneNumbers: {
          none: {},
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        kycDocuments: {
          where: { status: 'verified' },
          select: { updatedAt: true },
          take: 1,
        },
      },
      take: 50,
    });

    const systemAlerts = await prisma.systemAlert.findMany({
      where: {
        type: 'FAILED_PROVISIONING',
        userId: null,
        isResolved: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json({
      success: true,
      data: {
        failedOrders: failedOrders.map(o => ({
          ...o,
          user: userMap.get(o.userId) || null,
        })),
        verifiedUsersWithoutNumber: verifiedUsersWithoutNumber.map(u => ({
          userId: u.id,
          email: u.email,
          fullName: u.fullName,
          verifiedAt: u.kycDocuments[0]?.updatedAt || u.createdAt,
        })),
        systemAlerts,
      },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to fetch provisioning alerts', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch provisioning alerts' });
  }
});

/**
 * POST /api/v2/admin/orders/:orderId/resolve
 * Closes a failed number order after a person has dealt with it (refunded, assigned by hand in the
 * carrier console, or other). Replaces the old "retry", which reset the order to 'validating':
 * nothing ever picks that state up, and the customer was then stuck on "purchase already in
 * progress" for that payment (and for an already-bought number a re-run would buy it twice).
 */
const ORDER_RESOLUTIONS = ['refunded', 'assigned_manually', 'other'];

adminRouter.post('/orders/:orderId/resolve', requireStaff('numbers:activate'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const orderId = paramOf(req, 'orderId');
  const resolution = req.body?.resolution;
  const reason = reasonOf(req.body);
  if (!ORDER_RESOLUTIONS.includes(resolution) || !reason) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: `A resolution (${ORDER_RESOLUTIONS.join(', ')}) and a reason are required.` });
    return;
  }
  try {
    const order = await prisma.phoneNumberOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Order not found' });
      return;
    }
    if (!['failed', 'assignment_failed'].includes(order.orderStatus)) {
      res.status(409).json({ success: false, error: 'NOT_FAILED', message: `Only failed orders can be resolved (this one is ${order.orderStatus}).` });
      return;
    }
    const note = `Resolved by support (${resolution}): ${reason}`;
    await withAudit(
      { ...auditBase(req), action: 'orders:resolve', targetType: 'PhoneNumberOrder', targetId: orderId, customerId: order.userId, reason },
      async (tx) => {
        await tx.phoneNumberOrder.update({
          where: { id: orderId },
          data: { orderStatus: 'resolved', failureReason: `${order.failureReason ? `${order.failureReason} | ` : ''}${note}`.slice(0, 2000) },
        });
        return { result: null, before: { orderStatus: order.orderStatus }, after: { orderStatus: 'resolved', resolution } };
      }
    );
    res.status(200).json({ success: true, message: 'Order marked as resolved.' });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to resolve order', { orderId, error: err.message });
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to resolve the order.' });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// CONTROL PANEL (owner request 2026-11-23): settings that used to need a code change
// ═════════════════════════════════════════════════════════════════════════════

function sendValidation(res: Response, errors: string[]): void {
  res.status(400).json({ error: 'VALIDATION_ERROR', message: errors.join(' '), errors });
}

/**
 * GET /api/v2/admin/platform
 * Plans (default vs live), switches, role caps. Owner only (settings:manage).
 */
adminRouter.get('/platform', requireStaff('settings:manage'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await PlatformConfigService.getAdminView() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to load platform settings', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load platform settings' });
  }
});

/**
 * PUT /api/v2/admin/platform/plans/:key
 * Changes a built-in plan (price, minutes, limits, can be bought). Takes effect for new checkouts
 * at once; payments already started keep the terms they were created with.
 */
adminRouter.put('/platform/plans/:key', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const reason = reasonOf(req.body);
  if (!reason) {
    sendValidation(res, ['A reason (at least 3 characters) is required.']);
    return;
  }
  try {
    const result = await PlatformConfigService.updatePlan(paramOf(req, 'key'), req.body?.plan ?? {}, { ...auditBase(req), reason });
    if (!result.ok) {
      sendValidation(res, result.errors);
      return;
    }
    res.status(200).json({ success: true, data: await PlatformConfigService.getAdminView() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update plan settings', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save the plan' });
  }
});

/**
 * POST /api/v2/admin/platform/plans/:key/reset
 * Back to the values written in the code (config/plans.ts).
 */
adminRouter.post('/platform/plans/:key/reset', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const reason = reasonOf(req.body);
  if (!reason) {
    sendValidation(res, ['A reason (at least 3 characters) is required.']);
    return;
  }
  try {
    const result = await PlatformConfigService.resetPlan(paramOf(req, 'key'), { ...auditBase(req), reason });
    if (!result.ok) {
      sendValidation(res, result.errors);
      return;
    }
    res.status(200).json({ success: true, data: await PlatformConfigService.getAdminView() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to reset plan settings', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to reset the plan' });
  }
});

/**
 * PUT /api/v2/admin/platform/switches
 * Maintenance banner, pause sign-ups, pause outgoing calling (partial updates allowed).
 */
adminRouter.put('/platform/switches', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const reason = reasonOf(req.body);
  if (!reason) {
    sendValidation(res, ['A reason (at least 3 characters) is required.']);
    return;
  }
  try {
    const result = await PlatformConfigService.updateSwitches(req.body?.switches ?? {}, { ...auditBase(req), reason });
    if (!result.ok) {
      sendValidation(res, result.errors);
      return;
    }
    res.status(200).json({ success: true, data: await PlatformConfigService.getAdminView() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update platform switches', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save the switches' });
  }
});

/**
 * PUT /api/v2/admin/platform/caps/:role
 * Per-role limits for granting minutes and discounts (admin, sales, support, finance).
 */
adminRouter.put('/platform/caps/:role', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const reason = reasonOf(req.body);
  if (!reason) {
    sendValidation(res, ['A reason (at least 3 characters) is required.']);
    return;
  }
  try {
    const result = await PlatformConfigService.updateRoleCaps(paramOf(req, 'role'), req.body?.caps ?? {}, { ...auditBase(req), reason });
    if (!result.ok) {
      sendValidation(res, result.errors);
      return;
    }
    res.status(200).json({ success: true, data: await PlatformConfigService.getAdminView() });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to update role caps', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save the caps' });
  }
});

/** Same request key = same action: answers a retry without doing it twice. */
async function alreadyDone(action: string, requestId: string): Promise<boolean> {
  return Boolean(await prisma.adminAuditLog.findFirst({ where: { action, requestId }, select: { id: true } }));
}

/**
 * POST /api/v2/admin/customers/:id/plan/assign
 * Gives a customer a plan without a payment (e.g. a goodwill upgrade): sets the plan tier and a
 * fresh validity window, and (optionally) adds the plan's minutes through the minutes ledger
 * (counted against the role's grant cap). The tier is set exactly (it can also lower a tier).
 */
adminRouter.post('/customers/:id/plan/assign', requireStaff('plans:assign'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body);
  const key = idempotencyKeyOf(req);
  const creditMinutes = req.body?.creditMinutes !== false;
  const rawDays = req.body?.validityDays;
  const validityDays = rawDays === undefined || rawDays === null || rawDays === '' ? null : Number(rawDays);

  if (!reason || typeof req.body?.planKey !== 'string' || (validityDays !== null && (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365))) {
    sendValidation(res, ['A plan, a reason, and (optional) validity of 1-365 days are required.']);
    return;
  }
  if (!key) {
    res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Missing request key. Reload the page and try again.' });
    return;
  }
  const requestId = `plan_assign:${key}`;

  try {
    const customer = await prisma.user.findUnique({ where: { id }, select: { id: true, accountType: true, planExpiresAt: true } });
    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    if (customer.accountType === 'admin') {
      res.status(409).json({ error: 'PLATFORM_ADMIN_ACCOUNT', message: 'This is a platform admin account (unlimited). It does not take customer plans.' });
      return;
    }
    if (await alreadyDone('plans:assign', requestId)) {
      res.status(200).json({ success: true, data: { idempotent: true } });
      return;
    }
    await PlatformConfigService.ensureLoaded();
    const plan = await resolveSellablePlan(req.body.planKey, id);
    if (!plan) {
      res.status(400).json({ error: 'PLAN_UNKNOWN', message: 'Unknown or inactive plan, or a custom plan made for another customer.' });
      return;
    }
    if (creditMinutes) {
      const capError = await validateGrantCap(req.staff!.role, req.staff!.id, plan.minutes);
      if (capError) {
        res.status(403).json({ error: 'OVER_ROLE_CAP', message: capError });
        return;
      }
    }
    const days = validityDays ?? plan.validityDays ?? PLAN_VALIDITY_DAYS;
    const expiresAt = new Date(Date.now() + days * 86400000);

    const result = await withAudit<Record<string, unknown>>(
      {
        ...auditBase(req),
        requestId,
        action: 'plans:assign',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason,
        isCustomerVisible: true,
        customerActionDescription: `${plan.name} plan activated by Claritiy Support${creditMinutes ? ` with ${plan.minutes} minutes` : ''}`,
      },
      async (tx) => {
        // Lock the customer row and re-check, so two identical requests cannot both apply.
        await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${id} FOR UPDATE`;
        const dup = await tx.adminAuditLog.findFirst({ where: { action: 'plans:assign', requestId }, select: { id: true } });
        if (dup) return { result: { idempotent: true } };
        let balanceSeconds: number | undefined;
        if (creditMinutes) {
          const credit = await MinutesService.credit({
            userId: id,
            deltaSeconds: plan.minutes * 60,
            reason: 'admin_grant',
            refType: 'plan_assignment',
            refId: plan.key,
            note: `${plan.name} plan assigned by support: ${reason}`.slice(0, 500),
            actorType: 'staff',
            actorId: req.staff!.id,
            idempotencyKey: requestId,
          }, tx);
          balanceSeconds = credit.balanceSeconds;
        }
        const heldNumbers = await tx.phoneNumber.count({ where: { userId: id } });
        await tx.user.update({
          where: { id },
          data: {
            accountType: plan.accountType,
            planExpiresAt: expiresAt,
            ...(heldNumbers === 0 ? { numberLocked: false } : {}),
          },
        });
        return {
          result: { planKey: plan.key, accountType: plan.accountType, planExpiresAt: expiresAt.toISOString(), minutesAdded: creditMinutes ? plan.minutes : 0, balanceSeconds },
          before: { accountType: customer.accountType, planExpiresAt: customer.planExpiresAt ? customer.planExpiresAt.toISOString() : null },
          after: { planKey: plan.key, accountType: plan.accountType, planExpiresAt: expiresAt.toISOString(), minutesAdded: creditMinutes ? plan.minutes : 0 },
        };
      }
    );
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to assign plan', { customerId: id, error: err.message });
    sendServiceError(res, err, 'Failed to assign the plan.');
  }
});

/**
 * POST /api/v2/admin/customers/:id/plan/extend
 * Moves the plan end date later by N days (from today if the plan has already ended).
 */
adminRouter.post('/customers/:id/plan/extend', requireStaff('plans:assign'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body);
  const key = idempotencyKeyOf(req);
  const days = Number(req.body?.days);
  if (!reason || !Number.isInteger(days) || days < 1 || days > 365) {
    sendValidation(res, ['Days (1-365) and a reason are required.']);
    return;
  }
  if (!key) {
    res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Missing request key. Reload the page and try again.' });
    return;
  }
  const requestId = `plan_extend:${key}`;
  try {
    const customer = await prisma.user.findUnique({ where: { id }, select: { id: true, planExpiresAt: true } });
    if (!customer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    if (await alreadyDone('plans:extend', requestId)) {
      res.status(200).json({ success: true, data: { idempotent: true } });
      return;
    }
    const result = await withAudit<Record<string, unknown>>(
      {
        ...auditBase(req),
        requestId,
        action: 'plans:extend',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason,
        isCustomerVisible: true,
        customerActionDescription: `Plan validity extended by ${days} day(s) by Claritiy Support`,
      },
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${id} FOR UPDATE`;
        if (await tx.adminAuditLog.findFirst({ where: { action: 'plans:extend', requestId }, select: { id: true } })) return { result: { idempotent: true } };
        const fresh = await tx.user.findUnique({ where: { id }, select: { planExpiresAt: true } });
        const base = Math.max(Date.now(), fresh?.planExpiresAt ? fresh.planExpiresAt.getTime() : 0);
        const next = new Date(base + days * 86400000);
        await tx.user.update({ where: { id }, data: { planExpiresAt: next } });
        return {
          result: { planExpiresAt: next.toISOString() },
          before: { planExpiresAt: fresh?.planExpiresAt ? fresh.planExpiresAt.toISOString() : null },
          after: { planExpiresAt: next.toISOString(), days },
        };
      }
    );
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to extend plan', { customerId: id, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to extend the plan.' });
  }
});

/**
 * GET /api/v2/admin/announcements — the latest 30 announcements shown in every customer's bell.
 */
adminRouter.get('/announcements', requireStaff('settings:manage'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.systemAlert.findMany({
      where: { userId: null, type: ANNOUNCEMENT_TYPE },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, message: true, metadata: true, createdAt: true, _count: { select: { receipts: true } } },
    });
    res.status(200).json({
      success: true,
      data: rows.map((r) => {
        let important = false;
        try { important = JSON.parse(r.metadata || '{}').isImportant === true; } catch { /* old rows */ }
        return { id: r.id, message: r.message, isImportant: important, createdAt: r.createdAt, readOrDismissedBy: r._count.receipts };
      }),
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list announcements', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load announcements' });
  }
});

/**
 * POST /api/v2/admin/announcements — posts a message to every customer's notification bell.
 */
adminRouter.post('/announcements', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const reason = reasonOf(req.body) || 'Announcement to all customers';
  if (!message || message.length > 2000) {
    sendValidation(res, ['The announcement must be 1-2,000 characters.']);
    return;
  }
  try {
    const created = await NotificationService.createInAppNotification({
      type: ANNOUNCEMENT_TYPE,
      title: 'Announcement',
      message,
      isImportant: req.body?.isImportant === true,
    });
    const createdId = (created as { id?: string } | null)?.id || 'announcement';
    await withAudit(
      { ...auditBase(req), action: 'announcements:create', targetType: 'SystemAlert', targetId: String(createdId), reason },
      async () => ({ result: null, after: { message, isImportant: req.body?.isImportant === true } })
    );
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to post announcement', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to post the announcement' });
  }
});

/**
 * POST /api/v2/admin/announcements/:id/delete — removes it from every customer's bell.
 */
adminRouter.post('/announcements/:id/delete', requireStaff('settings:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body) || 'Announcement removed';
  try {
    const row = await prisma.systemAlert.findFirst({ where: { id, userId: null, type: ANNOUNCEMENT_TYPE } });
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Announcement not found.' });
      return;
    }
    await withAudit(
      { ...auditBase(req), action: 'announcements:delete', targetType: 'SystemAlert', targetId: id, reason },
      async (tx) => {
        await tx.systemAlert.delete({ where: { id } });
        return { result: null, before: { message: row.message } };
      }
    );
    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to delete announcement', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete the announcement' });
  }
});

/**
 * POST /api/v2/admin/alerts/:id/resolve — marks an internal operations alert (e.g. failed
 * provisioning) as handled, so the Numbers page only lists open ones.
 */
adminRouter.post('/alerts/:id/resolve', requireStaff('numbers:activate'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const reason = reasonOf(req.body);
  if (!reason) {
    sendValidation(res, ['A reason (at least 3 characters) is required.']);
    return;
  }
  try {
    // Only internal alerts (no owner, not an announcement): customer notifications are not touched here.
    const row = await prisma.systemAlert.findFirst({ where: { id, userId: null, NOT: { type: ANNOUNCEMENT_TYPE } } });
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Alert not found.' });
      return;
    }
    await withAudit(
      { ...auditBase(req), action: 'alerts:resolve', targetType: 'SystemAlert', targetId: id, reason },
      async (tx) => {
        await tx.systemAlert.update({ where: { id }, data: { isResolved: true } });
        return { result: null, before: { isResolved: row.isResolved }, after: { isResolved: true } };
      }
    );
    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to resolve alert', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to resolve the alert' });
  }
});

/**
 * POST /api/v2/admin/calls/:id/recording-link
 * Owner only (call_content:view). Returns the same short-lived signed stream link customers get
 * (RecordingService.createPlaybackLink); the carrier address is never sent to the browser.
 * Every request is written to the admin audit log as a sensitive read.
 */
adminRouter.post('/calls/:id/recording-link', requireStaff('call_content:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const callId = paramOf(req);
  try {
    const callRow = await prisma.call.findUnique({ where: { id: callId }, select: { id: true, userId: true } });
    if (!callRow) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found.' });
      return;
    }
    const { createPlaybackLink } = await import('../services/RecordingService');
    const link = await createPlaybackLink(callRow.userId, callId);
    if (!link) {
      res.status(404).json({ error: 'NO_RECORDING', message: 'This call has no recording.' });
      return;
    }
    await logAdminRead({ ...auditBase(req), action: 'call_content:recording_play', targetType: 'Call', targetId: callId, customerId: callRow.userId, reason: reasonOf(req.body) || 'Recording played in the admin console' });
    res.status(200).json({ success: true, data: link });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create recording link', { callId, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not open the recording.' });
  }
});

// ─── Payments waiting for the owner's decision (no automatic refunds, owner rule 2026-11-23) ───

/**
 * GET /api/v2/admin/payment-issues
 * Open cases: a customer paid but did not get what they paid for. Each row has the payment (for the
 * one-click Refund button) and the customer.
 */
adminRouter.get('/payment-issues', requireStaff('payments:view'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.systemAlert.findMany({
      where: { userId: null, type: PAYMENT_REVIEW_TYPE, isResolved: false },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const metas = rows.map((r) => ({ row: r, meta: parseIssueMeta(r.metadata) }));
    const customerIds = Array.from(new Set(metas.map((m) => m.meta?.customerId).filter(Boolean) as string[]));
    const paymentIds = metas.map((m) => m.meta?.paymentId).filter(Boolean) as string[];
    const [customers, txs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, email: true, fullName: true, contactNumber: true } }),
      prisma.paymentTransaction.findMany({ where: { paymentId: { in: paymentIds } }, select: { id: true, paymentId: true, status: true, amount: true, planName: true } }),
    ]);
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const txMap = new Map(txs.map((t) => [t.paymentId, t]));
    res.status(200).json({
      success: true,
      data: metas.map(({ row, meta }) => ({
        id: row.id,
        createdAt: row.createdAt,
        reason: meta?.reason || row.message,
        source: meta?.source || null,
        amountInr: meta?.amountInr ?? null,
        paymentId: meta?.paymentId || null,
        orderId: meta?.orderId || null,
        customer: meta?.customerId ? customerMap.get(meta.customerId) || { id: meta.customerId } : null,
        payment: meta?.paymentId ? txMap.get(meta.paymentId) || null : null,
      })),
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list payment issues', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load payments waiting for a decision' });
  }
});

/**
 * POST /api/v2/admin/payment-issues/:id/close
 * Closes a case WITHOUT a refund (e.g. the number was set up by hand). To refund, use the Refund
 * button (POST /payments/:id/refund), which closes the case itself.
 */
const ISSUE_OUTCOMES = ['number_set_up', 'no_refund', 'other'];

adminRouter.post('/payment-issues/:id/close', requireStaff('refunds:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  const outcome = req.body?.outcome;
  const reason = reasonOf(req.body);
  if (!ISSUE_OUTCOMES.includes(outcome) || !reason) {
    sendValidation(res, [`An outcome (${ISSUE_OUTCOMES.join(', ')}) and a reason are required.`]);
    return;
  }
  try {
    const row = await prisma.systemAlert.findFirst({ where: { id, userId: null, type: PAYMENT_REVIEW_TYPE } });
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found.' });
      return;
    }
    if (row.isResolved) {
      res.status(409).json({ error: 'ALREADY_CLOSED', message: 'This case is already closed.' });
      return;
    }
    const meta = parseIssueMeta(row.metadata);
    await withAudit(
      { ...auditBase(req), action: 'payments:issue_closed', targetType: 'SystemAlert', targetId: id, customerId: meta?.customerId || null, reason },
      async (tx) => {
        await tx.systemAlert.update({ where: { id }, data: { isResolved: true } });
        return { result: null, before: { isResolved: false }, after: { isResolved: true, outcome, refunded: false, paymentId: meta?.paymentId || null } };
      }
    );
    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to close payment issue', { id, error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to close the case.' });
  }
});

// ─── KYC overview (owner request 2026-11-25) ───
// Read-only view of every customer's KYC, plus "re-check with the carrier now". There is NO manual
// approve: approval only ever comes from the carrier's own verification (CLAUDE.md B9).

const KYC_FILTERS: Record<string, any> = {
  all: { OR: [{ vobizSubAccount: { isNot: null } }, { plivoCompliance: { isNot: null } }, { kycDocuments: { some: {} } }] },
  pending: { vobizSubAccount: { is: { kycStatus: 'pending' } } },
  verified: { vobizSubAccount: { is: { kycStatus: 'verified' } } },
  failed: { vobizSubAccount: { is: { kycStatus: 'failed' } } },
  blocked: { vobizSubAccount: { is: { kycCallsBlocked: true } } },
  // Paying customers who have not started KYC with either carrier yet.
  not_started: { vobizSubAccount: { is: null }, plivoCompliance: { is: null }, accountType: { notIn: ['free', 'admin'] } },
};

/**
 * GET /api/v2/admin/kyc?status=&q=&page=&limit=
 */
adminRouter.get('/kyc', requireStaff('customers:view'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : 'all';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
  if (!KYC_FILTERS[status] || q.length > 200) {
    sendValidation(res, [`status must be one of: ${Object.keys(KYC_FILTERS).join(', ')}; search up to 200 characters.`]);
    return;
  }
  const where: any = { AND: [KYC_FILTERS[status]] };
  if (q) {
    where.AND.push({ OR: [{ email: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } }, { id: { equals: q } }] });
  }
  try {
    const [total, users, byStatus, blocked, notStarted] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (pageNum - 1) * take,
        take,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          email: true,
          fullName: true,
          accountType: true,
          planExpiresAt: true,
          vobizSubAccount: { select: { authId: true, kycMode: true, kycStatus: true, kycCallsBlocked: true, kycVerifiedAt: true, businessType: true, updatedAt: true } },
          plivoCompliance: { select: { status: true, businessName: true, rejectionReason: true, updatedAt: true } },
          kycDocuments: { select: { documentType: true, status: true, failureReason: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 10 },
          phoneNumbers: { select: { status: true, kycStatus: true } },
        },
      }),
      prisma.vobizSubAccount.groupBy({ by: ['kycStatus'], _count: { _all: true } }),
      prisma.vobizSubAccount.count({ where: { kycCallsBlocked: true } }),
      prisma.user.count({ where: KYC_FILTERS.not_started }),
    ]);
    res.status(200).json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        accountType: u.accountType,
        planExpiresAt: u.planExpiresAt,
        carrierKyc: u.vobizSubAccount
          ? {
            status: u.vobizSubAccount.kycStatus,
            callsBlocked: u.vobizSubAccount.kycCallsBlocked,
            mode: u.vobizSubAccount.kycMode,
            businessType: u.vobizSubAccount.businessType,
            verifiedAt: u.vobizSubAccount.kycVerifiedAt,
            lastCheckedAt: u.vobizSubAccount.updatedAt,
            simulated: u.vobizSubAccount.authId.startsWith('SA_MOCK_'),
          }
          : null,
        businessKyc: u.plivoCompliance,
        documents: u.kycDocuments,
        numbersWaitingOnKyc: u.phoneNumbers.filter((n) => n.kycStatus !== 'verified').length,
        numbersTotal: u.phoneNumbers.length,
      })),
      summary: {
        byStatus: Object.fromEntries(byStatus.map((g) => [g.kycStatus, g._count._all])),
        callsBlocked: blocked,
        notStarted,
      },
      pagination: { page: pageNum, limit: take, total, totalPages: Math.max(1, Math.ceil(total / take)) },
    });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list KYC', { error: err.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to load KYC' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/kyc/recheck
 * Asks the carrier for this customer's KYC result right now (the same check the 5-minute job and
 * the carrier webhook use). Never approves anything itself; when the carrier's answer changes the
 * status to verified/failed, the customer is told once.
 */
adminRouter.post('/customers/:id/kyc/recheck', requireStaff('kyc:recheck'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = paramOf(req);
  try {
    const sub = await prisma.vobizSubAccount.findUnique({ where: { userId: id }, select: { authId: true, kycStatus: true, kycCallsBlocked: true, kycMode: true } });
    if (!sub) {
      const exists = await customerExists(id);
      res.status(exists ? 409 : 404).json(exists
        ? { error: 'NO_CARRIER_KYC', message: 'This customer has no carrier KYC account yet (KYC not started, or they use the business-KYC carrier).' }
        : { error: 'NOT_FOUND', message: 'Customer not found.' });
      return;
    }
    if (sub.authId.startsWith('SA_MOCK_')) {
      res.status(409).json({ error: 'SIMULATED', message: 'This is a simulated (test) carrier account; there is nothing to check.' });
      return;
    }
    const { VobizSubAccountService } = await import('../services/VobizSubAccountService');
    // Fails closed: when the carrier does not answer, nothing stored changes.
    await new VobizSubAccountService().syncKycStatus(id);
    const after = await prisma.vobizSubAccount.findUnique({ where: { userId: id }, select: { kycStatus: true, kycCallsBlocked: true, kycMode: true, kycVerifiedAt: true } });
    const changed = Boolean(after && after.kycStatus !== sub.kycStatus);
    if (after && changed && (after.kycStatus === 'verified' || after.kycStatus === 'failed')) {
      const { notifyUserKycStatus } = await import('./kyc');
      await notifyUserKycStatus(id, after.kycStatus);
    }
    await withAudit(
      { ...auditBase(req), action: 'kyc:recheck', targetType: 'User', targetId: id, customerId: id, reason: reasonOf(req.body) || 'KYC re-checked with the carrier from the admin console' },
      async () => ({
        result: null,
        before: { kycStatus: sub.kycStatus, kycCallsBlocked: sub.kycCallsBlocked },
        after: { kycStatus: after?.kycStatus ?? null, kycCallsBlocked: after?.kycCallsBlocked ?? null, changed },
      })
    );
    res.status(200).json({ success: true, data: { before: sub.kycStatus, after: after?.kycStatus ?? sub.kycStatus, changed, callsBlocked: after?.kycCallsBlocked ?? sub.kycCallsBlocked, verifiedAt: after?.kycVerifiedAt ?? null } });
  } catch (err: any) {
    logger.error('[ADMIN_API] KYC re-check failed', { customerId: id, error: err.message });
    res.status(502).json({ error: 'CARRIER_UNAVAILABLE', message: 'The carrier did not answer. Nothing was changed; try again in a minute.' });
  }
});
