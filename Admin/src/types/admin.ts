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

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  permissions?: PermissionName[];
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface CustomerAdminProfile {
  userId: string;
  assignedStaffId?: string | null;
  tags: string[];
  riskLevel: 'none' | 'watch' | 'high';
  riskNote?: string | null;
  lifecycleOverride?: string | null;
  updatedAt: string;
}

export interface CustomerNote {
  id: string;
  userId: string;
  staffId: string;
  staffEmail?: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  userId: string;
  staffId: string;
  dueAt: string;
  note: string;
  doneAt?: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  id: string;
  email: string;
  fullName: string;
  contactNumber?: string | null;
  companyGstin?: string | null;
  accountStatus: 'active' | 'restricted' | 'suspended';
  suspendedReason?: string | null;
  suspendedAt?: string | null;
  callingBalanceMinutes: number;
  minutesRemainingSeconds: number;
  totalMinutesConsumed: number;
  billingBalance: number; // Legacy Credits
  accountType: string;
  lastSeenAt?: string | null;
  createdAt: string;
  adminProfile?: CustomerAdminProfile | null;
  callsCount?: number;
  agentsCount?: number;
  totalSpentInr?: number;
}

export interface MinutesLedgerEntry {
  id: string;
  userId: string;
  deltaSeconds: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  actorType: string;
  actorId?: string | null;
  balanceAfterSeconds: number;
  createdAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  staffId: string;
  staffEmail: string;
  staffRole: string;
  action: string;
  targetType: string;
  targetId: string;
  customerId?: string | null;
  reason: string;
  before?: any;
  after?: any;
  ip?: string | null;
  requestId?: string | null;
  createdAt: string;
}
