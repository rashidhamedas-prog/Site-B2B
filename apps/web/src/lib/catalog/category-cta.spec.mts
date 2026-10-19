import assert from 'node:assert/strict';
import {
  CATEGORY_LISTING_HASH,
  categoryCtaFromUnknown,
  defaultCategoryCta,
  resolveCategoryCtaHref,
  sanitizeCategoryCtaUrl,
} from './category-cta.ts';

assert.equal(sanitizeCategoryCtaUrl('javascript:alert(1)'), null);
assert.equal(sanitizeCategoryCtaUrl('/products'), '/products');
assert.equal(categoryCtaFromUnknown(null).enabled, false);
assert.equal(defaultCategoryCta().enabled, false);

const listing = categoryCtaFromUnknown({
  enabled: true,
  label: 'مشاهده مدل‌ها و خرید عمده',
  destination: 'listing',
  placement: 'below_intro',
  variant: 'primary',
});
assert.equal(resolveCategoryCtaHref(listing), CATEGORY_LISTING_HASH);

const off = categoryCtaFromUnknown({ enabled: false, label: 'x' });
assert.equal(resolveCategoryCtaHref(off), null);

console.log('category-cta.spec ok');
