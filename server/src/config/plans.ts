/**
 * Centralized Plan Configuration — Single Source of Truth for Plan Pricing & Minute Allotment
 */

export interface PlanDetails {
  name: string;
  price: number; // Price in INR (₹)
  minutes: number;
  accountType: string;
}

export const PLAN_CONFIG: Record<string, PlanDetails> = {
  trial: {
    name: 'Trial',
    price: 1,
    minutes: 20,
    accountType: 'trial',
  },
  starter: {
    name: 'Starter',
    price: 800,
    minutes: 500,
    accountType: 'starter',
  },
  startup: {
    name: 'Startup',
    price: 3799,
    minutes: 750,
    accountType: 'developer',
  },
  growth: {
    name: 'Growth',
    price: 10799,
    minutes: 2865,
    accountType: 'professional',
  },
  enterprise: {
    name: 'Enterprise',
    price: 30799,
    minutes: 10000,
    accountType: 'enterprise',
  },
};

export function getPlanConfig(planName: string): PlanDetails | null {
  if (!planName || typeof planName !== 'string') return null;
  const key = planName.trim().toLowerCase();
  return PLAN_CONFIG[key] || null;
}
