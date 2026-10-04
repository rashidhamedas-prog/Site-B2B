/**
 * npx ts-node --transpile-only src/lib/sp-admin-ops.spec.ts
 */
import assert from 'node:assert/strict';
import {
  actionableDrafts,
  auditTab,
  isActionableDraft,
  matchesApplicationSearch,
  partnerSlicesForBucket,
  payoutIdempotencyKey,
} from '../components/admin/sales-partners/sp-admin-ops.ts';

const base = { id: '1', statusLabel: 'x', merchandiseIrr: 1, convertedOrderId: null, customerPhoneMasked: null };

assert.equal(isActionableDraft({ ...base, status: 'EXPIRED' }), false);
assert.equal(isActionableDraft({ ...base, status: 'DRAFT' }), true);
assert.equal(isActionableDraft({ ...base, status: 'CUSTOMER_CONFIRMED' }), true);
assert.equal(
  isActionableDraft({ ...base, status: 'CONVERTED_TO_ORDER', convertedOrderId: 'o1', orderStatus: 'AWAITING_PAYMENT' }),
  true,
);
assert.equal(
  isActionableDraft({ ...base, status: 'CONVERTED_TO_ORDER', convertedOrderId: 'o1', orderStatus: 'COMPLETED' }),
  false,
);

const queued = actionableDrafts([
  { ...base, id: 'a', status: 'DRAFT', statusLabel: 'd' },
  { ...base, id: 'b', status: 'CUSTOMER_CONFIRMED', statusLabel: 'c' },
  { ...base, id: 'c', status: 'EXPIRED', statusLabel: 'e' },
]);
assert.equal(queued[0]?.id, 'b');
assert.equal(queued.length, 2);

assert.equal(auditTab('payout'), 'payouts');
assert.equal(auditTab('rule'), 'rules');
assert.equal(matchesApplicationSearch({ displayName: 'سارا', phoneMasked: '09***', city: 'مشهد' }, 'مشهد'), true);
assert.equal(payoutIdempotencyKey('p1', '  REF-9  ', 75000), 'ui-p1-75000-REF-9');

const held = partnerSlicesForBucket(
  [
    { salesPartnerId: 'b', held: 25_000, available: 0, paid: 0, reversed: 0, debt: 0 },
    { salesPartnerId: 'a', held: 75_000, available: 0, paid: 5_000, reversed: 0, debt: 0 },
    { salesPartnerId: 'c', held: 0, available: 0, paid: 0, reversed: 0, debt: 0 },
  ],
  'held',
);
assert.deepEqual(held.map((row) => row.salesPartnerId), ['a', 'b']);
assert.equal(held.reduce((sum, row) => sum + row.amountIrr, 0), 100_000);
assert.equal(
  partnerSlicesForBucket(
    [{ salesPartnerId: 'b', held: 0, available: 0, paid: 0, reversed: 0, debt: 10_000 }],
    'debt',
  )[0]?.amountIrr,
  10_000,
);
assert.equal(partnerSlicesForBucket([], 'reversed').length, 0);

console.log('sp-admin-ops.spec.ts ok');
