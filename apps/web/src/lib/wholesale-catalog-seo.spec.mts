import assert from 'node:assert/strict';
import { wholesaleCatalogQueryIsUtility } from './wholesale-catalog-seo';

assert.equal(wholesaleCatalogQueryIsUtility({}), false);
assert.equal(wholesaleCatalogQueryIsUtility({ page: '1', sort: 'newest' }), false);
assert.equal(wholesaleCatalogQueryIsUtility({ page: '2' }), true);
assert.equal(wholesaleCatalogQueryIsUtility({ q: 'مانتو' }), true);
assert.equal(wholesaleCatalogQueryIsUtility({ fabric: 'لینن' }), true);
assert.equal(wholesaleCatalogQueryIsUtility({ sort: 'price_asc' }), true);
assert.equal(wholesaleCatalogQueryIsUtility({ inStock: '1' }), true);

console.log('wholesale-catalog-seo.spec: ok');
