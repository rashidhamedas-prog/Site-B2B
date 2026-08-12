import { PaymentMetrics, maskMobile } from './payment-metrics';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(maskMobile('09121234567')?.endsWith('4567'), 'mask keeps last4');
  assert(maskMobile('09121234567')?.startsWith('*'), 'mask stars');
  const m = new PaymentMetrics();
  m.incr('payment_start_total');
  m.incr('payment_start_total');
  m.incr('payment_success_total');
  const snap = m.snapshot();
  assert(snap.payment_start_total === 2, 'start count');
  assert(snap.payment_success_total === 1, 'success count');
  assert(snap.payment_failure_total === 0, 'failure zero');
  console.log('payment-metrics.hardening.spec.ts: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
