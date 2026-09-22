import {
  canTransitionDraft,
  confirmationSmsText,
  humanDraftStatus,
  isDraftExpired,
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
const sms = confirmationSmsText('نگار', 'https://example.test/c/abc');
assert(sms.includes('نگار'), 'name');
assert(sms.includes('تأیید نکنید'), 'no charge until confirm');
assert(!sms.includes('درآمد تضمینی') && !sms.includes('فروش قطعی'), 'no hype');
const now = new Date('2026-09-22T12:00:00.000Z');
assert(isDraftExpired(new Date('2026-09-22T11:00:00.000Z'), now), 'expired');
assert(!isDraftExpired(new Date('2026-09-22T13:00:00.000Z'), now), 'fresh');

console.log('sales-partner-draft-policy.spec.ts: OK');
