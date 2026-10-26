import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const service = readFileSync(join(__dirname, 'sales-partner.service.ts'), 'utf8');
const dto = readFileSync(join(__dirname, 'dto/sales-partner-payout.dto.ts'), 'utf8');
const me = readFileSync(join(__dirname, 'sales-partner-me.controller.ts'), 'utf8');
const payout = readFileSync(join(__dirname, 'sales-partner-payout.service.ts'), 'utf8');

assert(/currentPassword/.test(dto), 'iban dto accepts currentPassword');
assert(/consumeSessionGrant[\s\S]{0,80}sales_partner_password/.test(service), 'iban reuses OTP session grant');
assert(/ibanChangedAt/.test(service), 'stores ibanChangedAt');
assert(/sendSms/.test(service) && /شبا/.test(service), 'SMS notice on IBAN change');
assert(/body\.currentPassword/.test(me), 'me controller forwards currentPassword');
assert(/ibanPayoutBlockedUntil/.test(payout), 'payout confirm blocked during IBAN cooldown');

console.log('sales-partner-iban-stepup.spec.ts: OK');
