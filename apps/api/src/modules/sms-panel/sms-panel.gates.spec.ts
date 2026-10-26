import * as assert from 'node:assert/strict';
import { MockSmsProvider } from './provider/mock.provider';
import { availableCreditFrom, CREDIT_RESERVE_STATUSES } from './sms-panel.credit';
import {
  hashSmsToken,
  isValidCampaignOtpLength,
  normalizeCampaignOtp,
  otpHashMatches,
} from './sms-panel.otp-logic';
import {
  assertSendAllowed,
  blocksDispatchResend,
  checkFourEyesApproval,
  checkSendSingleAllowed,
  DISPATCH_CLAIMABLE_STATUSES,
} from './sms-panel.policy';
import { confirmationTokenActive, tokenFlow } from './sms-panel.token-logic';

// --- OTP hash verify ---
const otpPlain = '482913';
const otpStored = hashSmsToken(otpPlain);
assert.ok(otpHashMatches(otpStored, otpPlain));
assert.ok(!otpHashMatches(otpStored, '000000'));
assert.ok(!isValidCampaignOtpLength(normalizeCampaignOtp('1234')));
assert.ok(isValidCampaignOtpLength(normalizeCampaignOtp('۱۲۳۴۵۶')));

// --- Role gates ---
const denyMarketerTx = checkSendSingleAllowed('SMS_MARKETER', 'TRANSACTIONAL');
assert.ok(denyMarketerTx?.kind === 'FORBIDDEN');
const denyMarketerOtp = checkSendSingleAllowed('SMS_MARKETER', 'OTP');
assert.ok(denyMarketerOtp?.kind === 'FORBIDDEN');
const denyOperatorPromo = checkSendSingleAllowed('SMS_OPERATOR', 'PROMO');
assert.ok(denyOperatorPromo?.kind === 'FORBIDDEN');
const denyOperatorFreeText = checkSendSingleAllowed('SMS_OPERATOR', 'TRANSACTIONAL', {
  body: 'free text',
});
assert.ok(denyOperatorFreeText?.code === 'SMS_TEMPLATE_REQUIRED');
assert.ok(
  !checkSendSingleAllowed('SMS_OPERATOR', 'TRANSACTIONAL', { templateId: 't1' }),
);
assert.doesNotThrow(() => assertSendAllowed('SMS_MARKETER', 'PROMO'));
assert.throws(() => assertSendAllowed('SMS_MARKETER', 'OTP'), /FORBIDDEN/);

// --- PENDING_UNKNOWN / dispatch ---
async function runMockTimeout() {
  const m = new MockSmsProvider();
  m.setScenario('timeout');
  const to = await m.sendSingle({ to: '09121234567', body: 'hi', idempotencyKey: 'k-timeout' });
  assert.ok(!to.ok && to.error?.code === 'TIMEOUT' && to.error.ambiguous === true);
}
assert.ok(blocksDispatchResend('PENDING_UNKNOWN'));
assert.ok(!blocksDispatchResend('QUEUED'));
assert.ok(DISPATCH_CLAIMABLE_STATUSES.includes('QUEUED'));
assert.ok(!DISPATCH_CLAIMABLE_STATUSES.includes('PENDING_UNKNOWN' as any));

// --- Credit reservation ---
assert.strictEqual(availableCreditFrom(1000, 320), 680);
assert.strictEqual(availableCreditFrom(100, 500), 0);
assert.deepStrictEqual(CREDIT_RESERVE_STATUSES, ['QUEUED', 'SENDING', 'PAUSED']);

// --- Token expired / reused ---
const flow = tokenFlow({
  campaignId: 'c1',
  audienceSnapshotHash: 'a1',
  body: 'hello\nلغو11',
  scheduledAt: null,
});
assert.ok(!flow.stale(flow.payload));
const activeConf = {
  usedAt: null as Date | null,
  expiresAt: new Date(Date.now() + 60_000),
};
assert.ok(confirmationTokenActive(activeConf));
assert.ok(!confirmationTokenActive({ ...activeConf, usedAt: new Date() }));
assert.ok(
  !confirmationTokenActive({
    usedAt: null,
    expiresAt: new Date(Date.now() - 1000),
  }),
);

// --- Four eyes ---
assert.ok(checkFourEyesApproval('u1', 'u1')?.code === 'SMS_FOUR_EYES');
assert.ok(!checkFourEyesApproval('u2', 'u1'));

runMockTimeout()
  .then(() => {
    console.log('sms-panel gates: OK');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
