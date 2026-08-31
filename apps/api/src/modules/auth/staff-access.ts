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
  return isStaffRole(currentRole) ? currentRole : 'CUSTOMER';
}

/** Retail OTP / wholesale register must not use a staff phone as a shopper identity. */
export function staffPhoneConflictMessage(role: string | null | undefined): string | null {
  if (!isStaffRole(role)) return null;
  return 'این شماره متعلق به حساب مدیریت است. برای ورود به پنل از صفحه ورود ادمین استفاده کنید.';
}
