import {
  isSalesPartnerLoginLocked,
  isSalesPartnerPhoneLoginLocked,
  salesPartnerLoginFailKey,
  salesPartnerLoginPhoneFailKey,
  SALES_PARTNER_LOGIN_MAX_FAILS,
  SALES_PARTNER_LOGIN_PHONE_MAX_FAILS,
} from './sales-partner-login-lockout';
import { extractClientIp } from '../../common/client-ip';

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
assert(
  salesPartnerLoginPhoneFailKey('09151234567') === 'sp-login-fail-phone:09151234567',
  'phone-only key',
);
assert(isSalesPartnerPhoneLoginLocked(SALES_PARTNER_LOGIN_PHONE_MAX_FAILS), 'phone lock at 20');
assert(extractClientIp({ ip: '203.0.113.1' }) === '203.0.113.1', 'req.ip trusted');
assert(extractClientIp({ ip: '203.0.113.1, 1.2.3.4' }) === '203.0.113.1', 'req.ip first token only');

console.log('sales-partner-login-lockout.spec.ts: OK');
