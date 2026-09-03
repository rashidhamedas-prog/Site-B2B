/**
 * Pure unit checks for customer password set/reset policy.
 * Prefer: npx ts-node --transpile-only src/modules/auth/password-policy.spec.ts
 */
import {
  canIssuePasswordReset,
  canSetPasswordWithoutCurrent,
  GENERIC_PASSWORD_FORGOT_MESSAGE,
  validateNewPassword,
} from './password-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(validateNewPassword('short') === 'رمز عبور حداقل ۸ کاراکتر باشد', 'min length');
assert(validateNewPassword('goodpass') === null, 'min ok');
assert(validateNewPassword('09151234567', '09151234567') === 'رمز عبور نباید همان شماره موبایل باشد', 'not phone');
assert(validateNewPassword('aaaaaaaa') === 'رمز عبور نباید یک کاراکتر تکراری باشد', 'repeat');
assert(validateNewPassword('good pass') === 'رمز عبور نباید فاصله داشته باشد', 'space');
assert(GENERIC_PASSWORD_FORGOT_MESSAGE.includes('اگر این شماره'), 'generic copy');

const isStaff = (role: string) => role === 'ADMIN' || role === 'STAFF';
assert(
  canIssuePasswordReset({
    user: { role: 'CUSTOMER', customerId: 'c1' },
    customer: { status: 'ACTIVE' },
    isStaffRole: isStaff,
  }) === true,
  'active customer',
);
assert(
  canIssuePasswordReset({
    user: { role: 'CUSTOMER', customerId: 'c1' },
    customer: { status: 'PENDING' },
    isStaffRole: isStaff,
  }) === true,
  'pending wholesale may reset',
);
assert(
  canIssuePasswordReset({
    user: { role: 'CUSTOMER', customerId: 'c1' },
    customer: { status: 'BLOCKED' },
    isStaffRole: isStaff,
  }) === false,
  'blocked no reset',
);
assert(
  canIssuePasswordReset({
    user: { role: 'ADMIN', customerId: 'c1' },
    customer: { status: 'ACTIVE' },
    isStaffRole: isStaff,
  }) === false,
  'staff never via public reset',
);
assert(
  canIssuePasswordReset({
    user: null,
    customer: null,
    isStaffRole: isStaff,
  }) === false,
  'unknown phone',
);
assert(
  canSetPasswordWithoutCurrent({
    dbRole: 'CUSTOMER',
    purpose: 'storefront',
    hasOtpSession: true,
    isStaffRole: isStaff,
  }) === true,
  'otp shopper can set',
);
assert(
  canSetPasswordWithoutCurrent({
    dbRole: 'ADMIN',
    purpose: 'storefront',
    hasOtpSession: true,
    isStaffRole: isStaff,
  }) === false,
  'staff cannot set via this path',
);
assert(
  canSetPasswordWithoutCurrent({
    dbRole: 'CUSTOMER',
    purpose: 'admin',
    hasOtpSession: true,
    isStaffRole: isStaff,
  }) === false,
  'admin jwt cannot set',
);
assert(
  canSetPasswordWithoutCurrent({
    dbRole: 'CUSTOMER',
    purpose: 'retail',
    hasOtpSession: true,
    isStaffRole: isStaff,
  }) === true,
  'retail otp shopper can set',
);
assert(
  canSetPasswordWithoutCurrent({
    dbRole: 'CUSTOMER',
    purpose: 'storefront',
    hasOtpSession: false,
    isStaffRole: isStaff,
  }) === false,
  'password login cannot skip current',
);

console.log('password-policy.spec.ts: OK');
