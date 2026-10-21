import * as assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildPurchaseBody,
  buildPurchaseBodyChecked,
  fetchErrorCode,
  looksSensitive,
  mpCollectUrl,
  mpDebugUrl,
  postPurchase,
  resolveGa4MpConfig,
  sanitizeGaClientId,
  sanitizeGaSessionId,
  validatePurchaseBody,
  type Ga4FetchLike,
  type Ga4MpBody,
} from './ga4-mp';
import { ledgerUpdateForOutcome } from './ga4-purchase.sql';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const HOUR = 3_600_000;

// Feature flag: off by default, needs flag + secret.
assert.equal(resolveGa4MpConfig('RETAIL', {}).enabled, false, 'off without flag');
assert.equal(
  resolveGa4MpConfig('RETAIL', { GA4_SERVER_PURCHASE_ENABLED: 'true' }).enabled,
  false,
  'off without secret',
);
const retailCfg = resolveGa4MpConfig('RETAIL', {
  GA4_SERVER_PURCHASE_ENABLED: 'true',
  GA4_MP_RETAIL_API_SECRET: 'secret-12345',
});
assert.equal(retailCfg.enabled, true);
assert.equal(retailCfg.measurementId, 'G-F2V7VSJMLE');
const wsCfg = resolveGa4MpConfig('WHOLESALE', {
  GA4_SERVER_PURCHASE_ENABLED: '1',
  GA4_MP_WHOLESALE_API_SECRET: 'secret-12345',
  GA4_MP_WHOLESALE_MEASUREMENT_ID: 'bad id',
});
assert.equal(wsCfg.measurementId, 'G-YVT5DXZF5Z', 'invalid override falls back to stream id');
assert.equal(
  resolveGa4MpConfig('WHOLESALE', { GA4_SERVER_PURCHASE_ENABLED: 'false', GA4_MP_WHOLESALE_API_SECRET: 'x'.repeat(20) })
    .enabled,
  false,
);
assert.match(mpCollectUrl(retailCfg), /^https:\/\/www\.google-analytics\.com\/mp\/collect\?measurement_id=G-F2V7VSJMLE&api_secret=/);
assert.match(mpDebugUrl(retailCfg), /^https:\/\/www\.google-analytics\.com\/debug\/mp\/collect\?/);
assert.ok(!mpCollectUrl(retailCfg).includes('/debug/'), 'production URL is never the validation server');

// Production code never reaches the validation server.
const serviceSrc = readFileSync(join(__dirname, 'ga4-purchase.service.ts'), 'utf8');
assert.ok(!/mpDebugUrl|debug\/mp|validation_behavior/.test(serviceSrc), 'service never uses debug endpoint');
assert.ok(!/mpDebugUrl|validation_behavior/.test(postPurchase.toString()), 'sender never uses debug endpoint');
assert.ok(!/\.message\b/.test(serviceSrc), 'service never logs err.message');

assert.equal(sanitizeGaClientId('1234567890.1761000000'), '1234567890.1761000000');
assert.equal(sanitizeGaClientId('GA1.1.123.456'), '');
assert.equal(sanitizeGaClientId('09121234567'), '');
assert.equal(sanitizeGaSessionId('1761000000'), '1761000000');
assert.equal(sanitizeGaSessionId('abc'), '');

// Body: IRR as stored, no PII, purchase time (not send time), validated.
const baseInput = {
  clientId: '1234567890.1761000000',
  sessionId: '1761000000',
  transactionId: 'ORD-2026-00012-A3F9C1',
  valueIrr: 32_500_000,
  shippingIrr: 1_000_000,
  affiliation: 'affiliate',
  eventTimeMs: NOW - 2 * HOUR,
  nowMs: NOW,
  items: [
    { sku: 'SKU-1', productName: 'مانتو', color: 'مشکی', size: '38', unitPrice: 31_500_000, quantity: 1 },
    { sku: 'a@b.co', productName: '09121234567', unitPrice: 1, quantity: 1 },
  ],
};
const body = buildPurchaseBody(baseInput);
assert.ok(body);
const ev = body!.events[0];
assert.equal(ev.name, 'purchase');
assert.equal(ev.params.transaction_id, 'ORD-2026-00012-A3F9C1');
assert.equal(ev.params.currency, 'IRR');
assert.equal(ev.params.value, 32_500_000, 'value is stored IRR, no ×10');
assert.equal(ev.params.shipping, 1_000_000);
assert.equal(ev.params.session_id, '1761000000');
assert.equal(ev.params.items.length, 1, 'PII-only item dropped');
assert.equal(ev.params.items[0].item_variant, 'مشکی / 38');
assert.equal(body!.timestamp_micros, (NOW - 2 * HOUR) * 1000, 'timestamp_micros = original purchase time');
assert.ok(!('validation_behavior' in body!), 'production body never sets validation_behavior');
assert.ok(!/@|09\d{9}/.test(JSON.stringify(body)), 'no PII in MP body');
assert.deepEqual(validatePurchaseBody(body, { transactionId: baseInput.transactionId, nowMs: NOW }), { ok: true });

assert.equal(buildPurchaseBody({ ...baseInput, clientId: '' }), null, 'no client id → client fallback');
assert.equal(buildPurchaseBody({ ...baseInput, valueIrr: 0 }), null, 'zero value never sent');
assert.deepEqual(
  buildPurchaseBodyChecked({ ...baseInput, items: [{ sku: 'a@b.co', productName: '09121234567' }] }).errors,
  ['params.items'],
  'all items PII → invalid, never sent',
);
assert.equal(buildPurchaseBody({ ...baseInput, eventTimeMs: NOW - 73 * HOUR }), null, 'older than 72h → null');
{
  const big = 'ORD-2026-123456-123456';
  assert.equal(looksSensitive(big), true, 'raw 16-digit run looks card-like');
  const checked = buildPurchaseBodyChecked({ ...baseInput, transactionId: big });
  assert.equal(checked.body?.events[0].params.transaction_id, big, 'own order number format is not a card');
  assert.equal(validatePurchaseBody(checked.body, { transactionId: big, nowMs: NOW }).ok, true);
}

// Validator: each bad case is rejected with a field path (never a value).
function mutate(fn: (b: any) => void): any {
  const b = JSON.parse(JSON.stringify(body));
  fn(b);
  return b;
}
function rejects(name: string, b: unknown, field: string) {
  const r = validatePurchaseBody(b, { transactionId: baseInput.transactionId, nowMs: NOW });
  assert.equal(r.ok, false, `${name}: should be rejected`);
  if (!r.ok) assert.ok(r.errors.includes(field), `${name}: expected ${field}, got ${r.errors.join(',')}`);
}
const P = (b: any) => b.events[0].params;
rejects('empty transaction_id', mutate((b) => (P(b).transaction_id = '')), 'params.transaction_id');
rejects('changed transaction_id', mutate((b) => (P(b).transaction_id = 'ORD-OTHER')), 'params.transaction_id');
rejects('transaction_id > 100', mutate((b) => (P(b).transaction_id = 'X'.repeat(101))), 'params.transaction_id');
rejects('currency USD', mutate((b) => (P(b).currency = 'USD')), 'params.currency');
rejects('value 12.5', mutate((b) => (P(b).value = 12.5)), 'params.value');
rejects('value -1', mutate((b) => (P(b).value = -1)), 'params.value');
rejects('value NaN', mutate((b) => (P(b).value = 'abc')), 'params.value');
rejects('empty items', mutate((b) => (P(b).items = [])), 'params.items');
rejects('item price 1.5', mutate((b) => (P(b).items[0].price = 1.5)), 'items[0].price');
rejects('item quantity 0', mutate((b) => (P(b).items[0].quantity = 0)), 'items[0].quantity');
rejects('item_name empty', mutate((b) => (P(b).items[0].item_name = '')), 'items[0].item_name');
rejects('item unknown key', mutate((b) => (P(b).items[0].coupon_code = 'x')), 'items[0].<unknown>');
rejects('bad client_id', mutate((b) => (b.client_id = 'GA1.1.123.456')), 'client_id');
rejects('bad session_id', mutate((b) => (P(b).session_id = 'abc')), 'params.session_id');
rejects('engagement 0', mutate((b) => (P(b).engagement_time_msec = 0)), 'params.engagement_time_msec');
rejects('missing timestamp', mutate((b) => delete b.timestamp_micros), 'timestamp_micros');
rejects('timestamp > 72h', mutate((b) => (b.timestamp_micros = (NOW - 73 * HOUR) * 1000)), 'timestamp_micros');
rejects('future timestamp', mutate((b) => (b.timestamp_micros = (NOW + 5 * 60_000) * 1000)), 'timestamp_micros');
rejects('two events', mutate((b) => b.events.push(b.events[0])), 'events');
rejects('event name', mutate((b) => (b.events[0].name = 'add_to_cart')), 'events[0].name');
rejects('unknown param key', mutate((b) => (P(b).user_email = 'x')), 'params.<unknown>');
rejects('validation_behavior in prod body', mutate((b) => (b.validation_behavior = 'ENFORCE_RECOMMENDATIONS')), 'body.<unknown>');
rejects('param value > 100', mutate((b) => (P(b).affiliation = 'a'.repeat(101))), 'params.affiliation');
rejects('too many params', mutate((b) => { for (let i = 0; i < 25; i++) P(b)[`p${i}`] = 1; }), 'params.<count>');
rejects('email in item', mutate((b) => (P(b).items[0].item_name = 'user@example.com')), 'items[0].item_name');
rejects('phone in item', mutate((b) => (P(b).items[0].item_name = 'tel 09123456789')), 'items[0].item_name');
rejects('Persian-digit phone', mutate((b) => (P(b).items[0].item_name = 'مانتو ۰۹۱۲۳۴۵۶۷۸۹')), 'items[0].item_name');
rejects('dashed phone', mutate((b) => (P(b).items[0].item_id = '0912-345-6789')), 'items[0].item_id');
rejects('+98 phone', mutate((b) => (P(b).affiliation = '+98 912 345 6789')), 'params.affiliation');
rejects('Authority', mutate((b) => (P(b).affiliation = 'A00000000000000000000000000123456789')), 'params.affiliation');
rejects('paymentId uuid', mutate((b) => (P(b).items[0].item_id = '3f2b8c1e-9a7d-4e21-b0c4-1d2e3f4a5b6c')), 'items[0].item_id');
rejects('card-like number', mutate((b) => (P(b).items[0].item_id = '6037 9912 3456 7890')), 'items[0].item_id');
assert.equal(validatePurchaseBody(null).ok, false);

assert.equal(looksSensitive('ORD-2026-09123-456789'), false, 'order numbers are not phones');
assert.equal(looksSensitive('ORD-2026-00012-A3F9C1'), false);
assert.equal(looksSensitive('6260000000013'), false, 'EAN-13 SKU allowed');
assert.equal(looksSensitive('۰۹۱۲۳۴۵۶۷۸۹'), true);
assert.equal(looksSensitive('٠٩١٢٣٤٥٦٧٨٩'), true);
assert.equal(looksSensitive('0912-345-6789'), true);

// Fetch error mapping never exposes err.message.
const abort = new Error('secret-ish details');
abort.name = 'AbortError';
assert.equal(fetchErrorCode(abort), 'timeout');
const te = new Error('x');
te.name = 'TimeoutError';
assert.equal(fetchErrorCode(te), 'timeout');
assert.equal(fetchErrorCode(new TypeError('fetch failed http://x?api_secret=y')), 'network');
assert.equal(fetchErrorCode('boom'), 'network');

async function sender() {
  const calls: string[] = [];
  const stub = (status: number): Ga4FetchLike => async (url) => {
    calls.push(url);
    return { status, body: null };
  };
  const opts = { transactionId: baseInput.transactionId, timeoutMs: 1000, nowMs: NOW };

  // Invalid payload is rejected even though the transport would answer 204.
  const bad = mutate((b) => (P(b).value = 12.5)) as Ga4MpBody;
  const out = await postPurchase(retailCfg, bad, { ...opts, fetchImpl: stub(204) });
  assert.deepEqual(out, { kind: 'invalid', code: 'schema_invalid:params.value' });
  assert.equal(calls.length, 0, 'invalid body never POSTed');
  assert.deepEqual(ledgerUpdateForOutcome(out, 1), {
    status: 'INVALID',
    lastError: 'schema_invalid:params.value',
    delayMs: null,
  });

  assert.deepEqual(await postPurchase(retailCfg, body!, { ...opts, fetchImpl: stub(204) }), {
    kind: 'transport_accepted',
  });
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes('/debug/'), 'production POST hits /mp/collect');
  assert.deepEqual(await postPurchase(retailCfg, body!, { ...opts, fetchImpl: stub(500) }), {
    kind: 'retryable',
    code: 'http_500',
  });
  assert.deepEqual(await postPurchase(retailCfg, body!, { ...opts, fetchImpl: stub(429) }), {
    kind: 'retryable',
    code: 'http_429',
  });
  assert.deepEqual(await postPurchase(retailCfg, body!, { ...opts, fetchImpl: stub(400) }), {
    kind: 'rejected',
    code: 'http_400',
  });
  const throwing: Ga4FetchLike = async () => {
    const e = new Error('The operation was aborted');
    e.name = 'TimeoutError';
    throw e;
  };
  assert.deepEqual(await postPurchase(retailCfg, body!, { ...opts, fetchImpl: throwing }), {
    kind: 'retryable',
    code: 'timeout',
  });
}

sender()
  .then(() => console.log('ga4-mp.spec ok'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
