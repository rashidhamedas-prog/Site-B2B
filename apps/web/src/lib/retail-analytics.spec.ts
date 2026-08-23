import assert from 'node:assert/strict';
import {
  GA4_CURRENCY,
  RETAIL_ITEM_BRAND,
  buildPurchasePayload,
  ga4ValueFromStoredIrr,
  hasPurchaseBeenFired,
  itemVariant,
  markPurchaseFired,
  toGa4Item,
  trackAddToCart,
  trackPurchase,
} from './retail-analytics';
import {
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  publicAnalyticsPagePath,
  sanitizeAnalyticsSearch,
  shouldLoadProductionTags,
  stripRetailInternalPath,
  ensureGtagStub,
} from './google';
import { hostLooksRetail } from './channel';

assert.equal(GA4_CURRENCY, 'IRR');
assert.equal(ga4ValueFromStoredIrr(1_620_000), 1_620_000, 'stored IRR is sent as IRR');
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
assert.equal(shouldLoadProductionTags('localhost', '/products'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/admin/login'), false);
assert.equal(shouldLoadProductionTags('www.poshaktaranom.ir', '/products'), true);
assert.equal(hostLooksRetail('www.poshaktaranom.ir'), true);
assert.equal(hostLooksRetail('poshaktaranom.com'), false);
assert.equal(hostLooksRetail('www.poshaktaranom.com'), false);

trackAddToCart({ sku: 'NOOP', name: 'noop', unitPrice: 10, quantity: 1 });
trackPurchase({ transactionId: 'NO-WINDOW', valueIrr: 10, items: [{ sku: 'NOOP', name: 'noop', unitPrice: 10 }] });

ensureGtagStub();

console.log('retail-analytics.spec.ts ok');
