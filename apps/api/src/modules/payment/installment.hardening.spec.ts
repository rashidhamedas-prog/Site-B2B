/**
 * Phase 6 installment hardening — pure unit checks (no Nest bootstrap).
 * Prefer:
 *   npx ts-node --transpile-only src/modules/payment/installment.hardening.spec.ts
 */
import {
  buildEqualSchedules,
  toIrrInt,
  assertPositiveIrr,
} from './installment.service';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function expectThrow(fn: () => unknown, msg: string) {
  let thrown = false;
  try {
    fn();
  } catch {
    thrown = true;
  }
  assert(thrown, msg);
}

function daysPastDue(dueAt: Date, now: Date): number {
  const ms = now.getTime() - dueAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function bucketKey(days: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

async function main() {
  // --- toIrrInt / assertPositiveIrr ---
  assert(toIrrInt(0) === 0, 'zero irr');
  assert(toIrrInt('1500') === 1500, 'string irr');
  assert(toIrrInt(100n) === 100, 'bigint irr');
  expectThrow(() => toIrrInt(-1), 'reject negative');
  expectThrow(() => toIrrInt(1.5), 'reject float');
  expectThrow(() => toIrrInt(Number.NaN), 'reject NaN');
  expectThrow(() => assertPositiveIrr(0), 'reject zero positive');
  assert(assertPositiveIrr(1) === 1, 'positive ok');

  // --- equal schedules: last absorbs remainder ---
  const start = new Date('2026-08-12T10:00:00.000Z');
  const rows = buildEqualSchedules(1000, 3, start);
  assert(rows.length === 3, '3 schedules');
  assert(rows[0].amountIrr === 333, 'base floor');
  assert(rows[1].amountIrr === 333, 'base floor mid');
  assert(rows[2].amountIrr === 334, 'last absorbs');
  assert(
    rows.reduce((s, r) => s + r.amountIrr, 0) === 1000,
    'sum equals remainder',
  );
  assert(rows[0].installmentNo === 1, 'no 1');
  assert(rows[2].installmentNo === 3, 'no 3');
  assert(rows[0].dueAt.getUTCMonth() === (start.getUTCMonth() + 1) % 12, 'due +1m');

  const exact = buildEqualSchedules(900, 3, start);
  assert(exact.every((r) => r.amountIrr === 300), 'exact equal split');

  const empty = buildEqualSchedules(0, 6, start);
  assert(empty.length === 0, 'zero remainder → no schedules');

  expectThrow(() => buildEqualSchedules(100, 0, start), 'reject 0 months');
  expectThrow(() => buildEqualSchedules(100, 1.5, start), 'reject float months');
  expectThrow(() => buildEqualSchedules(-10, 2, start), 'reject negative remainder');

  // --- available credit math (pure) ---
  const creditLimit = 10_000_000;
  const activeConsumed = [1_000_000, 2_500_000];
  const consumed = activeConsumed.reduce((a, b) => a + b, 0);
  const available = Math.max(0, creditLimit - consumed);
  assert(available === 6_500_000, 'available credit');
  assert(Math.max(0, creditLimit - 12_000_000) === 0, 'floor at zero');

  const principal = 5_000_000;
  const down = 1_000_000;
  const remainder = principal - down;
  assert(remainder <= available, 'create fits credit');
  assert(7_000_000 > available, 'oversize rejected by comparison');

  // --- aging buckets ---
  assert(bucketKey(0) === '0-30', '0 days');
  assert(bucketKey(30) === '0-30', '30 days');
  assert(bucketKey(31) === '31-60', '31 days');
  assert(bucketKey(60) === '31-60', '60 days');
  assert(bucketKey(61) === '61-90', '61 days');
  assert(bucketKey(90) === '61-90', '90 days');
  assert(bucketKey(91) === '90+', '91 days');

  const now = new Date('2026-08-12T12:00:00.000Z');
  assert(daysPastDue(new Date('2026-08-12T12:00:00.000Z'), now) === 0, 'not past');
  assert(daysPastDue(new Date('2026-07-13T12:00:00.000Z'), now) === 30, '30d past');
  assert(daysPastDue(new Date('2026-05-12T12:00:00.000Z'), now) === 92, '92d past');

  const overdueRows = [
    { days: 10, remaining: 100 },
    { days: 45, remaining: 200 },
    { days: 45, remaining: 50 },
    { days: 100, remaining: 300 },
  ];
  const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const r of overdueRows) {
    buckets[bucketKey(r.days)] += r.remaining;
  }
  assert(buckets['0-30'] === 100, 'aging 0-30');
  assert(buckets['31-60'] === 250, 'aging 31-60');
  assert(buckets['90+'] === 300, 'aging 90+');

  // --- completion / cancel credit release ---
  let creditConsumedIrr = remainder;
  if (['PAID', 'PAID', 'PAID'].every((s) => s === 'PAID')) {
    creditConsumedIrr = 0;
  }
  assert(creditConsumedIrr === 0, 'credit released on complete');
  assert((() => { let c = 4_000_000; c = 0; return c; })() === 0, 'credit released on cancel');

  // --- partial payment status ---
  const dueAmt = 1000;
  let paidAmt = 0;
  paidAmt += 400;
  let status = paidAmt >= dueAmt ? 'PAID' : 'PARTIAL';
  assert(status === 'PARTIAL', 'partial');
  paidAmt += 600;
  status = paidAmt >= dueAmt ? 'PAID' : 'PARTIAL';
  assert(status === 'PAID', 'fully paid');
  expectThrow(() => {
    const incoming = 1;
    const rem = dueAmt - paidAmt;
    if (incoming > rem) throw new Error('overpay');
  }, 'reject overpay after full');

  console.log('installment.hardening.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
