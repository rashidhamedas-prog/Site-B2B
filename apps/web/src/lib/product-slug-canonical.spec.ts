import assert from 'node:assert/strict';
import {
  canonicalMismatchPath,
  decodeIncomingSlug,
  legacyMapRedirectPath,
  productPublicPath,
} from './product-slug-canonical';
import { lookupProductSlugRedirect } from './product-slug-redirects';

assert.equal(decodeIncomingSlug('coats00014'), 'coats00014');
assert.equal(productPublicPath('bezayagh-jacket-rose'), '/products/bezayagh-jacket-rose');

assert.equal(
  canonicalMismatchPath('coats00014', 'bezayagh-jacket-rose'),
  '/products/bezayagh-jacket-rose',
);
assert.equal(canonicalMismatchPath('bezayagh-jacket-rose', 'bezayagh-jacket-rose'), null);
assert.equal(canonicalMismatchPath('bezayagh-jacket-rose', ''), null);

assert.equal(
  lookupProductSlugRedirect('bezayagh-jacket-rose'),
  'coats00014',
  'static inventory still maps the old descriptive slug to the former SKU',
);
assert.equal(
  legacyMapRedirectPath('bezayagh-jacket-rose', 'coats00014', 'bezayagh-jacket-rose'),
  null,
  'must not bounce the live canonical slug back to the SKU',
);
assert.equal(
  legacyMapRedirectPath('linen-shirt-manteau-nazgol', 'blouses00001', 'blouses00001'),
  '/products/blouses00001',
);
assert.equal(
  legacyMapRedirectPath('linen-shirt-manteau-nazgol', 'blouses00001', 'new-canonical'),
  '/products/new-canonical',
  'if the SKU slug later changed, land on the current slug',
);

assert.equal(
  canonicalMismatchPath(encodeURIComponent('کت-رز'), 'کت-رز'),
  null,
);

console.log('product-slug-canonical.spec.ts ok');
