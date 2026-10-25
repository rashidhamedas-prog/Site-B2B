import assert from 'node:assert/strict';
import {
  RETAIL_HEADER_SUBTITLE,
  RETAIL_LOGO_ALT,
  STOREFRONT_LOGO_PATH,
  WHOLESALE_BRAND_NAME_FA,
  safeStorefrontLogoSrc,
} from './storefront-brand';

assert.equal(STOREFRONT_LOGO_PATH, '/logo-128.png');
assert.equal(WHOLESALE_BRAND_NAME_FA, 'پوشاک ترنم');
assert.equal(RETAIL_HEADER_SUBTITLE, 'فروشگاه آنلاین');
assert.equal(RETAIL_LOGO_ALT, 'پوشاک ترنم – فروشگاه آنلاین');
assert.equal(safeStorefrontLogoSrc(undefined), '/logo-128.png');
assert.equal(safeStorefrontLogoSrc(''), '/logo-128.png');
assert.equal(safeStorefrontLogoSrc('https://evil.example/logo.png'), '/logo-128.png');
assert.equal(safeStorefrontLogoSrc('//cdn.example/logo.png'), '/logo-128.png');
assert.equal(safeStorefrontLogoSrc('/logo-128.png'), '/logo-128.png');
assert.equal(safeStorefrontLogoSrc('/media/brand.png'), '/media/brand.png');
assert.equal(safeStorefrontLogoSrc('/logo 128.png'), '/logo-128.png');

console.log('storefront-brand spec ok');
