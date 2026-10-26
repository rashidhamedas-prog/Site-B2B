import { allocatePayoutIrr, ledgerBalance } from './sales-partner-ledger-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-26T12:00:00.000Z');
const availableAt = new Date('2026-10-01T00:00:00.000Z');

const beforePayout = ledgerBalance(
  [{ amountIrr: 80_000, entryType: 'COMMISSION_EARNED', availableAt }],
  now,
);
assert(beforePayout.available === 80_000 && beforePayout.paid === 0, 'pre-payout');

const afterPayoutRows = [
  { amountIrr: 80_000, entryType: 'COMMISSION_EARNED' as const, availableAt, payoutId: 'pay-1' },
  { amountIrr: -80_000, entryType: 'PAYOUT' as const, availableAt: now, payoutId: 'pay-1' },
];
const afterPayout = ledgerBalance(afterPayoutRows, now);
assert(afterPayout.available === 0 && afterPayout.paid === 80_000, 'after payout');

/** Reverse writes PAYOUT_REVERSAL only — earned stay attached (no double-count on re-allocate). */
const afterReverseRows = [
  ...afterPayoutRows,
  { amountIrr: 80_000, entryType: 'PAYOUT_REVERSAL' as const, availableAt: now, payoutId: null },
];
const afterReverse = ledgerBalance(afterReverseRows, now);
assert(afterReverse.available === beforePayout.available, 'balances return to pre-payout');
assert(afterReverse.held === beforePayout.held, 'held unchanged');

const reallocate = allocatePayoutIrr(
  [
    {
      id: 'earned',
      amountIrr: 80_000,
      entryType: 'COMMISSION_EARNED',
      availableAt,
      payoutId: 'pay-1',
      orderItemId: 'i1',
    },
    {
      id: 'rev',
      amountIrr: 80_000,
      entryType: 'PAYOUT_REVERSAL',
      availableAt: now,
      payoutId: null,
      orderItemId: null,
    },
  ],
  now,
);
assert(reallocate.amountIrr === 80_000, 'next confirm allocates original amount only');
assert(reallocate.entryIds.includes('rev') && !reallocate.entryIds.includes('earned'), 'pays reversal not earned');

console.log('sales-partner-payout-reverse.spec.ts: OK');
