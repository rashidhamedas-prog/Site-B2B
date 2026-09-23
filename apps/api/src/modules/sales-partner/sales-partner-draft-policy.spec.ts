import {
  canTransitionDraft,
  confirmationSmsText,
  hashConfirmationToken,
  humanDraftStatus,
  humanPartnerOrderStatus,
  isDraftExpired,
  partnerCommissionOverlay,
  maskCustomerPhone,
  priceDriftBps,
} from './sales-partner-draft-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canTransitionDraft('DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION'), 'send');
assert(canTransitionDraft('AWAITING_CUSTOMER_CONFIRMATION', 'CUSTOMER_CONFIRMED'), 'confirm');
assert(canTransitionDraft('CUSTOMER_CONFIRMED', 'CONVERTED_TO_ORDER'), 'convert');
assert(!canTransitionDraft('CONVERTED_TO_ORDER', 'CANCELLED'), 'converted terminal');
assert(!canTransitionDraft('EXPIRED', 'DRAFT'), 'expired terminal');
assert(humanDraftStatus('AWAITING_CUSTOMER_CONFIRMATION') === 'منتظر تأیید مشتری', 'label');
assert(humanPartnerOrderStatus('DRAFT') === 'پیش‌نویس', 'draft wins before convert');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'AWAITING_PAYMENT') === 'منتظر پرداخت', 'unpaid');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'SHIPPED') === 'ارسال‌شده', 'shipped');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'DELIVERED') === 'تحویل‌شده', 'delivered');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'DELIVERED', 'HELD') === 'در انتظار آزادشدن پورسانت', 'hold after delivery');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'DELIVERED', 'AVAILABLE') === 'پورسانت قابل‌برداشت', 'available after hold');
assert(humanPartnerOrderStatus('CONVERTED_TO_ORDER', 'RETURNED') === 'مرجوع‌شده', 'returned');
const holdNow = new Date('2026-09-23T08:00:00.000Z');
assert(
  partnerCommissionOverlay('DELIVERED', [{ entryType: 'COMMISSION_EARNED', availableAt: null }], holdNow) === 'HELD',
  'null availableAt is held',
);
assert(
  partnerCommissionOverlay(
    'DELIVERED',
    [{ entryType: 'COMMISSION_EARNED', availableAt: new Date('2026-09-01T00:00:00.000Z'), payoutId: null }],
    holdNow,
  ) === 'AVAILABLE',
  'past availableAt is withdrawable',
);
assert(
  partnerCommissionOverlay('SHIPPED', [{ entryType: 'COMMISSION_EARNED', availableAt: null }], holdNow) === null,
  'no commission overlay before delivery',
);
const sms = confirmationSmsText('نگار', 'https://example.test/c/abc');
assert(sms.includes('نگار'), 'name');
assert(sms.includes('تأیید نکنید'), 'no charge until confirm');
assert(!sms.includes('درآمد تضمینی') && !sms.includes('فروش قطعی'), 'no hype');
const now = new Date('2026-09-22T12:00:00.000Z');
assert(isDraftExpired(new Date('2026-09-22T11:00:00.000Z'), now), 'expired');
assert(!isDraftExpired(new Date('2026-09-22T13:00:00.000Z'), now), 'fresh');
const token = 'raw-token-value';
const hashed = hashConfirmationToken(token);
assert(hashed !== token && hashed.length === 64, 'token hashed');
assert(hashConfirmationToken(token) === hashed, 'hash stable');
assert(priceDriftBps(100_000, 100_000) === 0, 'no drift');
assert(priceDriftBps(100_000, 101_000) === 100, '100 bps');
assert(maskCustomerPhone('09151234567') === '0915***67', 'mask');

console.log('sales-partner-draft-policy.spec.ts: OK');
