import assert from 'node:assert/strict';
import {
  ANALYTICS_QUERY_ALLOWLIST,
  looksLikePii,
  preGtmGtagSet,
  publicAnalyticsPagePath,
  sanitizeAnalyticsReferrer,
  sanitizeAnalyticsSearch,
  stripRetailInternalPath,
} from './google';

assert.deepEqual(
  [...ANALYTICS_QUERY_ALLOWLIST].sort(),
  ['gbraid', 'gclid', 'utm_campaign', 'utm_content', 'utm_id', 'utm_medium', 'utm_source', 'utm_term', 'wbraid'],
);

// Gateway return: every token is dropped, only the path stays.
assert.equal(
  publicAnalyticsPagePath(
    '/payment/callback',
    '?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000',
  ),
  '/payment/callback',
);
assert.equal(publicAnalyticsPagePath('/payment/callback', 'trackingCode=123&token=abc&refId=9&authority=A1'), '/payment/callback');

// Campaign params survive; PII and non-campaign params do not.
assert.equal(
  publicAnalyticsPagePath('/products', '?utm_source=torob&utm_medium=cpc&phone=09121234567'),
  '/products?utm_source=torob&utm_medium=cpc',
);
assert.equal(publicAnalyticsPagePath('/products', 'gclid=Cj0KCQjwTEST_abc-123&q=coat&email=a%40b.co'), '/products?gclid=Cj0KCQjwTEST_abc-123');
assert.equal(sanitizeAnalyticsSearch('gbraid=0AAAA&wbraid=CkEx&utm_id=42&fbclid=x&page=2'), 'gbraid=0AAAA&wbraid=CkEx&utm_id=42');
assert.equal(sanitizeAnalyticsSearch('UTM_Source=google'), 'utm_source=google', 'keys are case-insensitive');

// PII hidden inside allowed params is still dropped.
const piiValues = [
  'ali@example.com',
  'ali%40example.com',
  'ali%2540example.com',
  '۰۹۱۲۳۴۵۶۷۸۹',
  '٠٩١٢٣٤٥٦٧٨٩',
  '0912-345-6789',
  '0912 345 6789',
  '+98 912 345 6789',
  '+989123456789',
  '00989123456789',
  '9123456789',
  'call-09121234567-now',
];
for (const value of piiValues) {
  assert.equal(looksLikePii(value), true, `looksLikePii(${value})`);
  assert.equal(
    sanitizeAnalyticsSearch(`utm_source=torob&utm_term=${encodeURIComponent(value)}`),
    'utm_source=torob',
    `utm_term=${value} dropped`,
  );
}
assert.equal(sanitizeAnalyticsSearch('utm_term=0012345678'), '', 'bare 10-digit id (national id) dropped');
assert.equal(sanitizeAnalyticsSearch('utm_campaign=spring_2026&utm_content=banner-1'), 'utm_campaign=spring_2026&utm_content=banner-1');
for (const safe of ['torob', 'spring_2026', 'Cj0KCQjw', '32500000', 'SKU-325', 'تخفیف پاییز']) {
  assert.equal(looksLikePii(safe), false, `not PII: ${safe}`);
}

assert.equal(stripRetailInternalPath('/retail/payment/callback'), '/payment/callback');
assert.equal(
  publicAnalyticsPagePath('/retail/payment/callback', 'Authority=A000TEST&Status=OK'),
  '/payment/callback',
);

// page_referrer: gateway → origin only; same site → sanitized path; other sites → no query.
assert.equal(
  sanitizeAnalyticsReferrer('https://www.zarinpal.com/pg/StartPay/A000000000000000000000000000TEST', 'poshaktaranom.com'),
  'https://www.zarinpal.com/',
);
assert.equal(
  sanitizeAnalyticsReferrer('https://poshaktaranom.com/checkout?token=abc&utm_source=torob', 'poshaktaranom.com'),
  'https://poshaktaranom.com/checkout?utm_source=torob',
);
assert.equal(
  sanitizeAnalyticsReferrer('https://evil.example/path?email=a@b.co', 'poshaktaranom.com'),
  'https://evil.example/path',
);
assert.equal(sanitizeAnalyticsReferrer('', 'poshaktaranom.com'), '');
assert.equal(sanitizeAnalyticsReferrer('javascript:alert(1)', 'poshaktaranom.com'), '');

const O = 'https://poshaktaranom.com';
assert.deepEqual(
  preGtmGtagSet({ origin: O, pathname: '/payment/callback', search: '?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000', appOwnsPageView: true }),
  { page_location: `${O}/payment/callback`, send_page_view: false },
);
assert.deepEqual(
  preGtmGtagSet({ origin: O, pathname: '/checkout', search: '', appOwnsPageView: true }),
  { page_location: `${O}/checkout`, send_page_view: false },
);
assert.equal(preGtmGtagSet({ origin: O, pathname: '/portal/login', search: '', appOwnsPageView: false }), null);
assert.deepEqual(
  preGtmGtagSet({ origin: O, pathname: '/confirm', search: '?token=abc123', appOwnsPageView: false }),
  { page_location: `${O}/confirm` },
);
assert.deepEqual(
  preGtmGtagSet({ origin: O, pathname: '/products', search: '?utm_source=torob&utm_medium=cpc', appOwnsPageView: false }),
  null,
);
// Hard redirect callback → /portal/login (401): GTM's own page_view must not carry the callback URL in dr.
assert.deepEqual(
  preGtmGtagSet({
    origin: O,
    pathname: '/portal/login',
    search: '',
    appOwnsPageView: false,
    referrer: `${O}/payment/callback?Authority=A000TEST&Status=OK&paymentId=00000000-0000-0000-0000-000000000000`,
  }),
  { page_location: `${O}/portal/login`, page_referrer: `${O}/payment/callback` },
);
assert.deepEqual(
  preGtmGtagSet({ origin: O, pathname: '/checkout', search: '', appOwnsPageView: true, referrer: `${O}/products?phone=09121234567` }),
  { page_location: `${O}/checkout`, page_referrer: `${O}/products`, send_page_view: false },
);
assert.equal(
  preGtmGtagSet({ origin: O, pathname: '/portal/login', search: '', appOwnsPageView: false, referrer: 'https://www.google.com/' }),
  null,
  'clean external referrer: container defaults are already safe',
);

console.log('google.spec.ts ok');
