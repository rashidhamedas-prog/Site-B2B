import { canEnterRetailShopper, isB2cCustomer, wholesalePortalDenial, isRetailOrderType, shopperOrderScope, shopperCanReadOrderType, omitWholesaleOnlyProfileFields } from './shopper-channel';

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

assert(isRetailOrderType('RETAIL_WEBSITE') === true, 'retail website type');
assert(isRetailOrderType('WHOLESALE') === false, 'wholesale type');
assert(shopperOrderScope('retail')?.type === 'RETAIL_WEBSITE', 'retail list type forced');
assert(shopperOrderScope('wholesale')?.type === 'WHOLESALE', 'wholesale list type forced');
assert(shopperCanReadOrderType('retail', 'WHOLESALE') === false, 'retail jwt cannot read wholesale order');
assert(shopperCanReadOrderType('wholesale', 'RETAIL_WEBSITE') === false, 'wholesale jwt cannot read retail order');
assert(shopperCanReadOrderType('retail', 'RETAIL_WEBSITE') === true, 'retail jwt reads retail order');

const retailProfile = omitWholesaleOnlyProfileFields(
  { ownerName: 'علی', creditLimit: 1, segment: 'A', customerCode: 'TRN-1', balance: 0 },
  'retail',
);
assert(!('creditLimit' in retailProfile), 'retail omits creditLimit');
assert(!('segment' in retailProfile), 'retail omits segment');
assert(!('customerCode' in retailProfile), 'retail omits customerCode');
assert(retailProfile.balance === 0, 'retail keeps balance');
assert(
  'creditLimit' in omitWholesaleOnlyProfileFields({ creditLimit: 5 }, 'wholesale'),
  'wholesale keeps creditLimit',
);

console.log('shopper-channel.spec.ts: OK');
