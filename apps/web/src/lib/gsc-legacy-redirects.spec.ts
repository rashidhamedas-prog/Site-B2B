/**
 * npx ts-node --transpile-only src/lib/gsc-legacy-redirects.spec.ts
 */
import assert from 'node:assert/strict';
import { lookupGscLegacyRedirect } from './gsc-legacy-redirects';

assert.equal(lookupGscLegacyRedirect('/category/20'), '/category/women-pants');
assert.equal(lookupGscLegacyRedirect('/category/20/'), '/category/women-pants');
assert.equal(lookupGscLegacyRedirect('/category/20/شلوار/'), '/category/women-pants');
assert.equal(
  lookupGscLegacyRedirect('/category/20/%D8%B4%D9%84%D9%88%D8%A7%D8%B1'),
  '/category/women-pants',
);
assert.equal(lookupGscLegacyRedirect('/category/10'), null);
assert.equal(lookupGscLegacyRedirect('/category/17/کت-کتان'), null);

assert.equal(
  lookupGscLegacyRedirect('/product/161/شلوار-ماهین'),
  '/products/maserati-pants-mahin',
);
assert.equal(
  lookupGscLegacyRedirect('/product/161/%D8%B4%D9%84%D9%88%D8%A7%D8%B1-%D9%85%D8%A7%D9%87%DB%8C%D9%86/'),
  '/products/maserati-pants-mahin',
);
assert.equal(lookupGscLegacyRedirect('/product/59'), null);
assert.equal(lookupGscLegacyRedirect('/product/152/مانتو-شومیزی-ترگل'), null);
assert.equal(lookupGscLegacyRedirect('/productsجدیدترین‌ها'), null);

console.log('gsc-legacy-redirects.spec.ts: ok');
