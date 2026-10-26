import {
  DEFAULT_SALES_PARTNER_IBAN_COOLDOWN_HOURS,
  ibanPayoutBlockedUntil,
  resolveIbanCooldownHours,
} from './sales-partner-iban-cooldown';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolveIbanCooldownHours(undefined) === DEFAULT_SALES_PARTNER_IBAN_COOLDOWN_HOURS, 'default 72');
assert(resolveIbanCooldownHours('24') === 24, 'env override');
assert(ibanPayoutBlockedUntil(null, 72) === null, 'no change');

const changed = new Date('2026-10-26T00:00:00.000Z');
const now = new Date('2026-10-26T12:00:00.000Z');
const blocked = ibanPayoutBlockedUntil(changed, 72, now);
assert(blocked !== null && blocked!.getTime() > now.getTime(), 'within cooldown');

const after = new Date('2026-10-30T00:00:00.000Z');
assert(ibanPayoutBlockedUntil(changed, 72, after) === null, 'cooldown elapsed');

console.log('sales-partner-iban-cooldown.spec.ts: OK');
