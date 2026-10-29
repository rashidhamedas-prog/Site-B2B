import * as assert from 'node:assert/strict';
import { DisabledSmsProvider } from './disabled.provider';
import { MockSmsProvider } from './mock.provider';
import { SmsIrProvider } from './smsir.provider';
import { lineForMessageClass, resolveSmsSecrets } from './secrets';
import {
  assertTestBlocksRealSmsNetwork,
  createSmsProvider,
  resolveSmsProviderId,
  guardedFetch,
} from './factory';

// --- resolve / factory ---
assert.strictEqual(resolveSmsProviderId({ NODE_ENV: 'test' } as any), 'mock');
assert.strictEqual(resolveSmsProviderId({ NODE_ENV: 'production', SMS_PROVIDER: 'mock' } as any), 'mock');
assert.strictEqual(
  resolveSmsProviderId({ NODE_ENV: 'production', SMS_PROVIDER: 'smsir' } as any),
  'disabled',
);
assert.strictEqual(
  resolveSmsProviderId({
    NODE_ENV: 'production',
    SMS_PROVIDER: 'smsir',
    SMSIR_API_KEY: 'k',
  } as any),
  'smsir',
);

const forced = createSmsProvider({ env: { NODE_ENV: 'test' } as any });
assert.strictEqual(forced.id, 'mock');

const prodDisabled = createSmsProvider({
  env: { NODE_ENV: 'production', SMS_PROVIDER: 'smsir' } as NodeJS.ProcessEnv,
});
assert.strictEqual(prodDisabled.id, 'disabled');

const envWins = resolveSmsSecrets(
  { SMSIR_API_KEY: 'FROM_ENV' } as NodeJS.ProcessEnv,
  { apiKey: 'FROM_DB' },
);
assert.strictEqual(envWins.apiKey, 'FROM_ENV');
assert.strictEqual(envWins.providerMode, 'smsir');

// otpTemplateId: unset Number(0) / "0" must NOT become truthy "0"
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: 0 }).otpTemplateId,
  '',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: '0' }).otpTemplateId,
  '',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: '' }).otpTemplateId,
  '',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: undefined }).otpTemplateId,
  '',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: 123456 }).otpTemplateId,
  '123456',
);
assert.strictEqual(
  resolveSmsSecrets(
    { SMSIR_OTP_TEMPLATE_ID: '999001' } as NodeJS.ProcessEnv,
    { otpTemplateId: 0 },
  ).otpTemplateId,
  '999001',
);
assert.strictEqual(
  resolveSmsSecrets(
    { SMSIR_OTP_TEMPLATE_ID: '0' } as NodeJS.ProcessEnv,
    { otpTemplateId: 123456 },
  ).otpTemplateId,
  '123456',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: NaN }).otpTemplateId,
  '',
);
assert.strictEqual(
  resolveSmsSecrets({} as NodeJS.ProcessEnv, { otpTemplateId: -5 }).otpTemplateId,
  '',
);

const promoNoLine = lineForMessageClass('PROMO', { linePromo: '', lineService: '9982007567' });
assert.ok('error' in promoNoLine && promoNoLine.error === 'LINE_NOT_CONFIGURED');
const promoLine = lineForMessageClass('PROMO', {
  linePromo: '30005000',
  lineService: '9982007567',
});
assert.ok('line' in promoLine && promoLine.line === '30005000');
const txLine = lineForMessageClass('TRANSACTIONAL', { linePromo: '30005000', lineService: '' });
assert.ok('error' in txLine && txLine.error === 'LINE_NOT_CONFIGURED');

// --- Mock scenarios ---
async function runMock() {
  const m = new MockSmsProvider();
  m.setScenario('success');
  const ok = await m.sendSingle({ to: '09121234567', body: 'hi', idempotencyKey: 'k1' });
  assert.ok(ok.ok && ok.providerMessageId);

  m.setScenario('timeout');
  const to = await m.sendSingle({ to: '09121234567', body: 'hi', idempotencyKey: 'k2' });
  assert.ok(!to.ok && to.error?.code === 'TIMEOUT' && to.error.ambiguous);

  m.setScenario('blacklist');
  const bl = await m.sendSingle({ to: '09121234567', body: 'hi', idempotencyKey: 'k3' });
  assert.ok(!bl.ok && bl.error?.code === 'BLACKLISTED' && !bl.error.retryable);

  m.setScenario('http5xx');
  const h = await m.sendSingle({ to: '09120000000', body: 'x', idempotencyKey: 'k4' });
  assert.ok(!h.ok && h.error?.retryable);

  const credit = await m.getCredit();
  assert.strictEqual(credit.unit, 'SMS');
}

// --- SmsIrProvider with fake fetch ---
async function runSmsIr() {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input: any) => {
    const url = String(typeof input === 'string' ? input : input.url);
    calls.push(url);
    if (url.includes('/send/bulk')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 1,
          data: { messageIds: [123, 0, null], packId: 'p1', cost: 2 },
        }),
        text: async () => '',
      } as any;
    }
    if (url.includes('/credit')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 1, data: 500 }),
        text: async () => '',
      } as any;
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as any;
  };

  const p = new SmsIrProvider({
    apiKey: 'TEST_KEY_PLACEHOLDER',
    lineService: '9982007567',
    linePromo: '30005000',
    fetchImpl,
  });

  const bulk = await p.sendBulk({
    to: ['09121111111', '09122222222', '09123333333'],
    body: 'test',
    line: '9982007567',
    idempotencyKey: 'b1',
  });
  assert.ok(bulk.ok);
  assert.strictEqual(bulk.results[0].messageId, '123');
  assert.strictEqual(bulk.results[1].error?.code, 'BLACKLISTED');
  assert.strictEqual(bulk.results[2].error?.code, 'INVALID_RECIPIENT');
  assert.strictEqual(bulk.packId, 'p1');

  const credit = await p.getCredit();
  assert.strictEqual(credit.amount, 500);
  assert.strictEqual(credit.unit, 'SMS');

  // timeout → ambiguous
  const timeoutFetch: typeof fetch = async () => {
    const err: any = new Error('aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };
  const p2 = new SmsIrProvider({
    apiKey: 'TEST_KEY_PLACEHOLDER',
    lineService: '9982007567',
    fetchImpl: timeoutFetch,
  });
  const r = await p2.sendSingle({
    to: '09121234567',
    body: 'x',
    line: '9982007567',
    idempotencyKey: 't1',
  });
  assert.ok(!r.ok && r.error?.code === 'TIMEOUT' && r.error.ambiguous);

  const p3 = new SmsIrProvider({
    apiKey: 'TEST_KEY_PLACEHOLDER',
    lineService: '9982007567',
    fetchImpl,
  });
  const tooMany = Array.from({ length: 101 }, (_, i) => `0912100${String(i).padStart(4, '0')}`);
  await assert.rejects(
    () =>
      p3.sendBulk({
        to: tooMany,
        body: 'x',
        line: '9982007567',
        idempotencyKey: 'big',
      }),
    /SMS_BULK_TOO_LARGE/,
  );
}

async function runDisabled() {
  const d = new DisabledSmsProvider();
  const single = await d.sendSingle({
    to: '09121234567',
    body: 'x',
    idempotencyKey: 'd1',
  });
  assert.ok(!single.ok && single.error?.code === 'DISABLED');
  const bulk = await d.sendBulk({ to: ['09121111111'], body: 'x', idempotencyKey: 'd2' });
  assert.ok(!bulk.ok && bulk.error?.code === 'DISABLED');
  const credit = await d.getCredit();
  assert.strictEqual(credit.amount, 0);
}

// --- anti-network guard ---
function runGuard() {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  assert.throws(
    () => assertTestBlocksRealSmsNetwork('https://api.sms.ir/v1/credit'),
    /SMS_NETWORK_FORBIDDEN_IN_TEST/,
  );
  process.env.SMS_EGRESS_BASE_URL = 'https://egress.example.com/v1';
  assert.throws(
    () => assertTestBlocksRealSmsNetwork('https://egress.example.com/v1/credit'),
    /SMS_NETWORK_FORBIDDEN_IN_TEST/,
  );
  delete process.env.SMS_EGRESS_BASE_URL;
  // guardedFetch refuses before calling through
  let called = false;
  const g = guardedFetch(async () => {
    called = true;
    return {} as any;
  });
  assert.rejects(
    () => g('https://api.sms.ir/v1/line'),
    /SMS_NETWORK_FORBIDDEN_IN_TEST/,
  ).then(() => {
    assert.ok(!called);
  });
  process.env.NODE_ENV = prev;
}

async function main() {
  await runMock();
  await runSmsIr();
  await runDisabled();
  runGuard();
  // NODE_ENV=test must never pick smsir or call api.sms.ir
  if (process.env.NODE_ENV === 'test') {
    let fetchCalled = false;
    const fetchSpy: typeof fetch = async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' } as any;
    };
    const p = createSmsProvider({
      env: process.env,
      smsir: { apiKey: 'SHOULD_NOT_USE', fetchImpl: fetchSpy },
    });
    assert.strictEqual(p.id, 'mock');
    assert.ok(!fetchCalled, 'test factory must not invoke sms.ir fetch');
  }
  console.log('sms-panel provider: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
