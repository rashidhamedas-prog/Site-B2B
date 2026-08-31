/** Staff identity + module ACL. Keep in sync with apps/api/src/modules/auth/staff-access.ts */

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

const PATH_MODULE: Array<{ prefix: string; exact?: boolean; module: StaffModule }> = [
  { prefix: '/admin/account', module: 'account' },
  { prefix: '/admin/users', module: 'users' },
  { prefix: '/admin/settings', module: 'settings' },
  { prefix: '/admin/omnichannel', module: 'omnichannel' },
  { prefix: '/admin/reports', module: 'reports' },
  { prefix: '/admin/customers', module: 'crm' },
  { prefix: '/admin/orders', module: 'orders' },
  { prefix: '/admin/rma', module: 'rma' },
  { prefix: '/admin/invoices', module: 'invoices' },
  { prefix: '/admin/payments', module: 'payments' },
  { prefix: '/admin/products', module: 'catalog' },
  { prefix: '/admin/categories', module: 'catalog' },
  { prefix: '/admin/collections', module: 'catalog' },
  { prefix: '/admin/inventory', module: 'inventory' },
  { prefix: '/admin/discounts', module: 'discounts' },
  { prefix: '/admin/blog', module: 'content' },
  { prefix: '/admin/seo', module: 'content' },
  { prefix: '/admin/pages', module: 'content' },
  { prefix: '/admin/site-content', module: 'content' },
  { prefix: '/admin/menus', module: 'content' },
  { prefix: '/admin/analytics', module: 'content' },
  { prefix: '/admin/notifications', module: 'content' },
  { prefix: '/admin', exact: true, module: 'dashboard' },
];

export function staffModuleForPath(pathname: string): StaffModule | null {
  for (const row of PATH_MODULE) {
    if (row.exact) {
      if (pathname === row.prefix) return row.module;
      continue;
    }
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) return row.module;
  }
  return 'dashboard';
}
