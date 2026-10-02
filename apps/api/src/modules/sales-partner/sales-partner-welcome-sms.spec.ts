import { validateNewPassword } from '../auth/password-policy';
import {
  generateValidSalesPartnerTempPassword,
  salesPartnerLoginUrl,
  welcomeSmsCooldownActive,
  WELCOME_SMS_COOLDOWN_MS,
} from './sales-partner-welcome-sms';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const phone = '09121234567';
for (let i = 0; i < 20; i += 1) {
  const password = generateValidSalesPartnerTempPassword(phone);
  assert(password.length >= 8, 'temp password length');
  assert(!/\s/.test(password), 'no whitespace');
  assert(validateNewPassword(password, phone) === null, `policy ok #${i}`);
}

assert(
  salesPartnerLoginUrl('https://www.poshaktaranom.ir/') ===
    'https://www.poshaktaranom.ir/sales-partners/login',
  'login url trims slash',
);
assert(
  salesPartnerLoginUrl(null) === 'https://www.poshaktaranom.ir/sales-partners/login',
  'login url default',
);

const now = Date.UTC(2026, 9, 3, 12, 0, 0);
assert(welcomeSmsCooldownActive(null, now) === false, 'no prior send');
assert(
  welcomeSmsCooldownActive(new Date(now - WELCOME_SMS_COOLDOWN_MS + 1000), now) === true,
  'within cooldown',
);
assert(
  welcomeSmsCooldownActive(new Date(now - WELCOME_SMS_COOLDOWN_MS - 1000), now) === false,
  'after cooldown',
);

console.log('sales-partner-welcome-sms.spec.ts: OK');
