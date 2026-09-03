import { canEnterRetailShopper, isB2cCustomer, wholesalePortalDenial } from './shopper-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isB2cCustomer({ type: 'B2C' }) === true, 'B2C type');
assert(isB2cCustomer({ type: 'B2B' }) === false, 'B2B type');
assert(isB2cCustomer({ type: 'B2B', notes: 'مصرف‌کننده فروشگاه آنلاین (.ir)' }) === true, 'notes marker');
assert(isB2cCustomer(null) === false, 'null customer');

assert(canEnterRetailShopper({ status: 'ACTIVE' }) === true, 'active retail');
assert(canEnterRetailShopper({ status: 'PENDING' }) === true, 'pending wholesale may shop retail');
assert(canEnterRetailShopper({ status: 'BLOCKED' }) === false, 'blocked no retail');
assert(canEnterRetailShopper({ status: 'SUSPENDED' }) === false, 'suspended no retail');
assert(canEnterRetailShopper(null) === false, 'missing customer');

assert(wholesalePortalDenial({ status: 'ACTIVE', type: 'B2B' }) === null, 'active B2B ok');
assert(
  (wholesalePortalDenial({ status: 'PENDING', type: 'B2B' }) || '').includes('تأیید'),
  'pending message',
);
assert(
  (wholesalePortalDenial({ status: 'ACTIVE', type: 'B2C' }) || '').includes('حساب عمده ندارد'),
  'B2C cannot open portal',
);
assert(wholesalePortalDenial(null) !== null, 'missing customer denied');

console.log('shopper-channel.spec.ts: OK');
