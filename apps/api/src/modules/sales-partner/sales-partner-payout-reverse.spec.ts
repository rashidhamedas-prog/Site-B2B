import { ledgerBalance } from './sales-partner-ledger-policy';

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

const afterPayout = ledgerBalance(
  [
    { amountIrr: 80_000, entryType: 'COMMISSION_EARNED', availableAt, payoutId: 'pay-1' },
    { amountIrr: -80_000, entryType: 'PAYOUT', availableAt: now, payoutId: 'pay-1' },
  ],
  now,
);
assert(afterPayout.available === 0 && afterPayout.paid === 80_000, 'after payout');

/** Reverse: PAYOUT_REVERSAL + detach payoutId on earned → balances return to pre-payout. */
const afterReverse = ledgerBalance(
  [
    { amountIrr: 80_000, entryType: 'COMMISSION_EARNED', availableAt, payoutId: null },
    { amountIrr: -80_000, entryType: 'PAYOUT', availableAt: now, payoutId: 'pay-1' },
    { amountIrr: 80_000, entryType: 'PAYOUT_REVERSAL', availableAt: now, payoutId: null },
  ],
  now,
);
assert(afterReverse.available === beforePayout.available, 'balances return to pre-payout');
assert(afterReverse.held === beforePayout.held, 'held unchanged');

console.log('sales-partner-payout-reverse.spec.ts: OK');
