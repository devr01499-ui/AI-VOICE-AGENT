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
    key: 'startup', name: 'Startup', price: 3799, minutes: 750, maxConcurrentCalls: 5,
    kbDocuments: 25, calendars: 3, bookingsPerMonth: 500,
    tag: 'Entry', description: 'For growing businesses starting with AI voice automation.',
  },
  {
    key: 'growth', name: 'Growth', price: 10799, minutes: 2865, maxConcurrentCalls: 5,
    kbDocuments: 100, calendars: 5, bookingsPerMonth: 2500,
    tag: 'Teams', description: 'For high-volume teams running campaigns and inbound lines.',
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 30799, minutes: 10000, maxConcurrentCalls: 15,
    kbDocuments: 1000, calendars: 20, bookingsPerMonth: 10000,
    tag: 'Scale', description: 'For large operations that need the highest capacity.',
  },
];

export const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Effective rate in ₹ per minute, two decimals (price ÷ minutes). */
export const effectiveRate = (p: Pick<PublicPlan, 'price' | 'minutes'>) => (Math.round((p.price / p.minutes) * 100) / 100).toFixed(2);

export const LOWEST_PLAN = PUBLIC_PLANS[0];

/** One-line pricing statement for SEO / FAQ text. */
/** Mirrors the server's PLAN_VALIDITY_DAYS / NUMBER_RELEASE_GRACE_DAYS (config/plans.ts). */
export const PLAN_VALIDITY_DAYS = 30;
export const NUMBER_RELEASE_GRACE_DAYS = 5;

export const PRICING_SUMMARY = `Plans from ${formatInr(LOWEST_PLAN.price)} for ${LOWEST_PLAN.minutes.toLocaleString('en-IN')} calling minutes valid ${PLAN_VALIDITY_DAYS} days (one-time payment, no auto-renewal), with a local +91 number included after KYC.`;
