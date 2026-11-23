/**
 * Platform settings the owner changes from the admin panel instead of the code
 * (fix/admin-panel, owner request 2026-11-23):
 *
 *  - plans:     price, minutes, concurrent calls, knowledge-base and calendar limits, "can be bought"
 *               for each built-in plan (PLAN_CONFIG). Overrides only: "reset" returns to the values
 *               in config/plans.ts (DEFAULT_PLAN_CONFIG).
 *  - switches:  maintenance banner, pause new sign-ups, pause all outbound calling (calls,
 *               campaigns, scheduled calls) in an emergency.
 *  - role caps: per-role minute-grant and discount limits (admin/capEnforcement reads caps_<role>).
 *
 * Storage: admin_settings rows (no schema change). Every change goes through withAudit (immutable
 * admin audit log with before/after and the reason).
 *
 * Reading is synchronous for the hot paths (getPlanConfig, getPlanConcurrency, ...): overrides are
 * applied IN PLACE to the PLAN_CONFIG objects, refreshed from the database every 30 seconds and
 * immediately after a change on this instance. Paths that create money or calls first await
 * ensureLoaded(), so a restart never serves code defaults while a stored override exists.
 *
 * What a customer pays and gets is fixed when the checkout order is created (the order notes carry
 * the price and minutes, see BillingService), so a price edit never breaks a payment in progress.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { PLAN_CONFIG, DEFAULT_PLAN_CONFIG, PlanDetails, KbPlanLimits, CalendarPlanLimits } from '../config/plans';
import { withAudit } from '../admin/audit';
import type { StaffContext } from '../middleware/requireStaff';
import { DEFAULT_CAPS, RoleCaps } from '../admin/capEnforcement';

export const PLANS_SETTING_KEY = 'platform.plans';
export const SWITCHES_SETTING_KEY = 'platform.switches';
const REFRESH_MS = 30_000;
const FIRST_LOAD_WAIT_MS = 3_000;

export type BannerLevel = 'info' | 'warning' | 'critical';

export interface PlatformSwitches {
  maintenanceBanner: { enabled: boolean; message: string; level: BannerLevel };
  signupsPaused: boolean;
  signupsPausedMessage: string;
  outboundCallingPaused: boolean;
  outboundPausedMessage: string;
}

export interface PlanOverride {
  price: number;
  minutes: number;
  maxConcurrentCalls: number;
  purchasable: boolean;
  kbLimits: KbPlanLimits;
  calendarLimits: CalendarPlanLimits;
}

export const DEFAULT_SWITCHES: Readonly<PlatformSwitches> = Object.freeze({
  maintenanceBanner: { enabled: false, message: '', level: 'info' as BannerLevel },
  signupsPaused: false,
  signupsPausedMessage: 'New sign-ups are paused for a short while. Please try again later or write to support@claritiy.com.',
  outboundCallingPaused: false,
  outboundPausedMessage: 'Outgoing calls are paused for maintenance. Please try again shortly.',
});

export const PLATFORM_PAUSE_PREFIX = 'Paused by Claritiy: outgoing calling is temporarily paused';

// ─── Validation ──────────────────────────────────────────────────────────────

type Bound = [min: number, max: number];
const PLAN_BOUNDS: Record<'price' | 'minutes' | 'maxConcurrentCalls', Bound> = {
  price: [1, 10_000_000],
  minutes: [1, 1_000_000],
  maxConcurrentCalls: [1, 100],
};
const KB_BOUNDS: Record<keyof KbPlanLimits, Bound> = {
  maxDocuments: [1, 100_000],
  maxStorageMb: [1, 1_000_000],
  maxFileSizeMb: [1, 500],
  maxChunksPerWorkspace: [10, 10_000_000],
  maxKbAttachedPerAgent: [1, 1_000],
};
const CALENDAR_BOUNDS: Record<keyof CalendarPlanLimits, Bound> = {
  maxCalendarsPerWorkspace: [1, 1_000],
  maxBookingsPerMonth: [1, 10_000_000],
  apiCallsPerMinute: [1, 10_000],
};

function wholeIn(v: unknown, [min, max]: Bound): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/**
 * Checks a full plan definition coming from the panel. Missing fields keep the current live value.
 */
export function validatePlanInput(key: string, input: any): ValidationResult<PlanOverride> {
  const live = PLAN_CONFIG[key];
  if (!live) return { ok: false, errors: [`Unknown plan "${key}".`] };
  const src = input && typeof input === 'object' ? input : {};
  const errors: string[] = [];
  const pick = (name: keyof typeof PLAN_BOUNDS) => {
    if (src[name] === undefined) return live[name] as number;
    const v = wholeIn(src[name], PLAN_BOUNDS[name]);
    if (v === null) errors.push(`${name} must be a whole number from ${PLAN_BOUNDS[name][0].toLocaleString('en-IN')} to ${PLAN_BOUNDS[name][1].toLocaleString('en-IN')}.`);
    return v ?? 0;
  };
  const group = <T extends object>(name: 'kbLimits' | 'calendarLimits', bounds: Record<string, Bound>, current: T): T => {
    const given = src[name] && typeof src[name] === 'object' ? src[name] : {};
    const out: Record<string, number> = {};
    for (const [field, b] of Object.entries(bounds)) {
      if (given[field] === undefined) { out[field] = (current as any)[field]; continue; }
      const v = wholeIn(given[field], b);
      if (v === null) errors.push(`${name}.${field} must be a whole number from ${b[0].toLocaleString('en-IN')} to ${b[1].toLocaleString('en-IN')}.`);
      out[field] = v ?? 0;
    }
    return out as T;
  };
  const value: PlanOverride = {
    price: pick('price'),
    minutes: pick('minutes'),
    maxConcurrentCalls: pick('maxConcurrentCalls'),
    purchasable: src.purchasable === undefined ? live.purchasable !== false : src.purchasable,
    kbLimits: group<KbPlanLimits>('kbLimits', KB_BOUNDS, live.kbLimits),
    calendarLimits: group<CalendarPlanLimits>('calendarLimits', CALENDAR_BOUNDS, live.calendarLimits),
  };
  if (typeof value.purchasable !== 'boolean') errors.push('purchasable must be true or false.');
  if (value.kbLimits.maxFileSizeMb > value.kbLimits.maxStorageMb) errors.push('kbLimits.maxFileSizeMb cannot be larger than kbLimits.maxStorageMb.');
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

const LEVELS: BannerLevel[] = ['info', 'warning', 'critical'];

/** Merges a partial change into the current switches; text is trimmed and length-limited. */
export function validateSwitchesInput(input: any, current: PlatformSwitches): ValidationResult<PlatformSwitches> {
  const src = input && typeof input === 'object' ? input : {};
  const errors: string[] = [];
  const next: PlatformSwitches = JSON.parse(JSON.stringify(current));
  const bool = (name: 'signupsPaused' | 'outboundCallingPaused') => {
    if (src[name] === undefined) return;
    if (typeof src[name] !== 'boolean') errors.push(`${name} must be true or false.`);
    else next[name] = src[name];
  };
  const text = (name: 'signupsPausedMessage' | 'outboundPausedMessage', max: number) => {
    if (src[name] === undefined) return;
    if (typeof src[name] !== 'string' || !src[name].trim() || src[name].length > max) errors.push(`${name} must be 1-${max} characters.`);
    else next[name] = src[name].trim();
  };
  bool('signupsPaused');
  bool('outboundCallingPaused');
  text('signupsPausedMessage', 300);
  text('outboundPausedMessage', 300);
  if (src.maintenanceBanner !== undefined) {
    const b = src.maintenanceBanner;
    if (!b || typeof b !== 'object') errors.push('maintenanceBanner must be an object.');
    else {
      if (b.enabled !== undefined) {
        if (typeof b.enabled !== 'boolean') errors.push('maintenanceBanner.enabled must be true or false.');
        else next.maintenanceBanner.enabled = b.enabled;
      }
      if (b.message !== undefined) {
        if (typeof b.message !== 'string' || b.message.length > 300) errors.push('maintenanceBanner.message must be up to 300 characters.');
        else next.maintenanceBanner.message = b.message.trim();
      }
      if (b.level !== undefined) {
        if (!LEVELS.includes(b.level)) errors.push(`maintenanceBanner.level must be one of: ${LEVELS.join(', ')}.`);
        else next.maintenanceBanner.level = b.level;
      }
    }
  }
  if (next.maintenanceBanner.enabled && !next.maintenanceBanner.message) errors.push('A banner needs a message before it can be switched on.');
  return errors.length ? { ok: false, errors } : { ok: true, value: next };
}

/** Caps for one non-owner role. Owner caps are fixed (unlimited). */
export function validateCapsInput(role: string, input: any): ValidationResult<RoleCaps> {
  if (!['admin', 'sales', 'support', 'finance'].includes(role)) {
    return { ok: false, errors: ['Caps can be set for admin, sales, support and finance (the owner is always unlimited).'] };
  }
  const src = input && typeof input === 'object' ? input : {};
  const errors: string[] = [];
  const perGrant = wholeIn(src.maxMinutesPerGrant, [0, 100_000]);
  const perDay = wholeIn(src.maxMinutesPerDay, [0, 1_000_000]);
  const discount = wholeIn(src.maxDiscountPercent, [0, 100]);
  if (perGrant === null) errors.push('maxMinutesPerGrant must be a whole number from 0 to 1,00,000.');
  if (perDay === null) errors.push('maxMinutesPerDay must be a whole number from 0 to 10,00,000.');
  if (discount === null) errors.push('maxDiscountPercent must be a whole number from 0 to 100.');
  if (typeof src.canGrant !== 'boolean' || typeof src.canDeduct !== 'boolean') errors.push('canGrant and canDeduct must be true or false.');
  if (perGrant !== null && perDay !== null && perGrant > perDay) errors.push('The per-action cap cannot be larger than the daily cap.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { maxMinutesPerGrant: perGrant!, maxMinutesPerDay: perDay!, maxDiscountPercent: discount!, canGrant: src.canGrant, canDeduct: src.canDeduct } };
}

// ─── Live state ──────────────────────────────────────────────────────────────

let planOverrides: Record<string, PlanOverride> = {};
let switches: PlatformSwitches = JSON.parse(JSON.stringify(DEFAULT_SWITCHES));
let loadedOnce = false;
let firstLoad: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;
let lastRefreshAt: Date | null = null;
let lastRefreshError: string | null = null;

/** Applies overrides to the live PLAN_CONFIG objects (same objects, so identity checks still hold). */
function applyPlans(overrides: Record<string, PlanOverride>): void {
  for (const [key, plan] of Object.entries(PLAN_CONFIG)) {
    const def = DEFAULT_PLAN_CONFIG[key];
    if (!def) continue;
    const o = overrides[key];
    plan.price = o ? o.price : def.price;
    plan.minutes = o ? o.minutes : def.minutes;
    plan.maxConcurrentCalls = o ? o.maxConcurrentCalls : def.maxConcurrentCalls;
    plan.purchasable = o ? o.purchasable : def.purchasable !== false;
    plan.kbLimits = { ...def.kbLimits, ...(o ? o.kbLimits : {}) };
    plan.calendarLimits = { ...def.calendarLimits, ...(o ? o.calendarLimits : {}) };
  }
}

/** Stored rows are re-validated on load; a bad stored entry is ignored (logged), never applied. */
function parseStoredPlans(raw: unknown): Record<string, PlanOverride> {
  const out: Record<string, PlanOverride> = {};
  if (!raw || typeof raw !== 'object') return out;
  const saved = (raw as any).overrides && typeof (raw as any).overrides === 'object' ? (raw as any).overrides : {};
  for (const [key, val] of Object.entries(saved)) {
    if (!DEFAULT_PLAN_CONFIG[key]) continue;
    // Validate against the defaults (not the live values) so a stored partial cannot inherit junk.
    const base = DEFAULT_PLAN_CONFIG[key];
    const merged = {
      price: base.price, minutes: base.minutes, maxConcurrentCalls: base.maxConcurrentCalls, purchasable: true,
      ...(val as object),
      kbLimits: { ...base.kbLimits, ...((val as any)?.kbLimits || {}) },
      calendarLimits: { ...base.calendarLimits, ...((val as any)?.calendarLimits || {}) },
    };
    // Every field is present in `merged`, so nothing is taken from the live values.
    const res = validatePlanInput(key, merged);
    if (res.ok) out[key] = res.value;
    else logger.error('[PLATFORM_CONFIG] Ignoring an invalid stored plan override', { key, errors: res.errors });
  }
  return out;
}

function parseStoredSwitches(raw: unknown): PlatformSwitches {
  const base: PlatformSwitches = JSON.parse(JSON.stringify(DEFAULT_SWITCHES));
  if (!raw || typeof raw !== 'object') return base;
  const res = validateSwitchesInput(raw, base);
  if (res.ok) return res.value;
  logger.error('[PLATFORM_CONFIG] Ignoring invalid stored switches', { errors: res.errors });
  return base;
}

export class PlatformConfigService {
  /** Re-reads the stored settings and applies them. Never throws (keeps the last good state). */
  static async refresh(): Promise<void> {
    try {
      const rows = await prisma.adminSetting.findMany({ where: { key: { in: [PLANS_SETTING_KEY, SWITCHES_SETTING_KEY] } } });
      const byKey = new Map(rows.map((r) => [r.key, r.value]));
      planOverrides = parseStoredPlans(byKey.get(PLANS_SETTING_KEY));
      switches = parseStoredSwitches(byKey.get(SWITCHES_SETTING_KEY));
      applyPlans(planOverrides);
      loadedOnce = true;
      lastRefreshAt = new Date();
      lastRefreshError = null;
    } catch (err: any) {
      lastRefreshError = String(err?.message || err).slice(0, 200);
      logger.error('[PLATFORM_CONFIG] Could not load platform settings; keeping the last known values', { error: lastRefreshError });
    }
  }

  /**
   * Waits (at most 3 s) for the first load after a restart. Used before creating an order, placing a
   * call or creating an account, so a stored pause or price is honoured from the first request.
   */
  static async ensureLoaded(): Promise<void> {
    if (loadedOnce) return;
    if (!firstLoad) firstLoad = PlatformConfigService.refresh().finally(() => { firstLoad = null; });
    await Promise.race([firstLoad, new Promise((r) => setTimeout(r, FIRST_LOAD_WAIT_MS).unref?.())]);
  }

  /** Called once at boot (after the server listens). */
  static startAutoRefresh(): void {
    if (timer) return;
    void PlatformConfigService.refresh();
    timer = setInterval(() => { void PlatformConfigService.refresh(); }, REFRESH_MS);
    timer.unref?.();
  }

  static stopAutoRefresh(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  static getSwitches(): PlatformSwitches {
    return JSON.parse(JSON.stringify(switches));
  }

  static isOutboundPaused(): boolean {
    return switches.outboundCallingPaused;
  }

  static areSignupsPaused(): boolean {
    return switches.signupsPaused;
  }

  static status() {
    return { loaded: loadedOnce, lastRefreshAt: lastRefreshAt?.toISOString() || null, lastRefreshError };
  }

  /** Everything the panel shows: default vs live value of each plan, switches, role caps. */
  static async getAdminView() {
    await PlatformConfigService.ensureLoaded();
    const capRows = await prisma.adminSetting.findMany({ where: { key: { startsWith: 'caps_' } } });
    const stored = new Map(capRows.map((r) => [r.key.slice(5), r]));
    const caps = Object.fromEntries(Object.entries(DEFAULT_CAPS).map(([role, def]) => {
      const row = stored.get(role);
      const v = (row?.value && typeof row.value === 'object' ? row.value : {}) as Record<string, any>;
      const effective = role === 'owner' ? def : { ...def, ...v };
      return [role, {
        ...effective,
        // JSON has no Infinity: unlimited is sent as null.
        maxMinutesPerGrant: Number.isFinite(effective.maxMinutesPerGrant) ? effective.maxMinutesPerGrant : null,
        maxMinutesPerDay: Number.isFinite(effective.maxMinutesPerDay) ? effective.maxMinutesPerDay : null,
        editable: role !== 'owner',
        overridden: Boolean(row) && role !== 'owner',
        updatedBy: row?.updatedBy || null,
        updatedAt: row?.updatedAt || null,
      }];
    }));
    const meta = await prisma.adminSetting.findMany({ where: { key: { in: [PLANS_SETTING_KEY, SWITCHES_SETTING_KEY] } }, select: { key: true, updatedBy: true, updatedAt: true } });
    return {
      plans: Object.keys(PLAN_CONFIG).map((key) => {
        const def = DEFAULT_PLAN_CONFIG[key];
        const live = PLAN_CONFIG[key];
        return {
          key,
          name: live.name,
          accountType: live.accountType,
          overridden: Boolean(planOverrides[key]),
          live: { price: live.price, minutes: live.minutes, maxConcurrentCalls: live.maxConcurrentCalls, purchasable: live.purchasable !== false, kbLimits: { ...live.kbLimits }, calendarLimits: { ...live.calendarLimits } },
          defaults: { price: def.price, minutes: def.minutes, maxConcurrentCalls: def.maxConcurrentCalls, purchasable: def.purchasable !== false, kbLimits: { ...def.kbLimits }, calendarLimits: { ...def.calendarLimits } },
        };
      }),
      switches: PlatformConfigService.getSwitches(),
      caps,
      meta: Object.fromEntries(meta.map((m) => [m.key, { updatedBy: m.updatedBy, updatedAt: m.updatedAt }])),
      status: PlatformConfigService.status(),
    };
  }

  /** What any visitor may see (website pricing, dashboard banner, sign-up form). No secrets. */
  static getPublicState() {
    const s = switches;
    return {
      plans: Object.entries(PLAN_CONFIG).map(([key, p]) => ({
        key,
        name: p.name,
        price: p.price,
        minutes: p.minutes,
        maxConcurrentCalls: p.maxConcurrentCalls,
        kbDocuments: p.kbLimits.maxDocuments,
        calendars: p.calendarLimits.maxCalendarsPerWorkspace,
        bookingsPerMonth: p.calendarLimits.maxBookingsPerMonth,
        purchasable: p.purchasable !== false,
      })),
      banner: s.maintenanceBanner.enabled && s.maintenanceBanner.message
        ? { message: s.maintenanceBanner.message, level: s.maintenanceBanner.level }
        : null,
      signupsPaused: s.signupsPaused,
      signupsPausedMessage: s.signupsPaused ? s.signupsPausedMessage : null,
      callingPaused: s.outboundCallingPaused,
      callingPausedMessage: s.outboundCallingPaused ? s.outboundPausedMessage : null,
    };
  }

  // ─── Changes (owner, audited) ──────────────────────────────────────────────

  private static async lockedRead(tx: Prisma.TransactionClient, key: string): Promise<unknown> {
    // Serialises two edits of the same settings row (read-modify-write of one JSON value).
    await tx.$executeRaw`SELECT 1 FROM admin_settings WHERE key = ${key} FOR UPDATE`;
    const row = await tx.adminSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  static async updatePlan(key: string, input: any, ctx: { staff: StaffContext; reason: string; ip?: string; userAgent?: string; requestId?: string }) {
    await PlatformConfigService.ensureLoaded();
    const check = validatePlanInput(key, input);
    if (!check.ok) return check;
    const before = { ...PLAN_CONFIG[key], kbLimits: { ...PLAN_CONFIG[key].kbLimits }, calendarLimits: { ...PLAN_CONFIG[key].calendarLimits } };
    await withAudit(
      { ...ctx, action: 'platform:plan_update', targetType: 'PlanConfig', targetId: key },
      async (tx) => {
        const current = await PlatformConfigService.lockedRead(tx, PLANS_SETTING_KEY) as any;
        const overrides = { ...((current && current.overrides) || {}), [key]: check.value };
        await tx.adminSetting.upsert({
          where: { key: PLANS_SETTING_KEY },
          create: { key: PLANS_SETTING_KEY, value: { overrides } as any, updatedBy: ctx.staff.email },
          update: { value: { overrides } as any, updatedBy: ctx.staff.email },
        });
        return { result: null, before: planAuditView(before), after: { ...check.value } as any };
      }
    );
    await PlatformConfigService.refresh();
    return check;
  }

  static async resetPlan(key: string, ctx: { staff: StaffContext; reason: string; ip?: string; userAgent?: string; requestId?: string }) {
    await PlatformConfigService.ensureLoaded();
    if (!DEFAULT_PLAN_CONFIG[key]) return { ok: false as const, errors: [`Unknown plan "${key}".`] };
    const before = planAuditView(PLAN_CONFIG[key]);
    await withAudit(
      { ...ctx, action: 'platform:plan_reset', targetType: 'PlanConfig', targetId: key },
      async (tx) => {
        const current = await PlatformConfigService.lockedRead(tx, PLANS_SETTING_KEY) as any;
        const overrides = { ...((current && current.overrides) || {}) };
        delete overrides[key];
        await tx.adminSetting.upsert({
          where: { key: PLANS_SETTING_KEY },
          create: { key: PLANS_SETTING_KEY, value: { overrides } as any, updatedBy: ctx.staff.email },
          update: { value: { overrides } as any, updatedBy: ctx.staff.email },
        });
        return { result: null, before, after: planAuditView(DEFAULT_PLAN_CONFIG[key]) };
      }
    );
    await PlatformConfigService.refresh();
    return { ok: true as const, value: null };
  }

  static async updateSwitches(input: any, ctx: { staff: StaffContext; reason: string; ip?: string; userAgent?: string; requestId?: string }) {
    await PlatformConfigService.ensureLoaded();
    let result: ValidationResult<PlatformSwitches> = { ok: false, errors: ['not applied'] };
    await withAudit(
      { ...ctx, action: 'platform:switches_update', targetType: 'PlatformSwitches', targetId: SWITCHES_SETTING_KEY },
      async (tx) => {
        const stored = await PlatformConfigService.lockedRead(tx, SWITCHES_SETTING_KEY);
        const current = parseStoredSwitches(stored);
        result = validateSwitchesInput(input, current);
        if (!result.ok) throw new SwitchesInvalid(result.errors);
        await tx.adminSetting.upsert({
          where: { key: SWITCHES_SETTING_KEY },
          create: { key: SWITCHES_SETTING_KEY, value: result.value as any, updatedBy: ctx.staff.email },
          update: { value: result.value as any, updatedBy: ctx.staff.email },
        });
        return { result: null, before: current as any, after: result.value as any };
      }
    ).catch((err) => {
      if (err instanceof SwitchesInvalid) return;
      throw err;
    });
    if (result.ok) await PlatformConfigService.refresh();
    return result;
  }

  static async updateRoleCaps(role: string, input: any, ctx: { staff: StaffContext; reason: string; ip?: string; userAgent?: string; requestId?: string }) {
    const check = validateCapsInput(role, input);
    if (!check.ok) return check;
    const key = `caps_${role}`;
    await withAudit(
      { ...ctx, action: 'platform:caps_update', targetType: 'RoleCaps', targetId: role },
      async (tx) => {
        const before = await tx.adminSetting.findUnique({ where: { key } });
        await tx.adminSetting.upsert({
          where: { key },
          create: { key, value: check.value as any, updatedBy: ctx.staff.email },
          update: { value: check.value as any, updatedBy: ctx.staff.email },
        });
        return { result: null, before: (before?.value as any) ?? (DEFAULT_CAPS[role] as any), after: check.value as any };
      }
    );
    return check;
  }

  /** Tests only: forget the loaded state (next ensureLoaded() reads the database again). */
  static resetForTests(): void {
    planOverrides = {};
    switches = JSON.parse(JSON.stringify(DEFAULT_SWITCHES));
    loadedOnce = false;
    firstLoad = null;
    applyPlans({});
  }
}

class SwitchesInvalid extends Error {
  constructor(public errors: string[]) {
    super('SWITCHES_INVALID');
  }
}

function planAuditView(p: Readonly<PlanDetails>): Prisma.InputJsonValue {
  return {
    price: p.price,
    minutes: p.minutes,
    maxConcurrentCalls: p.maxConcurrentCalls,
    purchasable: p.purchasable !== false,
    kbLimits: { ...p.kbLimits },
    calendarLimits: { ...p.calendarLimits },
  };
}
