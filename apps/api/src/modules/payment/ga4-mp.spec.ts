import * as assert from 'node:assert/strict';
import {
  buildPurchaseBody,
  mpCollectUrl,
  resolveGa4MpConfig,
  sanitizeGaClientId,
  sanitizeGaSessionId,
} from './ga4-mp';

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

assert.equal(sanitizeGaClientId('1234567890.1761000000'), '1234567890.1761000000');
assert.equal(sanitizeGaClientId('GA1.1.123.456'), '');
assert.equal(sanitizeGaClientId('09121234567'), '');
assert.equal(sanitizeGaSessionId('1761000000'), '1761000000');
assert.equal(sanitizeGaSessionId('abc'), '');

// Body: IRR as stored, no PII, null on missing client id / zero value.
const body = buildPurchaseBody({
  clientId: '1234567890.1761000000',
  sessionId: '1761000000',
  transactionId: 'RT-1001',
  valueIrr: 32_500_000,
  shippingIrr: 1_000_000,
  affiliation: 'affiliate',
  items: [
    { sku: 'SKU-1', productName: 'مانتو', color: 'مشکی', size: '38', unitPrice: 31_500_000, quantity: 1 },
    { sku: 'a@b.co', productName: '09121234567', unitPrice: 1, quantity: 1 },
  ],
});
assert.ok(body);
const ev = body!.events[0];
assert.equal(ev.name, 'purchase');
assert.equal(ev.params.transaction_id, 'RT-1001');
assert.equal(ev.params.currency, 'IRR');
assert.equal(ev.params.value, 32_500_000, 'value is stored IRR, no ×10');
assert.equal(ev.params.shipping, 1_000_000);
assert.equal(ev.params.session_id, '1761000000');
assert.equal(ev.params.items.length, 1, 'PII-only item dropped');
assert.equal(ev.params.items[0].item_variant, 'مشکی / 38');
assert.ok(!/@|09\d{9}/.test(JSON.stringify(body)), 'no PII in MP body');

assert.equal(
  buildPurchaseBody({ clientId: '', transactionId: 'RT-1', valueIrr: 10, items: [] }),
  null,
  'no client id → client fallback',
);
assert.equal(
  buildPurchaseBody({ clientId: '1234567890.1761000000', transactionId: 'RT-1', valueIrr: 0, items: [] }),
  null,
  'zero value never sent',
);

console.log('ga4-mp.spec ok');
