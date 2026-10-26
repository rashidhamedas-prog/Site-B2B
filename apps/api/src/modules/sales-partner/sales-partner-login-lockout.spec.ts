import {
  isSalesPartnerLoginLocked,
  salesPartnerLoginFailKey,
  SALES_PARTNER_LOGIN_MAX_FAILS,
} from './sales-partner-login-lockout';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(!isSalesPartnerLoginLocked(0), 'fresh');
assert(!isSalesPartnerLoginLocked(SALES_PARTNER_LOGIN_MAX_FAILS - 1), 'under limit');
assert(isSalesPartnerLoginLocked(SALES_PARTNER_LOGIN_MAX_FAILS), '5 fails locks next attempt');
assert(isSalesPartnerLoginLocked(6), '6th attempt locked even with correct password');
assert(
  salesPartnerLoginFailKey('09151234567', '1.2.3.4') === 'sp-login-fail:09151234567:1.2.3.4',
  'key shape',
);

console.log('sales-partner-login-lockout.spec.ts: OK');
