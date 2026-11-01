import * as assert from 'node:assert/strict';
import {
  auditPayloadForSmsAttempt,
  buildCredentialsSmsAttempt,
  buildLastSmsAttempt,
  formatLastSmsAttemptFa,
  pendingOtpDryRunPreview,
} from './sales-partner-sms-attempt';

const phone = '09123456789';

const failed = buildLastSmsAttempt('otp', phone, 'failed', {
  errorCode: 'PROVIDER',
  errorMessage: 'خطای تست',
  via: 'direct',
  durationMs: 42,
});
assert.equal(failed.result, 'failed');
assert.ok(failed.phoneMasked.includes('***'));
assert.ok(!failed.phoneMasked.includes('3456789'));

const pending = buildLastSmsAttempt('otp', phone, 'pending', {
  errorCode: 'TIMEOUT',
  errorMessage: 'aborted',
  via: 'egress',
  durationMs: 12000,
});
assert.equal(pending.result, 'pending');

const audit = auditPayloadForSmsAttempt(failed);
assert.equal(audit.result, 'failed');
assert.ok(!JSON.stringify(audit).includes(phone));
assert.ok(!JSON.stringify(audit).includes('password'));
assert.ok(!JSON.stringify(audit).includes('123456'));

assert.match(formatLastSmsAttemptFa(failed) || '', /ناموفق/);
assert.match(formatLastSmsAttemptFa(pending) || '', /در انتظار|ناموفق|علت/);

const cred = buildCredentialsSmsAttempt(phone, false);
assert.equal(cred.result, 'failed');
assert.equal(cred.purpose, 'credentials');

const dry = pendingOtpDryRunPreview([
  { id: 'a1', displayName: 'زهرا', phone, createdAt: new Date('2026-10-29T00:00:00Z') },
]);
assert.equal(dry.count, 1);
assert.ok(dry.items[0]!.phoneMasked.includes('***'));
assert.ok(!JSON.stringify(dry).includes(phone));

console.log('sales-partner-sms-attempt.spec.ts: ok');
