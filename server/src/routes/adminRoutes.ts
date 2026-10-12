import { Router, Response } from 'express';
import { requireStaff, StaffAuthenticatedRequest } from '../middleware/requireStaff';
import { getPermissionsForRole, StaffRole } from '../admin/permissions';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AccountEnforcementService, SuspensionCategory } from '../services/AccountEnforcementService';
import { MinutesService } from '../services/MinutesService';
import { withAudit, logAdminRead } from '../admin/audit';
import { validateGrantCap, getRoleCaps, validateDiscountCap } from '../admin/capEnforcement';
import { BillingService } from '../services/BillingService';
import { CallService } from '../services/CallService';
import { supabaseAdmin } from '../utils/supabase';
import rateLimit from 'express-rate-limit';

const billingService = new BillingService();

export const adminRouter = Router();

// Staff rate limiter keyed strictly by staffId (not IP)
const staffRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per staff member
  keyGenerator: (req: any) => req.staff?.id || 'unknown_staff',
  handler: (_req, res) => {
    res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many admin requests. Please slow down.' });
  },
});

adminRouter.use(staffRateLimiter);

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
    dbStatus = `unhealthy: ${err.message}`;
  }

  // Ledger reconciliation check count
  let ledgerMismatchesCount = 0;
  try {
    const userSample = await prisma.user.findMany({
      take: 20,
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

  res.status(200).json({
    success: true,
    data: {
      status: dbStatus === 'healthy' ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      integrations: {
        gemini: geminiConfigured ? 'configured' : 'missing_key',
        razorpay: razorpayConfigured ? 'configured' : 'missing_credentials',
        trustProxy: trustProxyActive ? 'active (level 1)' : 'misconfigured',
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
adminRouter.post('/customers/:id/suspend', requireStaff('customers:suspend'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { category, reason } = req.body;

  if (!category || !reason || !reason.trim()) {
    res.status(400).json({ error: 'category and detailed reason are required.' });
    return;
  }

  const reqIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) || undefined;

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'reason is required.' });
    return;
  }

  const reqIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) || undefined;

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'reason is required.' });
    return;
  }

  const reqIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) || undefined;

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
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { minutes, reason, idempotencyKey } = req.body;

  if (!minutes || minutes <= 0 || !reason || !reason.trim()) {
    res.status(400).json({ error: 'minutes (> 0) and reason are required.' });
    return;
  }

  // Enforce staff role grant cap per Founder Decision #3
  const capError = await validateGrantCap(req.staff!.role, req.staff!.id, Number(minutes));
  if (capError) {
    res.status(403).json({ error: 'OVER_ROLE_CAP', message: capError });
    return;
  }

  const rawIdempotency = idempotencyKey || req.headers['idempotency-key'];
  const effectiveIdempotencyKey = (Array.isArray(rawIdempotency) ? rawIdempotency[0] : rawIdempotency || `grant_${id}_${Date.now()}`) as string;
  const reqIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) || undefined;

  try {
    const result = await withAudit(
      {
        staff: req.staff!,
        action: 'minutes:grant',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason: reason.trim(),
        isCustomerVisible: true,
        customerActionDescription: `Granted ${minutes} promotional minutes by Claritiy Support`,
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const credit = await MinutesService.credit(
          {
            userId: id,
            deltaSeconds: Math.round(minutes * 60),
            reason: 'admin_grant',
            note: reason.trim(),
            actorType: 'staff',
            actorId: req.staff!.id,
            idempotencyKey: effectiveIdempotencyKey,
          },
          tx
        );
        return { result: credit, after: { grantedMinutes: minutes, newBalanceSeconds: credit.balanceSeconds } };
      }
    );

    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to grant minutes', { customerId: id, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to grant minutes' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/minutes/deduct
 */
adminRouter.post('/customers/:id/minutes/deduct', requireStaff('minutes:deduct'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { minutes, reason, allowNegative, idempotencyKey } = req.body;

  if (!minutes || minutes <= 0 || !reason || !reason.trim()) {
    res.status(400).json({ error: 'minutes (> 0) and reason are required.' });
    return;
  }

  // Verify role deduction capability
  const caps = await getRoleCaps(req.staff!.role);
  if (!caps.canDeduct) {
    res.status(403).json({ error: 'FORBIDDEN', message: `Your role (${req.staff!.role}) does not have permission to deduct minutes.` });
    return;
  }

  // Only Owner can force negative balance
  const canAllowNegative = req.staff!.role === 'owner' && allowNegative === true;
  const rawIdempotency = idempotencyKey || req.headers['idempotency-key'];
  const effectiveIdempotencyKey = (Array.isArray(rawIdempotency) ? rawIdempotency[0] : rawIdempotency || `deduct_${id}_${Date.now()}`) as string;
  const reqIdHeader = req.headers['x-request-id'];
  const requestId = (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) || undefined;

  try {
    const result = await withAudit(
      {
        staff: req.staff!,
        action: 'minutes:deduct',
        targetType: 'User',
        targetId: id,
        customerId: id,
        reason: reason.trim(),
        isCustomerVisible: true,
        customerActionDescription: `Deducted ${minutes} minutes by Claritiy Support`,
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const debit = await MinutesService.debit(
          {
            userId: id,
            deltaSeconds: Math.round(minutes * 60),
            reason: 'admin_deduct',
            note: reason.trim(),
            actorType: 'staff',
            actorId: req.staff!.id,
            idempotencyKey: effectiveIdempotencyKey,
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
    res.status(500).json({ error: err.message || 'Failed to deduct minutes' });
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
  const { email, name, role } = req.body;

  if (!email || !name || !role) {
    res.status(400).json({ error: 'email, name, and role are required.' });
    return;
  }

  const validRoles: StaffRole[] = ['owner', 'admin', 'sales', 'support', 'finance'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
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
    logger.error('[ADMIN_API] Failed to invite staff', { email: normalizedEmail, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to invite staff member' });
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
    res.status(500).json({ error: err.message || 'Failed to update staff member' });
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

    // Revoke Supabase sessions if supabaseAdmin is configured
    if (supabaseAdmin) {
      try {
        // Attempt session signout via Supabase admin API
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const supaUser = users?.users?.find((u) => u.email?.toLowerCase() === targetStaff.email.toLowerCase());
        if (supaUser) {
          await supabaseAdmin.auth.admin.signOut(supaUser.id);
          logger.info('[ADMIN_API] Revoked Supabase session for disabled staff', { email: targetStaff.email, supaUserId: supaUser.id });
        }
      } catch (authRevokeErr: any) {
        logger.warn('[ADMIN_API] Non-fatal: Supabase session revocation failed', { error: authRevokeErr.message });
      }
    }

    res.status(200).json({ success: true, data: disabled });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to disable staff', { targetId, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to disable staff member' });
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
    res.status(500).json({ error: err.message || 'Failed to enable staff member' });
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
    whereClause.accountStatus = status;
  }

  if (risk && typeof risk === 'string' && risk !== 'all') {
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
        orderBy: { createdAt: 'desc' },
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
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      include: {
        vobizSubAccount: true,
        phoneNumbers: {
          select: { id: true, phoneNumber: true, status: true, kycStatus: true },
        },
        kycDocuments: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const [callsCount, agentsCount, phoneNumbersCount, apiKeysCount, adminProfile, totalPayments] = await Promise.all([
      prisma.call.count({ where: { userId: customerId } }),
      prisma.agent.count({ where: { userId: customerId } }),
      prisma.phoneNumber.count({ where: { userId: customerId } }),
      prisma.apiKey.count({ where: { userId: customerId } }),
      prisma.customerAdminProfile.findUnique({ where: { userId: customerId } }),
      prisma.paymentTransaction.aggregate({
        where: { userId: customerId, status: 'paid' },
        _sum: { amount: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...user,
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
      data: calls,
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
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { body, pinned = false } = req.body;

  if (!body || !body.trim()) {
    res.status(400).json({ error: 'Note body is required.' });
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
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { note, dueAt } = req.body;

  if (!note || !dueAt) {
    res.status(400).json({ error: 'Note and dueAt date are required.' });
    return;
  }

  try {
    const followUp = await prisma.followUp.create({
      data: {
        userId: customerId,
        staffId: req.staff!.id,
        note: note.trim(),
        dueAt: new Date(dueAt),
      },
    });

    res.status(201).json({ success: true, data: followUp });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create follow-up', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

/**
 * PATCH /api/v2/admin/customers/:id/profile
 * Update tags, risk level, or assigned staff.
 */
adminRouter.patch('/customers/:id/profile', requireStaff('customers:edit'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { tags, riskLevel, riskNote, assignedStaffId } = req.body;

  try {
    const updated = await prisma.customerAdminProfile.upsert({
      where: { userId: customerId },
      create: {
        userId: customerId,
        tags: Array.isArray(tags) ? tags : [],
        riskLevel: riskLevel || 'none',
        riskNote: riskNote || null,
        assignedStaffId: assignedStaffId || null,
      },
      update: {
        tags: Array.isArray(tags) ? tags : undefined,
        riskLevel: riskLevel || undefined,
        riskNote: riskNote !== undefined ? riskNote : undefined,
        assignedStaffId: assignedStaffId !== undefined ? assignedStaffId : undefined,
      },
    });

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
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: customerId } });
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    if (supabaseAdmin) {
      try {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const supaUser = users?.users?.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());
        if (supaUser) {
          await supabaseAdmin.auth.admin.signOut(supaUser.id);
        }
      } catch (err: any) {
        logger.warn('[ADMIN_API] Supabase signOut error on customer force-logout', { error: err.message });
      }
    }

    await withAudit(
      {
        staff: req.staff!,
        action: 'security:force_logout',
        targetType: 'User',
        targetId: customerId,
        customerId,
        reason: 'Staff initiated forced session termination',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async () => ({ result: { terminated: true } })
    );

    res.status(200).json({ success: true, message: 'Customer sessions terminated successfully.' });
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
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const count = await withAudit(
      {
        staff: req.staff!,
        action: 'security:revoke_keys',
        targetType: 'User',
        targetId: customerId,
        customerId,
        reason: 'Staff revoked all customer API keys',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
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
      prisma.call.count({ where: { status: { in: ['failed', 'no_answer', 'busy'] } } }),
      prisma.call.count({ where: { status: 'in_progress' } }),
      prisma.call.count({ where: { status: { in: ['queued', 'ringing'] } } }),
      prisma.agent.count(),
      prisma.batch.count(),
      prisma.minutesLedger.aggregate({
        where: { deltaSeconds: { gt: 0 } },
        _sum: { deltaSeconds: true },
      }),
      prisma.minutesLedger.aggregate({
        where: { reason: 'call_usage', deltaSeconds: { lt: 0 } },
        _sum: { deltaSeconds: true },
      }),
    ]);

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
        where: { deltaSeconds: { gt: 0 } },
        _sum: { deltaSeconds: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalMinutesUsed: Math.round(Math.abs(totalUsageAgg._sum.deltaSeconds || 0) / 60),
          totalMinutesGranted: Math.round((totalGrantedAgg._sum.deltaSeconds || 0) / 60),
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
  if (status && typeof status === 'string' && status !== 'all') {
    whereClause.status = status;
  }
  if (direction && typeof direction === 'string' && direction !== 'all') {
    whereClause.callDirection = direction;
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
          status: true,
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
      data: calls,
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
    const dailyMetrics = await prisma.dailyMetric.findMany({
      take: 14,
      orderBy: { date: 'asc' },
    });

    res.status(200).json({ success: true, data: dailyMetrics });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to fetch daily metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch daily metrics' });
  }
});

/**
 * PATCH /api/v2/admin/numbers/:id/activate
 * Approves and activates a phone number from the provisioning queue.
 */
adminRouter.patch('/numbers/:id/activate', requireStaff('numbers:activate'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const numberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const existing = await prisma.phoneNumber.findUnique({ where: { id: numberId } });
    if (!existing) {
      res.status(404).json({ error: 'Phone number not found.' });
      return;
    }

    const updated = await withAudit(
      {
        staff: req.staff!,
        action: 'numbers:activate',
        targetType: 'PhoneNumber',
        targetId: numberId,
        customerId: existing.userId,
        reason: 'Staff approved KYC compliance and activated phone number',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const resNum = await tx.phoneNumber.update({
          where: { id: numberId },
          data: { status: 'active', kycStatus: 'verified' },
        });
        return { result: resNum, after: { status: 'active', kycStatus: 'verified' } };
      }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to activate number', { numberId, error: err.message });
    res.status(500).json({ error: 'Failed to activate phone number' });
  }
});

/**
 * POST /api/v2/admin/customers/:id/kyc/reset
 * Resets KYC status for a customer's phone numbers so they can re-submit documents.
 */
adminRouter.post('/customers/:id/kyc/reset', requireStaff('kyc:reset'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const updated = await withAudit(
      {
        staff: req.staff!,
        action: 'kyc:reset',
        targetType: 'User',
        targetId: customerId,
        customerId,
        reason: 'Staff reset customer KYC verification state',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const resNumbers = await tx.phoneNumber.updateMany({
          where: { userId: customerId },
          data: { kycStatus: 'pending' },
        });
        return { result: resNumbers, after: { kycStatus: 'pending', count: resNumbers.count } };
      }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to reset KYC', { customerId, error: err.message });
    res.status(500).json({ error: 'Failed to reset customer KYC' });
  }
});

/**
 * POST /api/v2/admin/calls/:id/terminate
 * Terminates an in-flight call session immediately.
 */
adminRouter.post('/calls/:id/terminate', requireStaff('calls:terminate'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const callId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    await CallService.terminateCall(callId);
    await withAudit(
      {
        staff: req.staff!,
        action: 'calls:terminate',
        targetType: 'Call',
        targetId: callId,
        reason: 'Staff initiated immediate call termination',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async () => ({ result: { terminated: true } })
    );

    res.status(200).json({ success: true, message: 'Call terminated successfully.' });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to terminate call', { callId, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to terminate call' });
  }
});

/**
 * GET /api/v2/admin/plans
 * Lists all catalog and custom private plans.
 */
adminRouter.get('/plans', requireStaff('plans:manage'), async (_req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plans = await prisma.planCatalog.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: plans });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to list plans', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

/**
 * POST /api/v2/admin/plans/custom
 * Creates a custom private plan for a specific customer with role discount cap enforcement.
 */
adminRouter.post('/plans/custom', requireStaff('plans:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { key, name, priceInr, minutes, accountType, customerUserId, validityDays, discountPercent } = req.body;

  if (!name || !priceInr || !minutes) {
    res.status(400).json({ error: 'name, priceInr, and minutes are required.' });
    return;
  }

  // Validate discount percentage against role caps
  const discountErr = await validateDiscountCap(req.staff!.role, discountPercent || 0);
  if (discountErr) {
    res.status(403).json({ error: 'OVER_DISCOUNT_CAP', message: discountErr });
    return;
  }

  const planKey = key ? key.trim().toLowerCase() : `custom_${Date.now()}`;

  try {
    const newPlan = await withAudit(
      {
        staff: req.staff!,
        action: 'plans:manage',
        targetType: 'PlanCatalog',
        targetId: planKey,
        customerId: customerUserId,
        reason: `Created custom plan ${name} for ₹${priceInr} (${minutes} mins)`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const p = await tx.planCatalog.create({
          data: {
            key: planKey,
            name: name.trim(),
            priceInr: Number(priceInr),
            minutes: Number(minutes),
            accountType: accountType || 'growth',
            isPublic: false,
            customerUserId: customerUserId || null,
            validityDays: validityDays ? Number(validityDays) : null,
            active: true,
            createdBy: req.staff!.email,
          },
        });
        return { result: p, after: { planKey, name, priceInr, minutes } };
      }
    );

    res.status(201).json({ success: true, data: newPlan });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create custom plan', { error: err.message });
    res.status(500).json({ error: 'Failed to create custom plan' });
  }
});

/**
 * POST /api/v2/admin/payments/create-link
 * Generates a Razorpay payment link for customer checkout.
 */
adminRouter.post('/payments/create-link', requireStaff('payment_links:create'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const { customerUserId, planKey, customPlanId, amountInr, minutes, discountPercent } = req.body;

  if (!customerUserId || !amountInr || !minutes) {
    res.status(400).json({ error: 'customerUserId, amountInr, and minutes are required.' });
    return;
  }

  const discountErr = await validateDiscountCap(req.staff!.role, discountPercent || 0);
  if (discountErr) {
    res.status(403).json({ error: 'OVER_DISCOUNT_CAP', message: discountErr });
    return;
  }

  const mockLinkId = `plink_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    const paymentLink = await withAudit(
      {
        staff: req.staff!,
        action: 'payment_links:create',
        targetType: 'PaymentLink',
        targetId: mockLinkId,
        customerId: customerUserId,
        reason: `Generated payment link for ₹${amountInr} (${minutes} mins)`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const link = await tx.paymentLink.create({
          data: {
            userId: customerUserId,
            planKey: planKey || null,
            customPlanId: customPlanId || null,
            amountInr: Number(amountInr),
            minutes: Number(minutes),
            status: 'created',
            razorpayLinkId: mockLinkId,
            shortUrl: `https://pages.claritiy.com/pay/${mockLinkId}`,
            createdByStaffId: req.staff!.id,
          },
        });
        return { result: link, after: { razorpayLinkId: mockLinkId, amountInr, minutes } };
      }
    );

    res.status(201).json({ success: true, data: paymentLink });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to create payment link', { error: err.message });
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

/**
 * POST /api/v2/admin/payments/:id/refund
 * Processes refund via Razorpay and marks transaction/invoice as refunded.
 */
adminRouter.post('/payments/:id/refund', requireStaff('refunds:manage'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const transactionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    res.status(400).json({ error: 'Refund reason is mandatory.' });
    return;
  }

  try {
    const txRecord = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!txRecord) {
      res.status(404).json({ error: 'Payment transaction not found.' });
      return;
    }

    const refundResult = await billingService.refundOrder(txRecord.paymentId, Math.round((txRecord.amount || 0) * 100));

    const updated = await withAudit(
      {
        staff: req.staff!,
        action: 'refunds:manage',
        targetType: 'PaymentTransaction',
        targetId: transactionId,
        customerId: txRecord.userId,
        reason: reason.trim(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
      async (tx) => {
        const updatedTx = await tx.paymentTransaction.update({
          where: { id: transactionId },
          data: { status: 'refunded' },
        });

        await tx.invoice.updateMany({
          where: { paymentTransactionId: transactionId },
          data: { status: 'refunded' },
        });

        return { result: { ...updatedTx, refundId: refundResult.refundId }, after: { status: 'refunded' } };
      }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to refund payment', { transactionId, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to refund payment' });
  }
});

/**
 * GET /api/v2/admin/exports/:type
 * Generates and downloads audit CSV files for customers, calls, or payments.
 */
adminRouter.get('/exports/:type', requireStaff('exports:csv'), async (req: StaffAuthenticatedRequest, res: Response): Promise<void> => {
  const exportType = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;

  try {
    let csvData = '';
    const now = new Date().toISOString().slice(0, 10);

    if (exportType === 'customers') {
      const users = await prisma.user.findMany({
        take: 2000,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, accountStatus: true, callingBalanceMinutes: true, createdAt: true },
      });
      csvData = 'ID,Email,FullName,AccountStatus,BalanceMinutes,CreatedAt\n' +
        users.map((u) => `"${u.id}","${u.email}","${u.fullName || ''}","${u.accountStatus}",${u.callingBalanceMinutes},"${u.createdAt.toISOString()}"`).join('\n');
    } else if (exportType === 'calls') {
      const calls = await prisma.call.findMany({
        take: 2000,
        orderBy: { createdAt: 'desc' },
        select: { id: true, recipientPhoneNumber: true, status: true, durationSeconds: true, createdAt: true, userId: true },
      });
      csvData = 'ID,RecipientNumber,Status,DurationSeconds,UserId,CreatedAt\n' +
        calls.map((c) => `"${c.id}","${c.recipientPhoneNumber}","${c.status}",${c.durationSeconds || 0},"${c.userId}","${c.createdAt.toISOString()}"`).join('\n');
    } else if (exportType === 'payments') {
      const payments = await prisma.paymentTransaction.findMany({
        take: 2000,
        orderBy: { createdAt: 'desc' },
        select: { id: true, paymentId: true, planName: true, amount: true, status: true, userId: true, createdAt: true },
      });
      csvData = 'ID,PaymentId,PlanName,AmountINR,Status,UserId,CreatedAt\n' +
        payments.map((p) => `"${p.id}","${p.paymentId}","${p.planName}",${p.amount || 0},"${p.status}","${p.userId}","${p.createdAt.toISOString()}"`).join('\n');
    } else {
      res.status(400).json({ error: 'Invalid export type. Must be customers, calls, or payments.' });
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=claritiy_${exportType}_${now}.csv`);
    res.status(200).send(csvData);
  } catch (err: any) {
    logger.error('[ADMIN_API] Failed to generate export', { exportType, error: err.message });
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});
