import {
  advanceLedgerCursor,
  allocatePayoutIrr,
  availableAtFromDelivery,
  boundedIdempotencyKey,
  canAutoRelease,
  earnedIdempotencyKey,
  isPayableEarned,
  ledgerBalance,
  partnerTotalsFromBucketRows,
  payoutIdempotencyKey,
  reversalIdempotencyKey,
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
assert(earnedIdempotencyKey('o1', 'i1').startsWith('sp:earned:'), 'earned key is hashed');
assert(earnedIdempotencyKey('o1', 'i1').length <= 80, 'earned key fits');
assert(earnedIdempotencyKey('o1', 'i1') === earnedIdempotencyKey('o1', 'i1'), 'earned key stable');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: now, payoutId: null }, now) === true, 'payable');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: null, payoutId: null }, now) === false, 'held not payable');
assert(isPayableEarned({ amountIrr: 10, entryType: 'COMMISSION_EARNED', availableAt: now, payoutId: 'p1' }, now) === false, 'already paid');

const heldReversal = ledgerBalance(
  [
    { amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: later },
    { amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'held' },
  ],
  now,
);
assert(heldReversal.held === 80_000, 'held reversal stays in held');
assert(heldReversal.available === 0, 'held reversal does not make available negative');
assert(heldReversal.debt === 0, 'partial held reversal is not debt');

const clawback = ledgerBalance(
  [
    { amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: now, payoutId: 'paid' },
    { amountIrr: -100_000, entryType: 'PAYOUT', availableAt: now },
    { amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'available' },
  ],
  now,
);
assert(clawback.available === 0, 'post-payout reversal is not a negative available');
assert(clawback.debt === 20_000, 'post-payout reversal becomes debt');

const payout = allocatePayoutIrr(
  [
    { id: 'e1', amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: now },
    { id: 'r1', amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'available' },
  ],
  now,
);
assert(payout.amountIrr === 80_000, 'payout pays net not gross');
assert(payout.entryIds.includes('e1') && payout.entryIds.includes('r1'), 'payout consumes earning and reversal');

const duringHold = allocatePayoutIrr(
  [
    { id: 'other', orderItemId: 'other', amountIrr: 40_000, entryType: 'COMMISSION_EARNED', availableAt: now },
    { id: 'heldEarn', orderItemId: 'item', amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: later },
    { id: 'heldRev', orderItemId: 'item', amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'available' },
  ],
  now,
);
assert(duringHold.amountIrr === 40_000, 'a reversal still in hold is not paid out against another earning');
assert(!duringHold.entryIds.includes('heldRev') && !duringHold.entryIds.includes('heldEarn'), 'held pair stays open');

const afterHold = allocatePayoutIrr(
  [
    { id: 'earn', orderItemId: 'item', amountIrr: 100_000, entryType: 'COMMISSION_EARNED', availableAt: now },
    { id: 'rev', orderItemId: 'item', amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'held' },
  ],
  now,
);
assert(afterHold.amountIrr === 80_000, 'released earning pays net even if the reversal bucket was not flipped yet');
assert(afterHold.entryIds.includes('rev'), 'released reversal is consumed with its earning');

const future = allocatePayoutIrr(
  [
    { id: 'e2', amountIrr: 50_000, entryType: 'COMMISSION_EARNED', availableAt: now },
    { id: 'debt', amountIrr: -20_000, entryType: 'COMMISSION_REVERSAL', availableAt: now, bucket: 'available' },
  ],
  now,
);
assert(future.amountIrr === 30_000, 'new earning absorbs prior debt');

const orderId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const rmaId = '33333333-3333-4333-8333-333333333333';
const reversalKey = reversalIdempotencyKey(orderId, itemId, `RMA:${rmaId}`);
assert(reversalKey.length <= 80, 'reversal key fits varchar(80)');
assert(!reversalKey.includes(orderId), 'reversal key is hashed not concatenated uuids');
assert(reversalIdempotencyKey(orderId, itemId, `RMA:${rmaId}`) === reversalKey, 'reversal key stable');
assert(reversalIdempotencyKey(orderId, itemId, 'CANCELLED') !== reversalKey, 'different reason is a different key');

const partnerId = '44444444-4444-4444-8444-444444444444';
const payKey = payoutIdempotencyKey(partnerId, 'req-a');
assert(payKey.length <= 80, 'payout key fits varchar(80)');
assert(payoutIdempotencyKey(partnerId, 'req-b') !== payKey, 'different payout request is a different key');
assert(boundedIdempotencyKey('payout', 'a'.repeat(200)).length <= 80, 'long identity does not truncate-collide');

const page = Array.from({ length: 50 }, (_, index) => ({
  id: `id-${index}`,
  updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
}));
const mid = advanceLedgerCursor(page, 50);
assert(mid.wrapped === false && mid.cursorId === 'id-49', 'full page keeps cursor on the last row');
const tail = advanceLedgerCursor(page.slice(0, 3), 50);
assert(tail.wrapped === true && tail.cursorAt === null, 'short page wraps so older rows are visited again');

const split = partnerTotalsFromBucketRows([
  { salesPartnerId: 'p-a', bucket: 'held', amountIrr: 75_000 },
  { salesPartnerId: 'p-b', bucket: 'held', amountIrr: 25_000 },
  { salesPartnerId: 'p-b', bucket: 'available', amountIrr: -10_000 },
  { salesPartnerId: 'p-a', bucket: 'paid', amountIrr: 5_000 },
  { salesPartnerId: 'p-a', bucket: 'reversed', amountIrr: 1_000 },
  { salesPartnerId: 'p-z', bucket: 'skip', amountIrr: 0 },
]);
assert(split.find((row) => row.salesPartnerId === 'p-z') == null, 'skipped partner omitted');
assert(split.find((row) => row.salesPartnerId === 'p-a')?.held === 75_000, 'held belongs to p-a');
assert(split.find((row) => row.salesPartnerId === 'p-a')?.paid === 5_000, 'manual payout belongs to p-a');
assert(split.find((row) => row.salesPartnerId === 'p-b')?.debt === 10_000, 'negative available is that partner debt');
assert(split.find((row) => row.salesPartnerId === 'p-b')?.available === 0, 'debt clamp clears available');
assert(split.reduce((sum, row) => sum + row.held, 0) === 100_000, 'held rows sum');

console.log('sales-partner-ledger-policy.spec.ts: OK');
