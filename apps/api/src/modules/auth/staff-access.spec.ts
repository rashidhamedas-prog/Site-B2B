import {
  STAFF_ROLES,
  canAccessStaffModule,
  isStaffRole,
  STAFF_ROLE_MODULES,
  roleAfterCustomerLink,
  resolveAuthPurpose,
  actingRoleForPurpose,
  staffPhoneConflictMessage,
  isShopperPurpose,
  isRetailPurpose,
  isWholesalePurpose,
} from './staff-access';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

for (const role of STAFF_ROLES) {
  assert(isStaffRole(role), role);
  assert(STAFF_ROLE_MODULES[role].includes('dashboard'), `${role} dashboard`);
}

assert(canAccessStaffModule('ADMIN', 'settings'), 'admin settings');
assert(canAccessStaffModule('ADMIN', 'users'), 'admin users');
assert(canAccessStaffModule('SALES_REP', 'account'), 'staff can open own account');
assert(!canAccessStaffModule('SALES_MANAGER', 'settings'), 'sales no settings');
assert(canAccessStaffModule('SALES_MANAGER', 'crm'), 'sales crm');
assert(canAccessStaffModule('WAREHOUSE_MANAGER', 'inventory'), 'warehouse inventory');
assert(!canAccessStaffModule('CUSTOMER_SERVICE', 'catalog'), 'cs no catalog');

assert(roleAfterCustomerLink('ADMIN') === 'ADMIN', 'otp must not demote admin');
assert(roleAfterCustomerLink('SALES_REP') === 'SALES_REP', 'otp must not demote staff');
assert(roleAfterCustomerLink('CUSTOMER') === 'CUSTOMER', 'customer stays customer');
assert(roleAfterCustomerLink(undefined) === 'CUSTOMER', 'missing role is customer');
assert(staffPhoneConflictMessage('ADMIN') === null, 'staff may also shop');
assert(staffPhoneConflictMessage('CUSTOMER') === null, 'customer phone allowed');
assert(resolveAuthPurpose('admin') === 'admin', 'admin purpose');
assert(resolveAuthPurpose('portal') === 'wholesale', 'portal is wholesale');
assert(resolveAuthPurpose('retail') === 'retail', 'retail purpose');
assert(resolveAuthPurpose(undefined) === 'wholesale', 'omitted login is wholesale');
assert(resolveAuthPurpose('storefront') === 'wholesale', 'legacy storefront JWT is wholesale');
assert(actingRoleForPurpose('admin', 'ADMIN') === 'ADMIN', 'admin acts as db role');
assert(actingRoleForPurpose('wholesale', 'ADMIN') === 'CUSTOMER', 'staff shops as customer');
assert(actingRoleForPurpose('retail', 'ADMIN') === 'CUSTOMER', 'staff retail shops as customer');
assert(isShopperPurpose('retail') === true, 'retail is shopper');
assert(isShopperPurpose('admin') === false, 'admin is not shopper');
assert(isRetailPurpose('retail') === true, 'retail purpose flag');
assert(isWholesalePurpose('storefront') === true, 'legacy storefront is wholesale-compatible');

console.log('staff-access.spec.ts: OK');
