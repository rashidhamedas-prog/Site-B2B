import assert from 'node:assert/strict';
import {
  GA4_CURRENCY,
  RETAIL_ITEM_BRAND,
  affiliatePurchaseParams,
  buildPurchasePayload,
  cartAgeBucket,
  cartAgeDays,
  cartFingerprintHash,
  checkoutCartFingerprint,
  enforceEventAllowlist,
  EVENT_PARAM_ALLOWLIST,
  registerCartSnapshot,
  claimBeginCheckout,
  claimCheckoutStep,
  parseGa4SessionCookie,
  resolveWholesaleGa4Id,
  trackBeginCheckout,
  trackWholesaleLead,
  ga4ValueFromStoredIrr,
  hasPurchaseBeenFired,
  inferRetailItemList,
  itemVariant,
  markPurchaseFired,
  sanitizeEventParams,
  toGa4Item,
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackAddToCart,
  trackContactClick,
  trackPurchase,
  trackSearch,
  shouldSendRetailAnalytics,
} from './retail-analytics';
import {
  isAdminAnalyticsPath,
  isApprovedPaymentReferrer,
  isNonProductionAnalyticsHost,
  looksLikePii,
  pageViewDedupeKey,
  publicAnalyticsPagePath,
  sanitizeAnalyticsSearch,
  shouldLoadProductionTags,
  shouldSendPageView,
  stripRetailInternalPath,
  ensureGtagStub,
} from './google';
import { hostLooksRetail } from './channel';

assert.equal(GA4_CURRENCY, 'IRR');
assert.equal(ga4ValueFromStoredIrr(32_500_000), 32_500_000, '32500000 IRR is not multiplied');
const listed = toGa4Item({ sku: 'SKU-325', name: 'نمونه', unitPrice: 32_500_000, quantity: 1, color: 'مشکی' }, 0);
assert.equal(listed?.price, 32_500_000);
assert.equal(listed?.item_id, 'SKU-325');
assert.equal(listed?.item_brand, RETAIL_ITEM_BRAND);
assert.equal(listed?.quantity, 1);

const homeKey = pageViewDedupeKey('G-F2V7VSJMLE', '/');
const nextKey = pageViewDedupeKey('G-F2V7VSJMLE', '/products');
assert.equal(shouldSendPageView('', homeKey), true);
assert.equal(shouldSendPageView(homeKey, homeKey), false);
assert.equal(shouldSendPageView(homeKey, nextKey), true);
assert.equal(isApprovedPaymentReferrer('https://web.mydigipay.com/checkout'), true);
assert.equal(isApprovedPaymentReferrer('https://www.poshaktaranom.ir/'), false);
assert.equal(isNonProductionAnalyticsHost('preview.poshaktaranom.ir'), true);
assert.deepEqual(inferRetailItemList('/category/shomiz', ''), { id: '/category/shomiz', name: 'category' });
assert.equal(inferRetailItemList('/products', '?q=coat').name, 'search');
assert.equal(inferRetailItemList('/products/coat', '').name, 'related');

const fingerprint = checkoutCartFingerprint([{ sku: 'SKU-325', quantity: 1, unitPrice: 32_500_000 }]);
assert.equal(claimCheckoutStep('add_shipping_info', fingerprint, 'PISHTAZ'), true);
assert.equal(claimCheckoutStep('add_shipping_info', fingerprint, 'PISHTAZ'), false);
assert.equal(claimCheckoutStep('add_payment_info', fingerprint, 'ZARINPAL'), true);
assert.equal(claimCheckoutStep('add_payment_info', fingerprint, 'ZARINPAL'), false);

const affiliate = affiliatePurchaseParams({ network: 'torob', code: 'sp_abc' });
assert.equal(affiliate.affiliation, 'affiliate');
assert.equal(affiliate.affiliate_network, 'torob');
assert.equal(affiliate.affiliate_code, 'sp_abc');
const leaked = affiliatePurchaseParams({ network: 'torob', code: '09121234567' });
assert.equal(leaked.affiliate_code, undefined);
assert.equal(JSON.stringify(leaked).includes('0912'), false);
const purchased = buildPurchasePayload({
  transactionId: 'RT-325',
  valueIrr: 32_500_000,
  items: [{ sku: 'SKU-325', name: 'نمونه', unitPrice: 32_500_000, quantity: 1 }],
  shippingIrr: 650_000,
  affiliateNetwork: 'torob',
  affiliateCode: '09120000000',
});
assert.equal(purchased?.value, 32_500_000);
assert.equal(purchased?.shipping, 650_000);
assert.equal(purchased?.affiliate_code, undefined);
assert.equal(JSON.stringify(purchased).includes('0912'), false);
assert.equal(ga4ValueFromStoredIrr(1_620_000.4), 1_620_000);
assert.equal(ga4ValueFromStoredIrr(-10), 0);
assert.equal(ga4ValueFromStoredIrr(undefined), 0);

assert.equal(itemVariant('سرمه‌ای', '۲'), 'سرمه‌ای / ۲');
assert.equal(itemVariant('سرمه‌ای', ''), 'سرمه‌ای');
assert.equal(itemVariant('', ''), undefined);

const item = toGa4Item({
  sku: 'MNT-001',
  productId: 'uuid-1',
  name: 'مانتو یاقوت',
  color: 'سرمه‌ای',
  size: '۲',
  unitPrice: 1_620_000,
  quantity: 2,
  discount: 100_000,
  category: 'مانتو',
});
assert.ok(item);
assert.equal(item!.item_id, 'MNT-001', 'SKU wins over product id');
assert.equal(item!.item_name, 'مانتو یاقوت');
assert.equal(item!.item_brand, RETAIL_ITEM_BRAND);
assert.equal(item!.item_category, 'مانتو');
assert.equal(item!.item_variant, 'سرمه‌ای / ۲');
assert.equal(item!.price, 1_620_000);
assert.equal(item!.quantity, 2);
assert.equal(item!.discount, 100_000);

const fallback = toGa4Item({ productId: 'uuid-2', productName: 'شومیز' });
assert.equal(fallback!.item_id, 'uuid-2');
assert.equal(toGa4Item({}), null);

const purchase = buildPurchasePayload({
  transactionId: 'RT-1001',
  valueIrr: 3_240_000,
  shippingIrr: 650_000,
  items: [
    { sku: 'MNT-001', name: 'مانتو یاقوت', unitPrice: 1_620_000, quantity: 2 },
  ],
});
assert.ok(purchase);
assert.equal(purchase!.transaction_id, 'RT-1001');
assert.equal(purchase!.currency, 'IRR');
assert.equal(purchase!.value, 3_240_000);
assert.equal(purchase!.shipping, 650_000);
assert.equal(purchase!.items.length, 1);
assert.equal(buildPurchasePayload({ transactionId: '', valueIrr: 1, items: [] }), null);

assert.equal(hasPurchaseBeenFired('RT-1001'), false);
markPurchaseFired('RT-1001');
assert.equal(hasPurchaseBeenFired('RT-1001'), true);

assert.equal(isNonProductionAnalyticsHost('localhost'), true);
assert.equal(isNonProductionAnalyticsHost('127.0.0.1:3000'), true);
assert.equal(isNonProductionAnalyticsHost('shop.local'), true);
assert.equal(isNonProductionAnalyticsHost('www.poshaktaranom.ir'), false);
assert.equal(isAdminAnalyticsPath('/admin'), true);
assert.equal(isAdminAnalyticsPath('/admin/blog'), true);
assert.equal(isAdminAnalyticsPath('/products'), false);
assert.equal(isAdminAnalyticsPath('/confirm/sales-partner/abc123'), true);
assert.equal(isAdminAnalyticsPath('/confirmation'), false);

assert.equal(stripRetailInternalPath('/retail/products'), '/products');
assert.equal(stripRetailInternalPath('/retail'), '/');
assert.equal(stripRetailInternalPath('/products'), '/products');
assert.equal(publicAnalyticsPagePath('/retail/products', 'utm_source=google&phone=09120000000'), '/products?utm_source=google');
assert.equal(sanitizeAnalyticsSearch('utm_campaign=spring&otp=1234'), 'utm_campaign=spring');
assert.equal(sanitizeAnalyticsSearch('Authority=A000&utm_source=torob'), 'utm_source=torob');
assert.equal(sanitizeAnalyticsSearch('q=09120000000&color=red'), '', 'search/filter params are not campaign params');
assert.equal(sanitizeAnalyticsSearch('foo=bar'), '');
assert.equal(shouldLoadProductionTags('localhost', '/products'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/admin/login'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/products'), true);
assert.equal(hostLooksRetail('www.poshaktaranom.ir'), true);
assert.equal(hostLooksRetail('poshaktaranom.com'), false);
assert.equal(hostLooksRetail('www.poshaktaranom.com'), false);
assert.equal(
  shouldSendRetailAnalytics({ host: 'poshaktaranom.com', pathname: '/products', channel: 'WHOLESALE' }),
  true,
);
assert.equal(
  shouldSendRetailAnalytics({ host: 'www.poshaktaranom.ir', pathname: '/products', channel: 'WHOLESALE' }),
  false,
);

trackAddToCart({ sku: 'NOOP', name: 'noop', unitPrice: 10, quantity: 1 });
trackPurchase({ transactionId: 'NO-WINDOW', valueIrr: 10, items: [{ sku: 'NOOP', name: 'noop', unitPrice: 10 }] });

assert.deepEqual(sanitizeEventParams({ method: 'sales_partner', phone: '09120000000', email: 'a@b.c' }), {
  method: 'sales_partner',
});
assert.equal(trackSearch('09121234567'), undefined);

const storage = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};
const dataLayer: Array<Record<string, unknown> | IArguments> = [];
Object.assign(globalThis, {
  window: {
    location: {
      hostname: 'www.poshaktaranom.ir',
      pathname: '/',
      search: '',
      origin: 'https://www.poshaktaranom.ir',
    },
    dataLayer,
    sessionStorage: memoryStorage,
    localStorage: memoryStorage,
  },
});

function gtagEvents() {
  return dataLayer
    .filter((entry) => Object.prototype.toString.call(entry) === '[object Arguments]')
    .map((entry) => {
      const args = entry as unknown as { 0?: string; 1?: string; 2?: Record<string, unknown> };
      return { command: args[0], name: args[1], params: args[2] ?? {} };
    });
}

ensureGtagStub();
const gtag = (globalThis as { window: Window }).window.gtag;
assert.equal(typeof gtag, 'function');
gtag?.('event', 'page_view', { page_path: '/' });
const queued = dataLayer.at(-1);
assert.equal(Array.isArray(queued), false);
assert.equal(Object.prototype.toString.call(queued), '[object Arguments]');

const beforePurchase = gtagEvents().filter((entry) => entry.name === 'purchase').length;
trackPurchase({
  transactionId: 'RT-DEDUP',
  valueIrr: 32_500_000,
  items: [{ sku: 'SKU-325', name: 'نمونه', unitPrice: 32_500_000, quantity: 1 }],
});
trackPurchase({
  transactionId: 'RT-DEDUP',
  valueIrr: 32_500_000,
  items: [{ sku: 'SKU-325', name: 'نمونه', unitPrice: 32_500_000, quantity: 1 }],
});
const purchaseHits = gtagEvents().filter((entry) => entry.name === 'purchase');
assert.equal(purchaseHits.length - beforePurchase, 1, 'one purchase per transaction_id');
assert.equal(purchaseHits.at(-1)?.params.value, 32_500_000);
assert.equal(purchaseHits.at(-1)?.params.currency, 'IRR');

trackAddShippingInfo(
  [{ sku: 'SKU-SHIP', name: 'ارسال', unitPrice: 32_500_000, quantity: 1 }],
  32_500_000,
  'PISHTAZ',
);
trackAddShippingInfo(
  [{ sku: 'SKU-SHIP', name: 'ارسال', unitPrice: 32_500_000, quantity: 1 }],
  32_500_000,
  'PISHTAZ',
);
const shippingHits = gtagEvents().filter((entry) => entry.name === 'add_shipping_info');
assert.equal(shippingHits.length, 1, 'default shipping is sent once');
assert.equal(shippingHits[0]?.params.value, 32_500_000);

trackAddPaymentInfo(
  [{ sku: 'SKU-PAY', name: 'پرداخت', unitPrice: 32_500_000, quantity: 1 }],
  32_500_000,
  'ZARINPAL',
);
trackAddPaymentInfo(
  [{ sku: 'SKU-PAY', name: 'پرداخت', unitPrice: 32_500_000, quantity: 1 }],
  32_500_000,
  'ZARINPAL',
);
const paymentHits = gtagEvents().filter((entry) => entry.name === 'add_payment_info');
assert.equal(paymentHits.length, 1, 'default payment is sent once');

trackContactClick('whatsapp');
const contact = gtagEvents().find((entry) => entry.name === 'contact_click');
assert.equal(contact?.params.contact_method, 'whatsapp');

const objectEvents = dataLayer.filter((entry) => {
  if (Object.prototype.toString.call(entry) === '[object Arguments]') return false;
  return Boolean(entry && typeof entry === 'object' && 'event' in entry);
});
assert.equal(objectEvents.length, 0, 'GA4 events are gtag commands, not object pushes');

// begin_checkout: once per cart fingerprint per session (remount / gateway return must not re-fire).
const bcItems = [{ sku: 'SKU-BC', name: 'شروع', unitPrice: 10_000_000, quantity: 1 }];
trackBeginCheckout(bcItems, 10_000_000);
trackBeginCheckout(bcItems, 10_000_000);
assert.equal(gtagEvents().filter((e) => e.name === 'begin_checkout').length, 1, 'begin_checkout deduped');
assert.ok(
  [...storage.keys()].some((k) => k.startsWith('taranom_ga4_checkout_step:begin_checkout|')),
  'begin_checkout dedupe persisted to sessionStorage',
);
// A fresh module instance (page reload) still sees the sessionStorage marker.
storage.set('taranom_ga4_checkout_step:begin_checkout|SKU-RELOAD:1:5|start', '1');
assert.equal(claimBeginCheckout('SKU-RELOAD:1:5'), false, 'reload does not re-claim begin_checkout');
assert.equal(claimBeginCheckout(''), false, 'empty cart never claims');

// GA cookies → MP client/session ids.
assert.equal(parseGa4SessionCookie('GS1.1.1761000000.3.1.1761000100.0.0.0'), '1761000000');
assert.equal(parseGa4SessionCookie('GS2.1.s1761000000$o3$g1$t1761000100'), '1761000000');
assert.equal(parseGa4SessionCookie('garbage'), undefined);

assert.equal(resolveWholesaleGa4Id(), 'G-YVT5DXZF5Z');
assert.equal(resolveWholesaleGa4Id('g-abc123'), 'G-ABC123');

// Wholesale lead events: never on the retail host; PII stripped on wholesale host.
const leadsBefore = gtagEvents().filter((e) => e.name === 'phone_click').length;
trackWholesaleLead('phone_click', { cta_location: 'floating_contact' });
assert.equal(gtagEvents().filter((e) => e.name === 'phone_click').length, leadsBefore, 'no lead on retail host');
const win = (globalThis as unknown as { window: { location: Record<string, string> } }).window;
win.location.hostname = 'poshaktaranom.com';
win.location.origin = 'https://poshaktaranom.com';
trackWholesaleLead('phone_click', { cta_location: 'floating_contact', phone: '09121234567', note: 'a@b.co' });
trackWholesaleLead('not_allowed_event', { cta_location: 'x' });
const lead = gtagEvents().filter((e) => e.name === 'phone_click').at(-1);
assert.equal(lead?.params.cta_location, 'floating_contact');
assert.equal(lead?.params.send_to, 'G-YVT5DXZF5Z');
assert.equal(lead?.params.phone, undefined, 'phone key stripped');
assert.equal(lead?.params.note, undefined, 'email value stripped');
assert.equal(gtagEvents().some((e) => e.name === 'not_allowed_event'), false);

// --- Allowlist: every lead event keeps only enum params (+ send_to). ---
const ADDRESS = 'تهران خیابان ولیعصر پلاک ۱۲';
const PII_VALUES = [
  '۰۹۱۲۳۴۵۶۷۸۹',
  '0912-345-6789',
  '+98 912 345 6789',
  'ali%40example.com',
  'ali@example.com',
  'Authority=A0000123',
  'paymentId=00000000-0000-0000-0000-000000000000',
  'trackingCode=123',
  'token=abc',
  ADDRESS,
];
const LEAD_EVENTS = [
  'phone_click',
  'whatsapp_click',
  'telegram_click',
  'wholesale_cta_click',
  'wholesale_order_request',
  'generate_lead',
  'contact_form_start',
  'contact_form_submit',
];
const LEAD_ALLOWED = ['lead_type', 'cta_location', 'business_type', 'referral', 'payment_type', 'send_to'];
for (const name of LEAD_EVENTS) {
  assert.deepEqual([...EVENT_PARAM_ALLOWLIST[name]!].sort(), LEAD_ALLOWED.filter((k) => k !== 'send_to').sort());
  trackWholesaleLead(name, {
    cta_location: 'floating_contact',
    business_type: 'BOUTIQUE',
    referral: 'yes',
    payment_type: 'online',
    item_id: 'SKU-1',
    page_path: '/products?phone=09121234567',
    address: ADDRESS,
    note: ADDRESS,
    customer_name: 'علی',
    mobile: '۰۹۱۲۳۴۵۶۷۸۹',
    authority: 'A0000123',
    paymentId: '00000000-0000-0000-0000-000000000000',
    trackingCode: '123',
    token: 'abc',
  });
  const hit = gtagEvents().filter((e) => e.name === name).at(-1);
  assert.ok(hit, `${name} sent`);
  assert.deepEqual(Object.keys(hit!.params).sort(), LEAD_ALLOWED.slice().sort(), `${name}: only allowlisted keys`);
  assert.equal(hit!.params.lead_type, name);
  assert.equal(hit!.params.business_type, 'BOUTIQUE');

  for (const bad of PII_VALUES) {
    trackWholesaleLead(name, { cta_location: bad, business_type: bad, referral: bad, payment_type: bad });
    const dirty = gtagEvents().filter((e) => e.name === name).at(-1)!;
    assert.deepEqual(Object.keys(dirty.params).sort(), ['lead_type', 'send_to'], `${name}: non-enum "${bad}" dropped`);
    assert.equal(JSON.stringify(dirty.params).includes(bad), false);
  }
}
trackWholesaleLead('phone_click', { cta_location: 'header' });
assert.equal(gtagEvents().filter((e) => e.name === 'phone_click').at(-1)?.params.cta_location, undefined, 'unknown cta_location dropped');

assert.equal(enforceEventAllowlist('made_up_event', { value: 1 }), null, 'unknown events are not sent');
const filteredCart = enforceEventAllowlist('add_to_cart', {
  currency: 'IRR',
  value: 10,
  email: 'a@b.co',
  page_location: 'https://poshaktaranom.com/payment/callback?Authority=A0000123',
  cart_fp: 'k3j9x2',
  cart_age_days: 2,
  cart_age_bucket: '1_3_days',
  items: [{ item_id: 'SKU', item_name: 'نمونه', price: 10, quantity: 1, discount: 1, item_list_id: 'x', email: 'a@b.co', item_category: '0912-345-6789' }],
});
assert.deepEqual(Object.keys(filteredCart!).sort(), ['cart_age_bucket', 'cart_age_days', 'cart_fp', 'currency', 'items', 'value']);
for (const bad of ['2_days', '9', 'SAME_DAY ', 'same_day; drop', '']) {
  assert.equal(enforceEventAllowlist('add_to_cart', { cart_age_bucket: bad })!.cart_age_bucket, undefined, `bucket enum rejects ${bad}`);
}
assert.deepEqual(
  [0, 1, 3, 4, 7, 8, 400].map(cartAgeBucket),
  ['same_day', '1_3_days', '1_3_days', '4_7_days', '4_7_days', '8_plus_days', '8_plus_days'],
);
assert.deepEqual(Object.keys((filteredCart!.items as object[])[0]!).sort(), ['item_id', 'item_name', 'price', 'quantity']);
assert.equal(enforceEventAllowlist('add_to_cart', { currency: 'USD' })!.currency, undefined, 'currency enum');
assert.equal(enforceEventAllowlist('add_to_cart', { cart_fp: 'SKU-1:1:10' })!.cart_fp, undefined, 'raw fingerprint rejected');
assert.equal(enforceEventAllowlist('add_to_cart', { cart_age_days: 1.5 })!.cart_age_days, undefined);
assert.equal(enforceEventAllowlist('add_payment_info', { payment_type: 'ZARINPAL' })!.payment_type, 'ZARINPAL');
assert.equal(enforceEventAllowlist('add_payment_info', { payment_type: ADDRESS })!.payment_type, undefined);
assert.equal(enforceEventAllowlist('purchase', { transaction_id: 'ali@example.com' })!.transaction_id, undefined);
assert.equal(enforceEventAllowlist('contact_click', { contact_method: 'fax' })!.contact_method, undefined);
for (const bad of PII_VALUES.slice(0, 5)) {
  assert.equal(enforceEventAllowlist('search', { search_term: bad })!.search_term, undefined, `search_term drops ${bad}`);
  assert.equal(looksLikePii(bad), true, `PII detected: ${bad}`);
  assert.equal(Object.keys(sanitizeEventParams({ v: bad })).length, 0, `second layer drops ${bad}`);
}
assert.equal(looksLikePii('SKU-325'), false);
assert.equal(looksLikePii('floating_contact'), false);

// --- Cart cohort: cart_fp (short hash) + cart_age_days. ---
assert.match(cartFingerprintHash([{ sku: 'SKU-1', quantity: 2, unitPrice: 10 }]), /^[a-z0-9]{1,8}$/);
assert.equal(cartFingerprintHash([]), '');
assert.equal(cartFingerprintHash([{ sku: 'SKU-1', quantity: 2, unitPrice: 10 }]).includes('SKU'), false);
const noon = new Date(2026, 9, 21, 12, 0, 0).getTime();
assert.equal(cartAgeDays(noon, noon), 0);
assert.equal(cartAgeDays(new Date(2026, 9, 21, 0, 5).getTime(), new Date(2026, 9, 21, 23, 55).getTime()), 0, 'same day');
assert.equal(cartAgeDays(new Date(2026, 9, 20, 23, 55).getTime(), new Date(2026, 9, 21, 0, 5).getTime()), 1, 'next calendar day');
assert.equal(cartAgeDays(noon - 3 * 86_400_000, noon), 3);
assert.equal(cartAgeDays(noon + 86_400_000, noon), 0, 'clock skew never negative');

let wholesaleCart: Array<{ sku: string; productId: string; quantity: number; unitPrice: number }> = [];
registerCartSnapshot(() => wholesaleCart);
storage.delete('taranom_ga4_cart_cohort');
wholesaleCart = [{ sku: 'CO-1', productId: 'p1', quantity: 2, unitPrice: 100 }];
trackAddToCart({ sku: 'CO-1', productId: 'p1', name: 'کوهورت', unitPrice: 100, quantity: 2 });
const atc = gtagEvents().filter((e) => e.name === 'add_to_cart').at(-1)!;
assert.equal(atc.params.cart_fp, cartFingerprintHash(wholesaleCart), 'add_to_cart fp = post-add cart');
assert.equal(atc.params.cart_age_days, 0);
assert.equal(atc.params.cart_age_bucket, 'same_day');
assert.equal(atc.params.send_to, 'G-YVT5DXZF5Z');
const cohort = JSON.parse(storage.get('taranom_ga4_cart_cohort')!) as { since: number; fp: string };
// Pretend the first add happened 3 days ago; a second add keeps the cohort start.
storage.set('taranom_ga4_cart_cohort', JSON.stringify({ ...cohort, since: Date.now() - 3 * 86_400_000 }));
wholesaleCart = [...wholesaleCart, { sku: 'CO-2', productId: 'p2', quantity: 1, unitPrice: 50 }];
trackAddToCart({ sku: 'CO-2', productId: 'p2', name: 'دوم', unitPrice: 50, quantity: 1 });
assert.equal(gtagEvents().filter((e) => e.name === 'add_to_cart').at(-1)!.params.cart_age_days, 3);

const checkoutInputs = wholesaleCart.map((i) => ({ ...i, name: i.sku }));
const fpBefore = gtagEvents().filter((e) => e.name === 'begin_checkout').length;
trackBeginCheckout(checkoutInputs, 250);
trackBeginCheckout(checkoutInputs, 250);
const bcHits = gtagEvents().filter((e) => e.name === 'begin_checkout');
assert.equal(bcHits.length - fpBefore, 1, 'begin_checkout once per cart fp');
assert.equal(bcHits.at(-1)!.params.cart_fp, cartFingerprintHash(wholesaleCart), 'same fp as last add_to_cart');
assert.equal(bcHits.at(-1)!.params.cart_age_days, 3);
assert.equal(bcHits.at(-1)!.params.cart_age_bucket, '1_3_days');
trackBeginCheckout([...checkoutInputs, { sku: 'CO-3', productId: 'p3', quantity: 1, unitPrice: 1, name: 'x' }], 251);
assert.equal(gtagEvents().filter((e) => e.name === 'begin_checkout').length - fpBefore, 2, 'changed cart → new begin_checkout');

const shipBefore = gtagEvents().filter((e) => e.name === 'add_shipping_info').length;
trackAddShippingInfo(checkoutInputs, 250, 'TIPAX');
trackAddShippingInfo(checkoutInputs, 250, 'TIPAX');
trackAddShippingInfo(checkoutInputs, 250, 'PISHTAZ');
const shipHits = gtagEvents().filter((e) => e.name === 'add_shipping_info');
assert.equal(shipHits.length - shipBefore, 2, 'add_shipping_info once per (fp, method)');
assert.equal(shipHits.at(-1)!.params.cart_fp, cartFingerprintHash(wholesaleCart));
assert.equal(shipHits.at(-1)!.params.cart_age_days, 3);
const payBefore = gtagEvents().filter((e) => e.name === 'add_payment_info').length;
trackAddPaymentInfo(checkoutInputs, 250, 'ONLINE');
trackAddPaymentInfo(checkoutInputs, 250, 'ONLINE');
trackAddPaymentInfo(checkoutInputs, 250, 'CASH');
const payHits = gtagEvents().filter((e) => e.name === 'add_payment_info');
assert.equal(payHits.length - payBefore, 2, 'add_payment_info once per (fp, method)');
assert.equal(payHits.at(-1)!.params.payment_type, 'CASH');

// New cart after the old one was emptied starts a fresh cohort (age 0).
wholesaleCart = [{ sku: 'NEW-1', productId: 'n1', quantity: 1, unitPrice: 10 }];
trackAddToCart({ sku: 'NEW-1', productId: 'n1', name: 'جدید', unitPrice: 10, quantity: 1 });
assert.equal(gtagEvents().filter((e) => e.name === 'add_to_cart').at(-1)!.params.cart_age_days, 0);
registerCartSnapshot(null);

// Nothing sent anywhere carries PII / gateway tokens.
const everything = JSON.stringify(gtagEvents().map((e) => e.params));
for (const needle of ['09121234567', '۰۹۱۲', '0912-345', '+98 912', 'example.com', 'A0000123', '00000000-0000', 'trackingCode', 'token', 'ولیعصر']) {
  assert.equal(everything.includes(needle), false, `no "${needle}" in any GA param`);
}

win.location.hostname = 'www.poshaktaranom.ir';
win.location.origin = 'https://www.poshaktaranom.ir';

console.log('retail-analytics.spec.ts ok');
