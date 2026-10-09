import assert from 'node:assert/strict';
import {
  GA4_CURRENCY,
  RETAIL_ITEM_BRAND,
  affiliatePurchaseParams,
  buildPurchasePayload,
  checkoutCartFingerprint,
  claimCheckoutStep,
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
} from './retail-analytics';
import {
  isAdminAnalyticsPath,
  isApprovedPaymentReferrer,
  isNonProductionAnalyticsHost,
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

assert.equal(stripRetailInternalPath('/retail/products'), '/products');
assert.equal(stripRetailInternalPath('/retail'), '/');
assert.equal(stripRetailInternalPath('/products'), '/products');
assert.equal(publicAnalyticsPagePath('/retail/products', 'utm_source=google&phone=09120000000'), '/products?utm_source=google');
assert.equal(sanitizeAnalyticsSearch('utm_campaign=spring&otp=1234'), 'utm_campaign=spring');
assert.equal(sanitizeAnalyticsSearch('Authority=A000&utm_source=torob'), 'utm_source=torob');
assert.equal(sanitizeAnalyticsSearch('q=09120000000&color=red'), 'color=red');
assert.equal(sanitizeAnalyticsSearch('foo=bar'), '');
assert.equal(shouldLoadProductionTags('localhost', '/products'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/admin/login'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/products'), true);
assert.equal(hostLooksRetail('www.poshaktaranom.ir'), true);
assert.equal(hostLooksRetail('poshaktaranom.com'), false);
assert.equal(hostLooksRetail('www.poshaktaranom.com'), false);

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

console.log('retail-analytics.spec.ts ok');
