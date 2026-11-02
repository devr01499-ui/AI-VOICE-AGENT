/**
 * Centralized Plan Configuration — Single Source of Truth for Plan Pricing & Minute Allotment
 */

export interface KbPlanLimits {
  maxDocuments: number;
  maxStorageMb: number;
  maxFileSizeMb: number;
  maxChunksPerWorkspace: number;
  maxKbAttachedPerAgent: number;
}

export interface PlanDetails {
  name: string;
  price: number; // Price in INR (₹)
  minutes: number;
  accountType: string;
  kbLimits: KbPlanLimits;
}

export const PLAN_CONFIG: Record<string, PlanDetails> = {
  trial: {
    name: 'Trial',
    price: 1,
    minutes: 20,
    accountType: 'trial',
    kbLimits: {
      maxDocuments: 2,
      maxStorageMb: 5,
      maxFileSizeMb: 2,
      maxChunksPerWorkspace: 200,
      maxKbAttachedPerAgent: 1,
    },
  },
  starter: {
    name: 'Starter',
    price: 800,
    minutes: 500,
    accountType: 'starter',
    kbLimits: {
      maxDocuments: 10,
      maxStorageMb: 25,
      maxFileSizeMb: 10,
      maxChunksPerWorkspace: 1500,
      maxKbAttachedPerAgent: 3,
    },
  },
  startup: {
    name: 'Startup',
    price: 3799,
    minutes: 750,
    accountType: 'developer',
    kbLimits: {
      maxDocuments: 25,
      maxStorageMb: 100,
      maxFileSizeMb: 25,
      maxChunksPerWorkspace: 5000,
      maxKbAttachedPerAgent: 5,
    },
  },
  growth: {
    name: 'Growth',
    price: 10799,
    minutes: 2865,
    accountType: 'professional',
    kbLimits: {
      maxDocuments: 100,
      maxStorageMb: 500,
      maxFileSizeMb: 50,
      maxChunksPerWorkspace: 20000,
      maxKbAttachedPerAgent: 15,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 30799,
    minutes: 10000,
    accountType: 'enterprise',
    kbLimits: {
      maxDocuments: 1000,
      maxStorageMb: 5000,
      maxFileSizeMb: 100,
      maxChunksPerWorkspace: 200000,
      maxKbAttachedPerAgent: 50,
    },
  },
};

export function getPlanConfig(planName: string): PlanDetails | null {
  if (!planName || typeof planName !== 'string') return null;
  const key = planName.trim().toLowerCase();
  return PLAN_CONFIG[key] || null;
}

export function getKbPlanLimits(planNameOrAccountType?: string | null): KbPlanLimits {
  if (!planNameOrAccountType) return PLAN_CONFIG.trial.kbLimits;
  const key = planNameOrAccountType.trim().toLowerCase();
  if (PLAN_CONFIG[key]) return PLAN_CONFIG[key].kbLimits;
  // Match by accountType
  const match = Object.values(PLAN_CONFIG).find(p => p.accountType.toLowerCase() === key);
  return match?.kbLimits || PLAN_CONFIG.trial.kbLimits;
}
