/**
 * Customer-facing plan names for the account types the server stores (server/src/config/plans.ts:
 * starter → Starter, developer → Startup, professional → Growth, …). Display only — the server
 * decides plans and entitlements (audit #96: the badge showed "developer Plan").
 */
const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  starter: 'Starter',
  developer: 'Startup',
  startup: 'Startup',
  professional: 'Growth',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export function planDisplayName(accountType: string | null | undefined): string {
  const key = String(accountType || '').trim().toLowerCase();
  return PLAN_NAMES[key] || 'No active';
}
