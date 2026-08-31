import { staffMutationError } from './users.policy';
import { isStaffRole, canAccessStaffModule } from './staff-access';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isStaffRole('ADMIN'), 'admin staff');
assert(!isStaffRole('CUSTOMER'), 'customer not staff');
assert(!isStaffRole('MANAGER'), 'manager not staff');
assert(!isStaffRole('SUPER_ADMIN'), 'super_admin not users.role');
assert(!canAccessStaffModule('SALES_REP', 'users'), 'rep no users');
assert(canAccessStaffModule('ADMIN', 'users'), 'admin users');
assert(canAccessStaffModule('ACCOUNTANT', 'payments'), 'accountant payments');
assert(!canAccessStaffModule('ACCOUNTANT', 'settings'), 'accountant no settings');

const base = {
  actorId: 'a1',
  actorRole: 'ADMIN',
  targetId: 't1',
  targetRole: 'ADMIN',
  remainingActiveAdmins: 0,
};

assert(
  /آخرین مدیر/.test(staffMutationError({ ...base, nextIsActive: false }) ?? ''),
  'last admin deactivate',
);
assert(
  /آخرین مدیر/.test(staffMutationError({ ...base, nextRole: 'SALES_REP' }) ?? ''),
  'last admin demote',
);
assert(
  staffMutationError({ ...base, remainingActiveAdmins: 1, nextIsActive: false }) === null,
  'other admin can deactivate',
);
assert(
  /حساب خود/.test(
    staffMutationError({
      ...base,
      targetId: 'a1',
      remainingActiveAdmins: 2,
      nextIsActive: false,
    }) ?? '',
  ),
  'self deactivate',
);
assert(
  /مدیر کل/.test(
    staffMutationError({ ...base, actorRole: 'SALES_MANAGER', remainingActiveAdmins: 2 }) ?? '',
  ),
  'non-admin actor',
);
assert(
  /نامعتبر/.test(staffMutationError({ ...base, remainingActiveAdmins: 2, nextRole: 'MANAGER' }) ?? ''),
  'fake role',
);

console.log('users.policy.spec.ts: OK');
