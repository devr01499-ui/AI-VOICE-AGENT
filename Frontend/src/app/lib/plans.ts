import { useSyncExternalStore } from 'react';
/**
 * Plan facts shown anywhere on the site (Pricing page, dashboard Billing, SEO text).
 *
 * This mirrors server/src/config/plans.ts (PLAN_CONFIG), which is what customers are actually
 * charged and credited. The server test `test:marketing-claims` fails if any value here drifts from
 * the server, so never type a price, minute count or limit anywhere else; import it from here.
 *
 * Plans are one-time minute packs (there is no monthly renewal, pay-as-you-go or overage billing):
 * when the minutes are used up, calls stop until another plan is bought.
 */
export interface PublicPlan {
  key: 'startup' | 'growth' | 'enterprise';
  name: string;
  price: number; // INR, one-time
  minutes: number;
  maxConcurrentCalls: number;
  kbDocuments: number;
  calendars: number;
  bookingsPerMonth: number;
  tag: string;
  description: string;
}

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    key: 'startup', name: 'Startup', price: 3799, minutes: 750, maxConcurrentCalls: 1,
    kbDocuments: 25, calendars: 3, bookingsPerMonth: 500,
    tag: 'Entry', description: 'For growing businesses starting with AI voice automation.',
  },
  {
    key: 'growth', name: 'Growth', price: 10799, minutes: 2865, maxConcurrentCalls: 1,
    kbDocuments: 100, calendars: 5, bookingsPerMonth: 2500,
    tag: 'Teams', description: 'For high-volume teams running campaigns and inbound lines.',
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 30799, minutes: 10000, maxConcurrentCalls: 1,
    kbDocuments: 1000, calendars: 20, bookingsPerMonth: 10000,
    tag: 'Scale', description: 'For large operations that need the highest capacity.',
  },
];

export const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Effective rate in ₹ per minute, two decimals (price ÷ minutes). */
export const effectiveRate = (p: Pick<PublicPlan, 'price' | 'minutes'>) => (Math.round((p.price / p.minutes) * 100) / 100).toFixed(2);

export const LOWEST_PLAN = PUBLIC_PLANS[0];

/**
 * How many calls a customer can run at once, worded from the plan values (the server enforces the
 * same numbers). Today every plan is 1 (owner decision 2026-11-26: quality first).
 */
export const maxConcurrency = (plans: Pick<PublicPlan, 'maxConcurrentCalls'>[]) => Math.max(1, ...plans.map((p) => p.maxConcurrentCalls));
export const concurrencyText = (plans: Pick<PublicPlan, 'maxConcurrentCalls'>[]) => {
  const max = maxConcurrency(plans);
  return max <= 1 ? 'One call at a time per account' : `Up to ${max} calls at once, by plan`;
};

/** The plan with the lowest price per minute (for "from ₹X/min" copy). */
export const bestRatePlan = (plans: PublicPlan[]): PublicPlan =>
  (plans.length ? plans : PUBLIC_PLANS).reduce((best, p) => (p.price / p.minutes < best.price / best.minutes ? p : best));

/** The cheapest plan by price (for "plans from ₹X" copy). */
export const lowestPricePlan = (plans: PublicPlan[]): PublicPlan =>
  (plans.length ? plans : PUBLIC_PLANS).reduce((low, p) => (p.price < low.price ? p : low));

/** One-line pricing statement for SEO / FAQ text. */
/** Mirrors the server's PLAN_VALIDITY_DAYS / NUMBER_RELEASE_GRACE_DAYS (config/plans.ts). */
export const PLAN_VALIDITY_DAYS = 30;
export const NUMBER_RELEASE_GRACE_DAYS = 5;

export const PRICING_SUMMARY = `Plans from ${formatInr(LOWEST_PLAN.price)} for ${LOWEST_PLAN.minutes.toLocaleString('en-IN')} calling minutes valid ${PLAN_VALIDITY_DAYS} days (one-time payment, no auto-renewal), with a local +91 number included after KYC.`;

// ─── Live values from the admin panel ─────────────────────────────────────────
// The owner can change prices, minutes, limits and "on sale" in the admin Control Panel. The values
// above are the first paint (and what search engines read in the pre-rendered pages); once
// GET /api/v2/public/platform answers, the same plan objects are updated in place and every
// component using usePublicPlans() re-renders. Checkout always charges the server's live price.

export interface PlatformBanner { message: string; level: 'info' | 'warning' | 'critical' }
export interface PublicPlatformState {
  banner: PlatformBanner | null;
  signupsPaused: boolean;
  signupsPausedMessage: string | null;
  callingPaused: boolean;
  callingPausedMessage: string | null;
}

let visiblePlans: PublicPlan[] = PUBLIC_PLANS;
let platformState: PublicPlatformState = { banner: null, signupsPaused: false, signupsPausedMessage: null, callingPaused: false, callingPausedMessage: null };
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;
let lastLoadAt = 0;

function emit() {
  for (const l of listeners) l();
}

/** Fetches the live platform state once (again at most every 60 s). Never throws. */
export function loadLivePlatform(apiBase: string): Promise<void> {
  if (loadPromise) return loadPromise;
  if (Date.now() - lastLoadAt < 60_000) return Promise.resolve();
  loadPromise = (async () => {
    try {
      const res = await fetch(`${apiBase}/api/v2/public/platform`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const body = await res.json();
      const data = body?.data;
      if (!data || !Array.isArray(data.plans)) return;
      const live = new Map<string, any>(data.plans.map((p: any) => [String(p.key), p]));
      for (const plan of PUBLIC_PLANS) {
        const p = live.get(plan.key);
        if (!p) continue;
        const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);
        plan.price = num(p.price, plan.price);
        plan.minutes = num(p.minutes, plan.minutes);
        plan.maxConcurrentCalls = num(p.maxConcurrentCalls, plan.maxConcurrentCalls);
        plan.kbDocuments = num(p.kbDocuments, plan.kbDocuments);
        plan.calendars = num(p.calendars, plan.calendars);
        plan.bookingsPerMonth = num(p.bookingsPerMonth, plan.bookingsPerMonth);
      }
      visiblePlans = PUBLIC_PLANS.filter((plan) => live.get(plan.key)?.purchasable !== false);
      platformState = {
        banner: data.banner && typeof data.banner.message === 'string' && data.banner.message.trim()
          ? { message: data.banner.message, level: ['info', 'warning', 'critical'].includes(data.banner.level) ? data.banner.level : 'info' }
          : null,
        signupsPaused: data.signupsPaused === true,
        signupsPausedMessage: typeof data.signupsPausedMessage === 'string' ? data.signupsPausedMessage : null,
        callingPaused: data.callingPaused === true,
        callingPausedMessage: typeof data.callingPausedMessage === 'string' ? data.callingPausedMessage : null,
      };
      lastLoadAt = Date.now();
      emit();
    } catch {
      // Offline or server asleep: keep the built-in values (checkout still uses the server price).
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Plans that can be bought right now, with live prices and limits. */
export function usePublicPlans(): PublicPlan[] {
  return useSyncExternalStore(subscribe, () => visiblePlans, () => PUBLIC_PLANS);
}

/** Latest known switches (for code outside React components). */
export function getPlatformState(): PublicPlatformState {
  return platformState;
}

/** Shown on the sign-in page after a blocked new account was signed out (sessionStorage key). */
export const AUTH_NOTICE_KEY = 'claritiy_auth_notice';

/** Banner and pause switches set in the admin panel. */
export function usePlatformState(): PublicPlatformState {
  return useSyncExternalStore(subscribe, () => platformState, () => platformState);
}
