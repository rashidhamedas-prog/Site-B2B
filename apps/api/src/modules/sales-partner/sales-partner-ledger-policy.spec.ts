import {
  availableAtFromDelivery,
  canAutoRelease,
  earnedIdempotencyKey,
  isPayableEarned,
  ledgerBalance,
} from './sales-partner-ledger-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-09-22T12:00:00.000Z');
const later = new Date('2026-10-22T12:00:00.000Z');
const bal = ledgerBalance(
  [
    { amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: later },
    { amountIrr: 40_000, entryType: 'COMMISSION_EARNED', availableAt: new Date('2026-09-01T00:00:00.000Z') },
    { amountIrr: -10_000, entryType: 'COMMISSION_REVERSAL', availableAt: now },
    { amountIrr: -20_000, entryType: 'PAYOUT', availableAt: now },
  ],
  now,
);
assert(bal.held === 100_000, 'held');
assert(bal.available === 10_000, 'available after reversal and payout');
const pending = ledgerBalance(
  [{ amountIrr: 50_000, entryType: 'COMMISSION_EARNED', availableAt: null }],
  now,
);
assert(pending.held === 50_000 && pending.available === 0, 'null availableAt stays held');
assert(bal.paid === 20_000, 'paid');
assert(bal.reversed === 10_000, 'reversed');
assert(!canAutoRelease(null), 'no hold');
assert(!canAutoRelease(0), 'zero hold');
assert(canAutoRelease(14), 'hold set');
assert(availableAtFromDelivery(new Date('2026-09-01T00:00:00.000Z'), 10).toISOString() === '2026-09-11T00:00:00.000Z', 'hold clock');
assert(earnedIdempotencyKey('o1', 'i1') === 'sales-partner-earned:o1:i1', 'idemp');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: now, payoutId: null }, now) === true, 'payable');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: null, payoutId: null }, now) === false, 'held not payable');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: now, payoutId: 'p1' }, now) === false, 'already paid');

console.log('sales-partner-ledger-policy.spec.ts: OK');
