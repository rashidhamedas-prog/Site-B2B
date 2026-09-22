import {
  canVendorLogin,
  EMPTY_VENDOR_USAGE,
  isVendorRole,
  parseAcceptSlaHours,
  parseSettlementHoldDays,
  parseVendorName,
  toPublicVendor,
  vendorOwnsResource,
  vendorRemovalBlockers,
} from './vendor-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isVendorRole('VENDOR') === true, 'vendor role');
assert(isVendorRole('ADMIN') === false, 'admin is not vendor');
assert(canVendorLogin('INVITED') === true, 'invited may login');
assert(canVendorLogin('ACTIVE') === true, 'active may login');
assert(canVendorLogin('SUSPENDED') === false, 'suspended blocked');
assert(parseAcceptSlaHours(12) === 12, 'sla 12');
assert(parseSettlementHoldDays(0) === 0, 'hold 0 allowed');
assert(parseVendorName('  کیف نور  ') === 'کیف نور', 'trim name');

let slaBad = false;
try {
  parseAcceptSlaHours(0);
} catch {
  slaBad = true;
}
assert(slaBad, 'sla 0 rejected');

let holdBad = false;
try {
  parseSettlementHoldDays(91);
} catch {
  holdBad = true;
}
assert(holdBad, 'hold 91 rejected');

assert(vendorOwnsResource('v-a', 'v-a') === true, 'same vendor');
assert(vendorOwnsResource('v-a', 'v-b') === false, 'horizontal deny');
assert(vendorOwnsResource(undefined, 'v-a') === false, 'missing actor');

assert(vendorRemovalBlockers(EMPTY_VENDOR_USAGE).length === 0, 'clean partner is removable');
assert(
  vendorRemovalBlockers({ ...EMPTY_VENDOR_USAGE, productCount: 2 }).join(' ') === '2 کالا',
  'products block delete',
);
assert(
  vendorRemovalBlockers({
    productCount: 1,
    fulfillmentCount: 2,
    orderItemCount: 3,
    ledgerCount: 4,
  }).length === 4,
  'every history kind blocks delete',
);

const pub = toPublicVendor({
  id: 'id1',
  name: 'کیف',
  phone: '09151111111',
  status: 'INVITED',
  acceptSlaHours: 12,
  settlementHoldDays: 7,
  userId: 'u1',
  notes: null,
  invitedAt: new Date('2026-09-09T00:00:00Z'),
  createdAt: new Date('2026-09-09T00:00:00Z'),
  updatedAt: new Date('2026-09-09T00:00:00Z'),
});
assert(pub.status === 'INVITED', 'public status');
assert(!('passwordHash' in pub), 'no hash on public');
assert(!('initialPassword' in pub), 'no initial password on public');

console.log('vendor-policy.spec.ts: OK');
