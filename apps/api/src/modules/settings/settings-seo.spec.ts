/**
 * npx ts-node --transpile-only src/modules/settings/settings-seo.spec.ts
 */
import * as assert from 'node:assert/strict';
import {
  resolveSeoSettings,
  sanitizeBusinessSeoFields,
  sanitizePublicAssetUrl,
  sanitizeSameAsList,
} from './settings-seo';

assert.equal(sanitizePublicAssetUrl('/logo-128.png'), '/logo-128.png');
assert.equal(sanitizePublicAssetUrl('https://cdn.example.com/og.jpg'), 'https://cdn.example.com/og.jpg');
assert.equal(sanitizePublicAssetUrl('javascript:alert(1)'), '');
assert.equal(sanitizePublicAssetUrl('//evil.example/x'), '');
assert.equal(sanitizePublicAssetUrl('http://insecure.example/x'), '');

assert.deepEqual(
  sanitizeSameAsList('https://instagram.com/tolidi.taranom\njavascript:alert(1)'),
  ['https://instagram.com/tolidi.taranom'],
);

const seo = resolveSeoSettings({
  retail: { defaultTitle: '<b>فروشگاه</b>', ogImageUrl: 'javascript:x' },
});
assert.equal(seo.retail.defaultTitle, 'فروشگاه');
assert.equal(seo.retail.ogImageUrl, '/og-retail.jpg');
assert.ok(seo.wholesale.defaultTitle.includes('ترنم'));

const biz = sanitizeBusinessSeoFields({
  businessName: 'پوشاک ترنم',
  logoUrl: '/logo-512.png',
  logoAlt: '<em>لوگو</em>',
  descriptionRetail: 'خرید تکی',
  sameAs: ['https://t.me/toliditaranom', 'data:text/html,x'],
});
assert.equal(biz.logoUrl, '/logo-512.png');
assert.equal(biz.logoAlt, 'لوگو');
assert.deepEqual(biz.sameAs, ['https://t.me/toliditaranom']);

console.log('settings-seo.spec ok');
