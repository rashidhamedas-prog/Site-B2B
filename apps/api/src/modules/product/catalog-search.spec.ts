/**
 * npx ts-node --transpile-only src/modules/product/catalog-search.spec.ts
 */
import {
  CATALOG_FOLD_FROM,
  CATALOG_FOLD_TO,
  catalogSearchLikePattern,
  catalogSearchPredicate,
  foldCatalogSearchText,
} from './catalog-search';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(CATALOG_FOLD_FROM.length === CATALOG_FOLD_TO.length, 'fold maps are the same length');
assert(foldCatalogSearchText('  جين  ') === 'جین', 'arabic yeh and trim');
assert(foldCatalogSearchText('كتان') === 'کتان', 'arabic kaf');
assert(foldCatalogSearchText('K-۰۰۰۰۹') === 'K-00009', 'persian digits');
assert(foldCatalogSearchText('شلوار\u200cفوتر') === 'شلوارفوتر', 'zwnj removed');
assert(foldCatalogSearchText('   ') === '', 'blank');
assert(foldCatalogSearchText('x'.repeat(200)).length === 80, 'max length');

assert(catalogSearchLikePattern('  ') === null, 'blank has no pattern');
assert(catalogSearchLikePattern('جین') === '%جین%', 'plain pattern');
assert(catalogSearchLikePattern(`%' OR 1=1 --`) === `%\\%' OR 1=1 --%`, 'percent is escaped, quote stays data');
assert(catalogSearchLikePattern('100%_\\') === '%100\\%\\_\\\\%', 'like metacharacters escaped');

const sql = catalogSearchPredicate('p');
assert(sql.includes(':catalogQ'), 'bound parameter');
assert(sql.includes("ESCAPE '\\'"), 'escape clause');
assert(sql.includes("specs->>'fabricType'"), 'visible fabric field');
assert(sql.includes('product_sku_aliases'), 'old sku aliases');
assert(!sql.includes('1=1'), 'user text is not concatenated');
assert(!sql.includes(catalogSearchLikePattern(`%' OR 1=1 --`) || 'nope'), 'pattern is not in the SQL text');

let threw = false;
try {
  catalogSearchPredicate('p; drop');
} catch {
  threw = true;
}
assert(threw, 'alias is not an injection point');

console.log('catalog-search.spec.ts ok');
