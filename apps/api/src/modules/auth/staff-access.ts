/** Staff identity + module ACL. Keep in sync with apps/web/src/lib/staff-access.ts */

export const STAFF_ROLES = [
  'ADMIN',
  'SALES_MANAGER',
  'SALES_REP',
  'ACCOUNTANT',
  'WAREHOUSE_MANAGER',
  'CUSTOMER_SERVICE',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_MODULES = [
  'dashboard',
  'reports',
  'crm',
  'orders',
  'rma',
  'invoices',
  'payments',
  'catalog',
  'inventory',
  'discounts',
  'content',
  'omnichannel',
  'settings',
  'users',
  'partners',
  'account',
] as const;

export type StaffModule = (typeof STAFF_MODULES)[number];

const ALL_MODULES: readonly StaffModule[] = STAFF_MODULES;

export const STAFF_ROLE_MODULES: Record<StaffRole, readonly StaffModule[]> = {
  ADMIN: ALL_MODULES,
  SALES_MANAGER: ['dashboard', 'reports', 'crm', 'orders', 'rma', 'catalog', 'discounts', 'content', 'account'],
  SALES_REP: ['dashboard', 'crm', 'orders', 'catalog', 'account'],
  ACCOUNTANT: ['dashboard', 'reports', 'orders', 'invoices', 'payments', 'account'],
  WAREHOUSE_MANAGER: ['dashboard', 'orders', 'catalog', 'inventory', 'account'],
  CUSTOMER_SERVICE: ['dashboard', 'crm', 'orders', 'rma', 'content', 'account'],
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'مدیر کل',
  SALES_MANAGER: 'مدیر فروش',
  SALES_REP: 'کارشناس فروش',
  ACCOUNTANT: 'حسابدار',
  WAREHOUSE_MANAGER: 'مدیر انبار',
  CUSTOMER_SERVICE: 'پشتیبانی',
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function canAccessStaffModule(
  role: string | null | undefined,
  module: StaffModule,
): boolean {
  if (!isStaffRole(role)) return false;
  return STAFF_ROLE_MODULES[role].includes(module);
}

/** Retail OTP / wholesale register must never demote a staff row to CUSTOMER. */
export function roleAfterCustomerLink(currentRole: string | null | undefined): string {
  if (isStaffRole(currentRole)) return currentRole;
  if (currentRole === 'VENDOR') return 'VENDOR';
  return 'CUSTOMER';
}

export type AuthSessionPurpose = 'admin' | 'retail' | 'wholesale' | 'vendor';

export function isShopperPurpose(purpose?: string | null): boolean {
  return purpose === 'retail' || purpose === 'wholesale' || purpose === 'storefront';
}

export function isWholesalePurpose(purpose?: string | null): boolean {
  return purpose === 'wholesale' || purpose === 'portal' || purpose === 'storefront';
}

export function isRetailPurpose(purpose?: string | null): boolean {
  return purpose === 'retail';
}

export function isVendorPurpose(purpose?: string | null): boolean {
  return purpose === 'vendor';
}

/**
 * Login omitted purpose = wholesale (portal form).
 * Legacy JWT `storefront` validates as wholesale so existing portal sessions keep working.
 * Retail OTP/login must send `retail` explicitly.
 * Partner login must send `vendor` explicitly.
 */
export function resolveAuthPurpose(requested?: 'admin' | 'portal' | 'retail' | 'wholesale' | 'vendor' | string | null): AuthSessionPurpose {
  const p = String(requested || '').toLowerCase();
  if (p === 'admin') return 'admin';
  if (p === 'retail') return 'retail';
  if (p === 'vendor') return 'vendor';
  return 'wholesale';
}

/** Shopper session always acts as CUSTOMER so staff can buy without admin API access. */
export function actingRoleForPurpose(purpose: AuthSessionPurpose, dbRole: string): string {
  if (purpose === 'admin') return dbRole;
  if (purpose === 'vendor') return dbRole === 'VENDOR' ? 'VENDOR' : 'CUSTOMER';
  return 'CUSTOMER';
}

/** Staff may also shop. Keep for older call sites — no longer blocks. */
export function staffPhoneConflictMessage(_role: string | null | undefined): string | null {
  return null;
}
