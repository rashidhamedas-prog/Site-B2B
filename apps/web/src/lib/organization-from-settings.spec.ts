/**
 * npx ts-node --transpile-only --compiler-options "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" src/lib/organization-from-settings.spec.ts
 */
import assert from 'node:assert/strict';
import {
  buildOrganizationJsonLd,
  layoutSeoFromSettings,
  paymentAcceptedFor,
} from './organization-from-settings';

assert.equal(paymentAcceptedFor('RETAIL', { retailCashEnabled: false }), 'Credit Card');
assert.equal(paymentAcceptedFor('RETAIL', { retailCashEnabled: true }), 'Credit Card, Cash on Delivery');
assert.equal(paymentAcceptedFor('WHOLESALE', { wholesaleCashEnabled: false }), 'Bank Transfer');

const org = buildOrganizationJsonLd({
  channel: 'RETAIL',
  business: {
    businessName: 'پوشاک ترنم',
    phone: '09152424624',
    email: 'info@poshaktaranom.com',
    logoUrl: '/logo-512.png',
    instagram: 'tolidi.taranom',
    descriptionRetail: 'خرید تکی از تولیدی',
  },
  seo: { retail: { ogImageUrl: '/og-retail.jpg', ogImageAlt: 'فروشگاه' } },
  payment: { retailCashEnabled: false },
});
assert.equal(org['@type'], 'OnlineStore');
assert.equal(org.name, 'فروشگاه پوشاک ترنم');
assert.equal((org.logo as { url: string }).url, 'https://www.poshaktaranom.ir/logo-512.png');
assert.equal(org.paymentAccepted, 'Credit Card');
assert.ok((org.sameAs as string[]).some((u) => u.includes('instagram.com')));

const meta = layoutSeoFromSettings({
  channel: 'WHOLESALE',
  seo: { wholesale: { defaultTitle: 'عنوان عمده', defaultDescription: 'شرح عمده', ogImageUrl: '/og-wholesale.jpg', ogImageAlt: 'آلت عمده' } },
});
assert.equal(meta.title, 'عنوان عمده');
assert.equal(meta.ogAlt, 'آلت عمده');

console.log('organization-from-settings.spec ok');
