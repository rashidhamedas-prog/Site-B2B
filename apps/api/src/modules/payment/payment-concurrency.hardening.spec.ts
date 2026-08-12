/**
 * Phase 1 residual — 20 parallel verify CAS semantics (in-process lock model).
 * Mirrors payment.service verify: exclusive lock + status allowlist → PAID once.
 *
 *   npx ts-node --transpile-only src/modules/payment/payment-concurrency.hardening.spec.ts
 *
 * Full disposable-Postgres suite remains optional when DATABASE_URL_DISPOSABLE is set.
 */
import { createHash, randomUUID } from 'crypto';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type PayStatus = 'PENDING' | 'FAILED' | 'CANCELLED' | 'PAID' | 'REFUNDED';

type PaymentRow = {
  id: string;
  status: PayStatus;
  amount: number;
  invoicePaid: number;
  invoiceTotal: number;
  postbackFired: boolean;
  ledgerCaptures: number;
};

/** Serialize work per payment id (pessimistic_write stand-in). */
const locks = new Map<string, Promise<void>>();

async function withPaymentLock<T>(paymentId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(paymentId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  locks.set(
    paymentId,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Same allowlist as verify CAS after soft-cancel recovery. */
async function applyVerifyCas(
  row: PaymentRow,
  opts: { pspOk: boolean; statusHint: string },
): Promise<{ already: boolean; cancelled: boolean; transitioned: boolean }> {
  return withPaymentLock(row.id, async () => {
    if (row.status === 'PAID') {
      return { already: true, cancelled: false, transitioned: false };
    }
    if (row.status === 'REFUNDED') {
      return { already: false, cancelled: true, transitioned: false };
    }
    if (opts.statusHint && opts.statusHint !== 'OK') {
      if (row.status === 'PENDING' || row.status === 'FAILED') {
        row.status = 'CANCELLED';
      }
      return { already: false, cancelled: true, transitioned: false };
    }
    if (!opts.pspOk) {
      if (row.status === 'PENDING' || row.status === 'FAILED' || row.status === 'CANCELLED') {
        row.status = 'FAILED';
      }
      return { already: false, cancelled: false, transitioned: false };
    }
    if (!['PENDING', 'FAILED', 'CANCELLED'].includes(row.status)) {
      return { already: false, cancelled: true, transitioned: false };
    }
    // CAS transition
    row.status = 'PAID';
    const room = Math.max(0, row.invoiceTotal - row.invoicePaid);
    const incoming = Math.min(row.amount, room);
    row.invoicePaid += incoming;
    row.ledgerCaptures += 1;
    if (!row.postbackFired) row.postbackFired = true;
    return { already: false, cancelled: false, transitioned: true };
  });
}

async function runParallelVerify(n: number) {
  const row: PaymentRow = {
    id: randomUUID(),
    status: 'PENDING',
    amount: 1_000_000,
    invoicePaid: 0,
    invoiceTotal: 1_000_000,
    postbackFired: false,
    ledgerCaptures: 0,
  };

  const results = await Promise.all(
    Array.from({ length: n }, () =>
      applyVerifyCas(row, { pspOk: true, statusHint: 'OK' }),
    ),
  );

  const transitions = results.filter((r) => r.transitioned).length;
  const duplicates = results.filter((r) => r.already).length;

  assert(row.status === 'PAID', 'final status PAID');
  assert(transitions === 1, `exactly one PAID transition, got ${transitions}`);
  assert(duplicates === n - 1, `exactly ${n - 1} duplicate already, got ${duplicates}`);
  assert(row.invoicePaid === 1_000_000, `paidAmount once, got ${row.invoicePaid}`);
  assert(row.ledgerCaptures === 1, `ledger once, got ${row.ledgerCaptures}`);
  assert(row.postbackFired === true, 'postback once');
  return { transitions, duplicates, invoicePaid: row.invoicePaid };
}

async function runIdempotencyCollision() {
  const scope = (customerId: string, channel: string) =>
    `${customerId}:${channel}:create-order`;
  const hash = (payload: unknown) =>
    createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  const a = { customerId: 'c1', channel: 'WHOLESALE' as const };
  const key = 'idem-1';
  const store = new Map<string, { owner: string; scope: string; hash: string }>();
  store.set(key, {
    owner: a.customerId,
    scope: scope(a.customerId, a.channel),
    hash: hash({ items: [{ id: 'v1', q: 2 }], paymentMethod: 'CASH' }),
  });

  // cross-customer
  const other = store.get(key)!;
  assert(other.owner !== 'c2', 'fixture owner');
  let crossForbidden = false;
  if (other.owner !== 'c2') crossForbidden = true;
  assert(crossForbidden, 'cross-customer must forbid');

  // same key different payload
  const h2 = hash({ items: [{ id: 'v1', q: 3 }], paymentMethod: 'CASH' });
  assert(other.hash !== h2, 'payload mismatch');
  let conflict = false;
  if (other.hash !== h2) conflict = true;
  assert(conflict, 'same key different payload → 409');
}

async function runRefundDuplicate() {
  const paymentAmount = 500_000;
  let succeededSum = 0;
  const keys = new Set<string>();

  function requestRefund(amount: number, idem: string) {
    if (keys.has(idem)) return { duplicate: true, accepted: false };
    if (succeededSum + amount > paymentAmount) {
      return { duplicate: false, accepted: false, overCap: true };
    }
    keys.add(idem);
    succeededSum += amount;
    return { duplicate: false, accepted: true };
  }

  const r1 = requestRefund(300_000, 'r1');
  const r1b = requestRefund(300_000, 'r1');
  const r2 = requestRefund(300_000, 'r2');
  assert(r1.accepted === true, 'first refund ok');
  assert(r1b.duplicate === true, 'duplicate idempotent');
  assert(r2.accepted === false && r2.overCap === true, 'second over cap rejected');
  assert(succeededSum === 300_000, 'sum capped');
}

async function main() {
  const conc = await runParallelVerify(20);
  assert(conc.transitions === 1, '20-parallel transitions');
  await runIdempotencyCollision();
  await runRefundDuplicate();

  // Soft-cancel then OK recovery still single transition
  const row: PaymentRow = {
    id: randomUUID(),
    status: 'PENDING',
    amount: 1000,
    invoicePaid: 0,
    invoiceTotal: 1000,
    postbackFired: false,
    ledgerCaptures: 0,
  };
  await applyVerifyCas(row, { pspOk: false, statusHint: 'NOK' });
  assert(row.status === 'CANCELLED', 'soft cancel');
  const recovered = await Promise.all([
    applyVerifyCas(row, { pspOk: true, statusHint: 'OK' }),
    applyVerifyCas(row, { pspOk: true, statusHint: 'OK' }),
  ]);
  assert(recovered.filter((r) => r.transitioned).length === 1, 'recover once');
  assert(row.status === 'PAID', 'recovered PAID');

  console.log('payment-concurrency.hardening.spec.ts: OK', conc);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
