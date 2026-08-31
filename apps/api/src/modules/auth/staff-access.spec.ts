import { STAFF_ROLES, canAccessStaffModule, isStaffRole, STAFF_ROLE_MODULES } from './staff-access';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

for (const role of STAFF_ROLES) {
  assert(isStaffRole(role), role);
  assert(STAFF_ROLE_MODULES[role].includes('dashboard'), `${role} dashboard`);
}

assert(canAccessStaffModule('ADMIN', 'settings'), 'admin settings');
assert(canAccessStaffModule('ADMIN', 'users'), 'admin users');
assert(!canAccessStaffModule('SALES_MANAGER', 'settings'), 'sales no settings');
assert(canAccessStaffModule('SALES_MANAGER', 'crm'), 'sales crm');
assert(canAccessStaffModule('WAREHOUSE_MANAGER', 'inventory'), 'warehouse inventory');
assert(!canAccessStaffModule('CUSTOMER_SERVICE', 'catalog'), 'cs no catalog');

console.log('staff-access.spec.ts: OK');
