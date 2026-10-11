/**
 * Claritiy Voice Admin Console — Permissions & Role-Based Access Control (RBAC)
 * Authoritative mapping of administrative permissions to allowed staff roles.
 */

export type StaffRole = 'owner' | 'admin' | 'sales' | 'support' | 'finance';

export type StaffStatus = 'invited' | 'active' | 'disabled';

export type PermissionName =
  | 'customers:view'
  | 'customers:edit'
  | 'customers:suspend'
  | 'customers:restrict'
  | 'customers:restore'
  | 'metrics:view'
  | 'payments:view'
  | 'call_content:view'
  | 'minutes:grant'
  | 'minutes:deduct'
  | 'plans:manage'
  | 'payment_links:create'
  | 'refunds:manage'
  | 'numbers:activate'
  | 'kyc:reset'
  | 'security:force_logout'
  | 'security:revoke_keys'
  | 'calls:terminate'
  | 'agents:disable'
  | 'staff:manage'
  | 'settings:manage'
  | 'audit:view'
  | 'exports:csv';

export const PERMISSION_ROLE_MAP: Record<PermissionName, readonly StaffRole[]> = {
  // Customer & CRM visibility
  'customers:view': ['owner', 'admin', 'sales', 'support', 'finance'],
  'customers:edit': ['owner', 'admin', 'sales', 'support'],
  'customers:suspend': ['owner', 'admin'],
  'customers:restrict': ['owner', 'admin', 'support'],
  'customers:restore': ['owner', 'admin'],

  // Analytics & Operational Dashboards
  'metrics:view': ['owner', 'admin', 'sales', 'support', 'finance'],

  // Payments & Financials
  'payments:view': ['owner', 'admin', 'finance', 'sales'],
  'refunds:manage': ['owner', 'finance'],
  'exports:csv': ['owner', 'admin', 'finance'],

  // Call Content (Transcripts & Recordings) — Restricted to Owner ONLY per Founder Decision #4
  'call_content:view': ['owner'],

  // Minutes Balances
  'minutes:grant': ['owner', 'admin', 'sales', 'support'],
  'minutes:deduct': ['owner', 'admin'],

  // Catalog & Sales Links
  'plans:manage': ['owner', 'admin', 'sales'],
  'payment_links:create': ['owner', 'admin', 'sales'],

  // Operations & Compliance
  'numbers:activate': ['owner', 'admin'],
  'kyc:reset': ['owner', 'admin', 'support'],
  'security:force_logout': ['owner', 'admin', 'support'],
  'security:revoke_keys': ['owner', 'admin', 'support'],
  'calls:terminate': ['owner', 'admin', 'support'],
  'agents:disable': ['owner', 'admin', 'support'],

  // System Administration & Team Governance — Restricted strictly to Owner per Founder Decisions #7 & #8
  'staff:manage': ['owner'],
  'settings:manage': ['owner'],
  'audit:view': ['owner', 'admin'],
} as const;

/**
 * Validates whether a given staff role possesses the specified permission.
 */
export function hasPermission(role: string, permission: PermissionName): boolean {
  const allowedRoles = PERMISSION_ROLE_MAP[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role as StaffRole);
}

/**
 * Returns an array of all permissions available to a given staff role.
 */
export function getPermissionsForRole(role: string): PermissionName[] {
  return (Object.keys(PERMISSION_ROLE_MAP) as PermissionName[]).filter((perm) =>
    hasPermission(role, perm)
  );
}
