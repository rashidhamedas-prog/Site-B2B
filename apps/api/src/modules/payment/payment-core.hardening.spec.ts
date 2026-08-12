/**
 * Phase 1 payment core hardening — pure unit checks (no Nest bootstrap).
 * Prefer:
 *   npx ts-node --transpile-only src/modules/payment/payment-core.hardening.spec.ts
 */
import {
  assertNoOverpay,
  assertNonNegativeFiniteIrr,
  assertPositiveFiniteIrr,
  toPublicPaymentDto,
} from './dto/payment-public.dto';
import { DisabledPaymentAdapter } from './adapters/disabled.adapter';

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

async function expectReject(fn: () => Promise<unknown>, msg: string) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, msg);
}

async function main() {
  // --- DTO strips meta / non-allowlisted fields ---
  const publicDto = toPublicPaymentDto(
    {
      id: 'pay-1',
      amount: 150000,
      currency: 'IRR',
      gateway: 'ZARINPAL',
      status: 'PAID',
      authority: 'A000',
      refId: 'R1',
      orderId: 'ord-1',
      invoiceId: null,
      paidAt: new Date('2026-08-12T10:00:00.000Z'),
      meta: { secret: 'should-not-leak', merchant_id: 'x' },
      internalNote: 'nope',
    } as any,
    { ok: true, sandbox: true, meta: { injected: true } } as any,
  );

  assert(publicDto.id === 'pay-1', 'dto id');
  assert(publicDto.amount === 150000, 'dto amount');
  assert(publicDto.ok === true, 'dto ok extra');
  assert(publicDto.sandbox === true, 'dto sandbox extra');
  assert(!('meta' in publicDto), 'dto must strip meta');
  assert(!('internalNote' in publicDto), 'dto must strip unknown fields');
  assert(
    !JSON.stringify(publicDto).includes('should-not-leak'),
    'dto must not serialize secrets',
  );

  // --- Amount validation helpers ---
  assert(assertPositiveFiniteIrr(1000) === 1000, 'positive irr');
  assert(assertNonNegativeFiniteIrr(0) === 0, 'zero allowed non-neg');
  expectThrow(() => assertPositiveFiniteIrr(0), 'reject zero');
  expectThrow(() => assertPositiveFiniteIrr(-1), 'reject negative');
  expectThrow(() => assertPositiveFiniteIrr(1.5), 'reject float');
  expectThrow(() => assertPositiveFiniteIrr(Number.NaN), 'reject NaN');
  expectThrow(() => assertPositiveFiniteIrr(Number.POSITIVE_INFINITY), 'reject Infinity');
  expectThrow(() => assertPositiveFiniteIrr('abc'), 'reject non-numeric');

  const overpayOk = assertNoOverpay(1000, 500, 2000);
  assert(overpayOk.incoming === 500, 'no-overpay ok');
  expectThrow(() => assertNoOverpay(1500, 600, 2000), 'reject overpay');
  expectThrow(() => assertNoOverpay(0, -10, 100), 'reject negative incoming');

  // --- Disabled adapter fail-closed ---
  const disabled = new DisabledPaymentAdapter('SNAPPAY');
  const caps = disabled.getCapabilities();
  assert(caps.pay === false, 'disabled pay=false');
  assert(caps.bnpl === false, 'disabled bnpl=false');
  assert(caps.refund === false, 'disabled refund=false');

  await expectReject(
    () =>
      disabled.createPayment({
        amountIrr: 1000,
        callbackUrl: 'https://example.com/cb',
        description: 't',
        merchantId: 'x',
        sandbox: true,
      }),
    'disabled createPayment must fail',
  );
  await expectReject(
    () =>
      disabled.verifyReturn({
        amountIrr: 1000,
        providerToken: 't',
        merchantId: 'x',
        sandbox: true,
      }),
    'disabled verifyReturn must fail',
  );
  await expectReject(
    () => disabled.getPaymentStatus('t', { merchantId: 'x', sandbox: true }),
    'disabled getPaymentStatus must fail',
  );
  await expectReject(
    () => disabled.cancelPayment('t', { merchantId: 'x', sandbox: true }),
    'disabled cancelPayment must fail',
  );
  await expectReject(
    () =>
      disabled.refundPayment({
        providerRefId: 'r',
        amountIrr: 100,
        merchantId: 'x',
        sandbox: true,
      }),
    'disabled refundPayment must fail',
  );

  const wh = await disabled.processWebhook({ anything: true });
  assert(wh.supported === false, 'disabled webhook unsupported');
  const rec = await disabled.reconcile({ since: new Date(), sandbox: true });
  assert(rec.supported === false, 'disabled reconcile unsupported');

  const norm = disabled.normalizeProviderError(new Error('x'));
  assert(norm.code === 'PROVIDER_DISABLED', 'disabled error code');
  assert(norm.retryable === false, 'disabled not retryable');

  console.log('payment-core.hardening.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
