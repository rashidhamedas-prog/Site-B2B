import * as assert from 'node:assert/strict';
import {
  normalizeEgressBaseUrl,
  resolveSmsIrUrl,
  smsIrRequest,
  SMSIR_DIRECT_BASE,
} from './sms-transport';

assert.equal(normalizeEgressBaseUrl(''), '');
assert.equal(normalizeEgressBaseUrl('https://sms-egress.example.com'), 'https://sms-egress.example.com/v1');
assert.equal(normalizeEgressBaseUrl('https://sms-egress.example.com/'), 'https://sms-egress.example.com/v1');
assert.equal(normalizeEgressBaseUrl('https://sms-egress.example.com/v1'), 'https://sms-egress.example.com/v1');
assert.equal(normalizeEgressBaseUrl('https://sms-egress.example.com/v1/'), 'https://sms-egress.example.com/v1');

const direct = resolveSmsIrUrl('/send/bulk', {});
assert.equal(direct.via, 'direct');
assert.equal(direct.url, `${SMSIR_DIRECT_BASE}/send/bulk`);

const egress = resolveSmsIrUrl('/send/verify', { egressBaseUrl: 'https://edge.example.com' });
assert.equal(egress.via, 'egress');
assert.equal(egress.url, 'https://edge.example.com/v1/send/verify');

assert.throws(() => resolveSmsIrUrl('https://evil.example/x', {}), /SMS_PATH_INVALID/);
assert.throws(() => resolveSmsIrUrl('/../etc/passwd', {}), /SMS_PATH_INVALID/);

async function runFetchTests() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const okFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init || {} });
    return new Response(JSON.stringify({ status: 1, message: 'موفق', data: { credit: 10 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const r1 = await smsIrRequest('GET', '/credit', 'KEY', undefined, {}, okFetch);
  assert.equal(r1.ok, true);
  assert.equal(r1.via, 'direct');
  assert.ok(calls[0].url.endsWith('/v1/credit'));

  calls.length = 0;
  const r2 = await smsIrRequest(
    'POST',
    '/send/bulk',
    'KEY',
    { messageText: 'hi', mobiles: ['0912'] },
    { egressBaseUrl: 'https://egress.test', egressSecret: 'sec' },
    okFetch,
  );
  assert.equal(r2.ok, true);
  assert.equal(r2.via, 'egress');
  assert.equal(calls[0].url, 'https://egress.test/v1/send/bulk');
  const hdrs = calls[0].init.headers as Record<string, string>;
  assert.equal(hdrs['x-taranom-egress-secret'], 'sec');
  assert.equal(hdrs['x-api-key'], 'KEY');

  const timeoutFetch: typeof fetch = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };
  const r3 = await smsIrRequest('GET', '/credit', 'KEY', undefined, {}, timeoutFetch);
  assert.equal(r3.ok, false);
  assert.equal(r3.errorCode, 'TIMEOUT');

  const badProvider: typeof fetch = async () =>
    new Response(JSON.stringify({ status: 0, message: 'invalid key' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const r4 = await smsIrRequest('GET', '/credit', 'KEY', undefined, {}, badProvider);
  assert.equal(r4.ok, false);
  assert.equal(r4.errorCode, 'PROVIDER');

  console.log('sms-transport.spec.ts: OK');
}

runFetchTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
