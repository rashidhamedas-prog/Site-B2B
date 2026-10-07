/**
 * npx ts-node --transpile-only src/components/sales-partners/sp-labels.spec.ts
 */
import assert from 'node:assert/strict';
import {
  SP_APPLICATION_STATUSES,
  SP_APP_STATUS_FA,
  spAppStatusLabel,
  spStatusTone,
} from './sp-labels.ts';

for (const status of SP_APPLICATION_STATUSES) {
  assert.equal(
    typeof SP_APP_STATUS_FA[status],
    'string',
    `missing FA label for ${status}`,
  );
  assert.notEqual(SP_APP_STATUS_FA[status], status, `${status} must not echo raw code`);
}

assert.equal(spAppStatusLabel('PENDING_OTP'), 'در انتظار تأیید پیامکی');
assert.equal(spAppStatusLabel('PENDING_REVIEW'), 'در انتظار بررسی');
assert.equal(spAppStatusLabel('NEED_INFO'), 'نیاز به تکمیل اطلاعات');
assert.equal(spAppStatusLabel('APPROVED'), 'تأییدشده');
assert.equal(spAppStatusLabel('CANCELLED'), 'لغوشده');
assert.equal(
  spAppStatusLabel('PENDING_OTP', 'در انتظار تأیید پیامکی'),
  'در انتظار تأیید پیامکی',
  'prefers matching API label',
);
assert.equal(
  spAppStatusLabel('PENDING_OTP', 'PENDING_OTP'),
  'در انتظار تأیید پیامکی',
  'ignores raw API echo',
);
assert.equal(spAppStatusLabel('UNKNOWN_CODE'), 'UNKNOWN_CODE', 'unknown stays visible');

assert.equal(spStatusTone('PENDING_OTP'), 'warn');
assert.equal(spStatusTone('APPROVED'), 'ok');
assert.equal(spStatusTone('REJECTED'), 'danger');

console.log('sp-labels.spec.ts: OK');
