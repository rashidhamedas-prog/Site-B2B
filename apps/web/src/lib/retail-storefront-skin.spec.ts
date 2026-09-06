import assert from 'node:assert/strict';
import {
  DEFAULT_RETAIL_STOREFRONT_SKIN,
  isBoutiqueRetailSkin,
  parseRetailStorefrontSkin,
} from './retail-storefront-skin';

assert.equal(DEFAULT_RETAIL_STOREFRONT_SKIN, 'classic');
assert.equal(parseRetailStorefrontSkin(undefined), 'classic');
assert.equal(parseRetailStorefrontSkin(null), 'classic');
assert.equal(parseRetailStorefrontSkin(''), 'classic');
assert.equal(parseRetailStorefrontSkin('classic'), 'classic');
assert.equal(parseRetailStorefrontSkin('boutique'), 'boutique');
assert.equal(parseRetailStorefrontSkin('BOUTIQUE'), 'classic');
assert.equal(parseRetailStorefrontSkin('<script>'), 'classic');
assert.equal(parseRetailStorefrontSkin({ skin: 'boutique' }), 'classic');
assert.equal(isBoutiqueRetailSkin('boutique'), true);
assert.equal(isBoutiqueRetailSkin('classic'), false);

console.log('retail-storefront-skin spec ok');
