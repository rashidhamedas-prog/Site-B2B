import assert from 'node:assert/strict';
import {
  CATEGORY_LISTING_HASH,
  defaultCategoryCta,
  normalizeCategoryCta,
  resolveCategoryCtaHref,
  sanitizeCategoryCtaUrl,
} from './category-cta';

assert.equal(sanitizeCategoryCtaUrl('javascript:alert(1)'), null);
assert.equal(sanitizeCategoryCtaUrl('//evil.com'), null);
assert.equal(sanitizeCategoryCtaUrl('http://insecure.example'), null);
assert.equal(sanitizeCategoryCtaUrl('/category/bamber'), '/category/bamber');
assert.equal(sanitizeCategoryCtaUrl('#category-listing'), '#category-listing');
assert.equal(
  sanitizeCategoryCtaUrl('https://poshaktaranom.com/products'),
  'https://poshaktaranom.com/products',
);

assert.equal(normalizeCategoryCta(null), null);
assert.equal(normalizeCategoryCta(defaultCategoryCta())?.enabled, false);

const listing = normalizeCategoryCta({
  enabled: true,
  label: 'مشاهده مدل‌ها',
  destination: 'listing',
  customUrl: 'https://ignored.example',
  placement: 'below_intro',
  variant: 'primary',
});
assert.ok(listing);
assert.equal(listing.customUrl, null);
assert.equal(resolveCategoryCtaHref(listing), CATEGORY_LISTING_HASH);

const custom = normalizeCategoryCta({
  enabled: true,
  label: 'شرایط عمده',
  destination: 'custom',
  customUrl: '/terms',
  placement: 'below_bottom',
  variant: 'secondary',
});
assert.ok(custom);
assert.equal(resolveCategoryCtaHref(custom), '/terms');

let threw = false;
try {
  normalizeCategoryCta({
    enabled: true,
    label: 'x',
    destination: 'custom',
    customUrl: 'javascript:alert(1)',
  });
} catch {
  threw = true;
}
assert.equal(threw, true, 'unsafe custom url rejected when enabled');

console.log('category-cta.spec ok');
