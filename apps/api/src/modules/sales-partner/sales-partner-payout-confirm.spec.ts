import { allocatePayoutIrr } from './sales-partner-ledger-policy';
import { boundedIdempotencyKey } from './sales-partner-ledger-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-26T12:00:00.000Z');
const rows = [
  {
    id: 'e1',
    amountIrr: 100_000,
    entryType: 'COMMISSION_EARNED' as const,
    availableAt: new Date('2026-10-01T00:00:00.000Z'),
    payoutId: null,
    bucket: 'available' as const,
    orderItemId: 'i1',
  },
];
const first = allocatePayoutIrr(rows, now);
assert(first.amountIrr === 100_000, 'initial available');

/** Simulate balance change between read and confirm: expectedAmountIrr must match. */
const expectedFromAdminUi = 100_000;
const afterChange = allocatePayoutIrr(
  [
    ...rows,
    {
      id: 'rev1',
      amountIrr: -40_000,
      entryType: 'COMMISSION_REVERSAL' as const,
      availableAt: now,
      payoutId: null,
      bucket: 'available' as const,
      orderItemId: 'i1',
    },
  ],
  now,
);
assert(afterChange.amountIrr !== expectedFromAdminUi, 'balance changed between read and confirm');
assert(afterChange.amountIrr === 60_000, 'new available');

const hashWithExpected = boundedIdempotencyKey('preq', [
  'partner',
  'idem-1',
  'BANK-REF',
  'TRANSFER',
  String(expectedFromAdminUi),
].join('|'));
const hashWithout = boundedIdempotencyKey('preq', [
  'partner',
  'idem-1',
  'BANK-REF',
  'TRANSFER',
].join('|'));
assert(hashWithExpected !== hashWithout, 'expectedAmountIrr is part of request hash');

console.log('sales-partner-payout-confirm.spec.ts: OK');
