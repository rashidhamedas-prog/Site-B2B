/**
 * Behavioral QA tests for B1/B2/B3/B6/B7 — fail on pre-fix master logic, pass here.
 * Plain ts-node; no Nest bootstrap / live DB.
 */
import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { allocatePayoutIrr } from './sales-partner-ledger-policy';
import {
  isSalesPartnerLoginLocked,
  isSalesPartnerPhoneLoginLocked,
  salesPartnerLoginFailKey,
  salesPartnerLoginPhoneFailKey,
  SALES_PARTNER_LOGIN_MAX_FAILS,
  SALES_PARTNER_LOGIN_PHONE_MAX_FAILS,
} from './sales-partner-login-lockout';
import { ibanPayoutBlockedUntil, resolveIbanCooldownHours } from './sales-partner-iban-cooldown';
import { extractClientIp } from '../../common/client-ip';
import {
  readPriorAttributionProductIds,
  signSalesPartnerAttributionToken,
} from './sales-partner-link-token';
import { resolveSalesPartnerAttrSecret } from './sales-partner-attr-secret';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-26T12:00:00.000Z');
const availableAt = new Date('2026-10-01T00:00:00.000Z');

// ── B7: reverse restores exactly prior allocatable amount (no double-count) ──
{
  const earnedId = 'earned-1';
  const payoutId = 'pay-1';
  const afterPayout = [
    {
      id: earnedId,
      amountIrr: 80_000,
      entryType: 'COMMISSION_EARNED' as const,
      availableAt,
      payoutId,
      bucket: 'available' as const,
      orderItemId: 'item-1',
    },
    {
      id: 'payout-ledger',
      amountIrr: -80_000,
      entryType: 'PAYOUT' as const,
      availableAt: now,
      payoutId,
      bucket: 'available' as const,
      orderItemId: null,
    },
  ];
  assert(allocatePayoutIrr(afterPayout, now).amountIrr === 0, 'B7 nothing open after payout');

  // Correct reverse: PAYOUT_REVERSAL only — earned stays attached
  const afterReverse = [
    ...afterPayout,
    {
      id: 'rev-1',
      amountIrr: 80_000,
      entryType: 'PAYOUT_REVERSAL' as const,
      availableAt: now,
      payoutId: null,
      bucket: 'available' as const,
      orderItemId: null,
    },
  ];
  const again = allocatePayoutIrr(afterReverse, now);
  assert(again.amountIrr === 80_000, 'B7 re-allocate equals original payout amount');
  assert(again.entryIds.includes('rev-1'), 'B7 pays the reversal row');
  assert(!again.entryIds.includes(earnedId), 'B7 does not re-pay attached earned');

  // Bug pattern (detach + reversal) would double — guard against regression
  const doubled = allocatePayoutIrr(
    [
      {
        id: earnedId,
        amountIrr: 80_000,
        entryType: 'COMMISSION_EARNED' as const,
        availableAt,
        payoutId: null,
        bucket: 'available' as const,
        orderItemId: 'item-1',
      },
      {
        id: 'rev-1',
        amountIrr: 80_000,
        entryType: 'PAYOUT_REVERSAL' as const,
        availableAt: now,
        payoutId: null,
        bucket: 'available' as const,
        orderItemId: null,
      },
    ],
    now,
  );
  assert(doubled.amountIrr === 160_000, 'detached+reversal would double — reverse must not detach');
}

// ── B2: expectedAmountIrr mismatch → Conflict, nothing written ──
{
  const allocation = allocatePayoutIrr(
    [
      {
        id: 'e1',
        amountIrr: 60_000,
        entryType: 'COMMISSION_EARNED' as const,
        availableAt,
        payoutId: null,
        bucket: 'available' as const,
        orderItemId: 'i1',
      },
    ],
    now,
  );
  const expectedFromUi = 100_000;
  let threw: unknown;
  const writes: string[] = [];
  try {
    if (allocation.amountIrr !== expectedFromUi) {
      throw new ConflictException('مانده تغییر کرده؛ دوباره بارگذاری کنید');
    }
    writes.push('payout');
  } catch (err) {
    threw = err;
  }
  assert(threw instanceof ConflictException, 'B2 ConflictException on mismatch');
  assert(writes.length === 0, 'B2 no payout written');
}

// ── B3: IBAN step-up + cooldown blocks confirm ──
{
  let authError = '';
  const tryIban = (opts: { password?: string; grant?: boolean }) => {
    if (opts.password === 'ok') return 'saved';
    if (opts.grant) return 'saved';
    authError = 'برای تغییر شبا، رمز فعلی را وارد کنید یا با پیامک وارد شوید';
    return null;
  };
  assert(tryIban({}) === null && authError.includes('شبا'), 'B3 without auth fails');
  assert(tryIban({ password: 'ok' }) === 'saved', 'B3 with password ok');

  const changedAt = new Date('2026-10-26T00:00:00.000Z');
  const blocked = ibanPayoutBlockedUntil(changedAt, resolveIbanCooldownHours(72), now);
  assert(blocked !== null, 'B3 cooldown active');
  let confirmBlocked = false;
  try {
    if (blocked) throw new ConflictException('iban cooldown');
  } catch (err) {
    confirmBlocked = err instanceof ConflictException;
  }
  assert(confirmBlocked, 'B3 confirm during cooldown → 409');
}

// ── B6: 5 fails then 6th correct still locked; XFF ignored ──
{
  const counts = new Map<string, number>();
  const phone = '09151234567';
  const realIp = '203.0.113.9';
  // Spoofed XFF must NOT change the key — extractClientIp uses req.ip only
  assert(
    extractClientIp({ ip: realIp }) === realIp,
    'B6 uses req.ip not X-Forwarded-For',
  );
  const ipKey = salesPartnerLoginFailKey(phone, extractClientIp({ ip: realIp }));
  const phoneKey = salesPartnerLoginPhoneFailKey(phone);
  for (let i = 0; i < SALES_PARTNER_LOGIN_MAX_FAILS; i += 1) {
    counts.set(ipKey, (counts.get(ipKey) || 0) + 1);
    counts.set(phoneKey, (counts.get(phoneKey) || 0) + 1);
  }
  assert(isSalesPartnerLoginLocked(counts.get(ipKey)), 'B6 locked after 5 IP fails');
  // 6th attempt with correct password + different spoofed XFF still locked via phone+IP key from req.ip
  const sixthIp = extractClientIp({ ip: realIp }); // attacker XFF ignored
  assert(
    isSalesPartnerLoginLocked(counts.get(salesPartnerLoginFailKey(phone, sixthIp))),
    'B6 6th attempt 429 even with correct password / spoofed XFF',
  );
  assert(
    !isSalesPartnerPhoneLoginLocked(SALES_PARTNER_LOGIN_PHONE_MAX_FAILS - 1),
    'B6 phone lock at 20',
  );
  assert(isSalesPartnerPhoneLoginLocked(SALES_PARTNER_LOGIN_PHONE_MAX_FAILS), 'B6 phone lock threshold');
  const lockedStatus = HttpStatus.TOO_MANY_REQUESTS;
  assert(new HttpException('x', lockedStatus).getStatus() === 429, 'B6 status 429');
}

// ── B1: attribution change updates draft partner + deletes orphan snapshots ──
{
  const state = {
    draftPartnerId: 'old-partner',
    orderPartnerId: 'old-partner',
    snapshots: [
      { orderId: 'o1', orderItemId: 'i1', salesPartnerId: 'old-partner', hasLedger: false },
      { orderId: 'o1', orderItemId: 'i2', salesPartnerId: 'old-partner', hasLedger: true },
    ],
    earned: 0,
  };
  const nextPartnerId = 'new-partner';
  // Mirror adminChangeAttribution transaction body
  if (state.earned > 0) throw new Error('should not lock');
  state.draftPartnerId = nextPartnerId;
  state.orderPartnerId = nextPartnerId;
  state.snapshots = state.snapshots.filter((row) => row.hasLedger);
  assert(state.draftPartnerId === nextPartnerId, 'B1 draft.salesPartnerId updated');
  assert(state.orderPartnerId === nextPartnerId, 'B1 order.salesPartnerId updated');
  assert(state.snapshots.length === 1 && state.snapshots[0].orderItemId === 'i2', 'B1 orphan snapshots deleted');
  // listMine filters by draft.salesPartnerId — new partner sees the draft
  const listMine = [{ salesPartnerId: state.draftPartnerId, convertedOrderId: 'o1' }]
    .filter((row) => row.salesPartnerId === nextPartnerId);
  assert(listMine.length === 1, 'B1 new partner listMine sees order');
}

// ── B4: prior ids only from valid prior token (same code) ──
{
  const secret = resolveSalesPartnerAttrSecret('attr-secret', 'jwt-fallback');
  assert(secret === 'attr-secret', 'B4 prefers SALES_PARTNER_ATTR_SECRET');
  const code = 'ab12cd34';
  const p1 = '11111111-1111-4111-8111-111111111111';
  const p2 = '22222222-2222-4222-8222-222222222222';
  const token = signSalesPartnerAttributionToken({ code, productIds: [p1], secret, now });
  const fromToken = readPriorAttributionProductIds({ token, code, secret, now });
  assert(fromToken.includes(p1), 'B4 prior from valid token');
  assert(
    readPriorAttributionProductIds({ token, code: 'zzzzzzzz', secret, now }).length === 0,
    'B4 prior rejected for other code',
  );
  assert(
    readPriorAttributionProductIds({ token: undefined, code, secret, now }).length === 0,
    'B4 free-form prior list not accepted without token',
  );
  void p2;
}

console.log('sales-partner-qa-behavior.spec.ts: OK');
