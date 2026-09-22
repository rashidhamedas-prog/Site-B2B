import {
  canSalesPartnerCreateDraft,
  canSalesPartnerLogin,
  canTransitionProfile,
  humanProfileStatus,
  isSalesPartnerPurpose,
  maskIban,
  maskPhone,
  normalizeIban,
  parseDisplayName,
  salesPartnerOwnsResource,
  toPublicSalesPartner,
} from './sales-partner-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isSalesPartnerPurpose('sales_partner'), 'purpose');
assert(!isSalesPartnerPurpose('vendor'), 'not vendor');
assert(!isSalesPartnerPurpose('retail'), 'not retail');
assert(canTransitionProfile('PENDING_REVIEW', 'ACTIVE'), 'approve');
assert(!canTransitionProfile('PENDING_REVIEW', 'SUSPENDED'), 'no skip');
assert(canTransitionProfile('ACTIVE', 'SUSPENDED'), 'suspend');
assert(!canTransitionProfile('REJECTED', 'ACTIVE'), 'rejected terminal');
assert(!canTransitionProfile('CLOSED', 'ACTIVE'), 'closed terminal');
assert(canSalesPartnerLogin('ACTIVE'), 'active login');
assert(!canSalesPartnerLogin('PENDING_REVIEW'), 'pending no login');
assert(!canSalesPartnerLogin('SUSPENDED'), 'suspended no login');
assert(canSalesPartnerCreateDraft('ACTIVE'), 'active draft');
assert(!canSalesPartnerCreateDraft('SUSPENDED'), 'suspended no draft');
assert(salesPartnerOwnsResource('a', 'a'), 'owner');
assert(!salesPartnerOwnsResource('a', 'b'), 'idor');
assert(!salesPartnerOwnsResource(null, 'a'), 'missing actor');
assert(parseDisplayName('  نگار  ') === 'نگار', 'name trim');
try {
  parseDisplayName('ا');
  throw new Error('short name should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'INVALID_DISPLAY_NAME', 'short name');
}
assert(normalizeIban('ir 120170000000123456789012') === 'IR120170000000123456789012', 'iban');
assert(maskIban('IR120170000000123456789012') === 'IR12****9012', 'mask iban');
assert(maskPhone('09151234567') === '0915***67', 'mask phone');
const pub = toPublicSalesPartner({
  id: 'p1',
  displayName: 'نگار',
  status: 'ACTIVE',
  phone: '09151234567',
  ibanLast4: '9012',
  termsAcceptedAt: new Date('2026-09-22T00:00:00.000Z'),
});
assert(!pub.phoneMasked.includes('34567'), 'no raw phone');
assert(pub.ibanMasked === 'IR****9012', 'iban last4');
assert(pub.statusLabel === humanProfileStatus('ACTIVE'), 'label');

console.log('sales-partner-policy.spec.ts: OK');
