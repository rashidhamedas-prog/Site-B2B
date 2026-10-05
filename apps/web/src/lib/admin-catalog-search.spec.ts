/**
 * npx tsx src/lib/admin-catalog-search.spec.ts
 */
import assert from 'node:assert/strict';
import {
  commitCatalogSearchDraft,
  nextCatalogSearchCommit,
  reconcileCatalogSearchDraft,
} from './admin-catalog-search.ts';

assert.equal(commitCatalogSearchDraft('  شلوار فوتر  '), 'شلوار فوتر');
assert.equal(commitCatalogSearchDraft('شلوار '), 'شلوار');
assert.equal(nextCatalogSearchCommit('شلوار ', 'شلوار', false), null);
assert.equal(nextCatalogSearchCommit('شلوار ف', 'شلوار', true), null);
assert.equal(nextCatalogSearchCommit('شلوار فوتر', 'شلوار', false), 'شلوار فوتر');
assert.equal(nextCatalogSearchCommit('   ', 'جین', false), '');

assert.equal(reconcileCatalogSearchDraft('شلوار ', 'شلوار', true), 'شلوار ');
assert.equal(reconcileCatalogSearchDraft('شلوار فوتر', 'شلوار', true), 'شلوار فوتر');
assert.equal(reconcileCatalogSearchDraft('شلوار فوتر', '', true), '');
assert.equal(reconcileCatalogSearchDraft('شلوار', 'جین', true), 'جین');
assert.equal(reconcileCatalogSearchDraft('شلوار فوتر', 'جین', false), 'جین');

console.log('admin-catalog-search.spec.ts ok');
