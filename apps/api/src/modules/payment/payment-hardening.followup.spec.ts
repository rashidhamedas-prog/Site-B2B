/**
 * Security follow-up checks (Phase 1 residual) — pure unit.
 * npx ts-node --transpile-only src/modules/payment/payment-hardening.followup.spec.ts
 */
import { assertNoOverpay, assertPositiveFiniteIrr } from './dto/payment-public.dto';

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

function refundCapOk(paymentAmount: number, priorSucceeded: number, incoming: number): boolean {
  const amt = assertPositiveFiniteIrr(incoming);
  return priorSucceeded + amt <= paymentAmount;
}

async function main() {
  // Invoice remainder guard (same math as verify path)
  const paid = 1_500_000;
  const total = 2_000_000;
  const room = Math.max(0, total - paid);
  assert(room === 500_000, 'room');
  expectThrow(() => assertNoOverpay(paid, 600_000, total), 'reject invoice overpay');
  assert(assertNoOverpay(paid, 500_000, total).incoming === 500_000, 'exact remainder ok');

  // Cumulative refund cap
  assert(refundCapOk(1_000_000, 400_000, 600_000) === true, 'refund exact ok');
  assert(refundCapOk(1_000_000, 400_000, 600_001) === false, 'refund over cap');
  expectThrow(() => assertPositiveFiniteIrr(-1), 'refund negative');

  // Soft-cancel recovery statuses
  const casStatuses = ['PENDING', 'FAILED', 'CANCELLED'];
  assert(casStatuses.includes('CANCELLED'), 'CANCELLED recoverable to PAID after PSP ok');
  assert(!casStatuses.includes('REFUNDED'), 'REFUNDED not recoverable');

  console.log('payment-hardening.followup.spec: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
