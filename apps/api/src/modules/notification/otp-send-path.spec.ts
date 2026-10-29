import * as assert from 'node:assert/strict';
import { chooseOtpSendPath, otpPathIsTransactional } from './otp-send-path';

const verify = chooseOtpSendPath({ otpTemplateId: 123456, lineService: '3000' });
assert.equal(verify.mode, 'transactional');
assert.equal(verify.path, '/send/verify');
assert.equal(otpPathIsTransactional(verify), true);

const fallback = chooseOtpSendPath({ otpTemplateId: '', lineService: '9982007567' });
assert.equal(fallback.mode, 'service_line_fallback');
assert.equal(fallback.path, '/send/bulk');
if (fallback.mode === 'service_line_fallback') {
  assert.equal(fallback.lineNumber, '9982007567');
  assert.match(fallback.warning, /otpTemplateId missing/);
}

const unavailable = chooseOtpSendPath({ otpTemplateId: 0, lineService: '' });
assert.equal(unavailable.mode, 'unavailable');
assert.equal(unavailable.path, null);

// Production often stores "0" as a placeholder — must not call /send/verify with template 0.
const zeroStr = chooseOtpSendPath({ otpTemplateId: '0', lineService: '9982007567' });
assert.equal(zeroStr.mode, 'service_line_fallback');
assert.equal(zeroStr.path, '/send/bulk');

// Never a promo/consent mode
for (const p of [verify, fallback, unavailable]) {
  assert.equal(otpPathIsTransactional(p), true);
  assert.ok(!('consent' in p) && !('quietHours' in p) && !('bulkApproval' in p));
}

console.log('otp-send-path.spec.ts: ok');
