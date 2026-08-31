/**
 * npx ts-node --transpile-only src/modules/product/public-product-status.spec.ts
 */
import { isPublicProductRow, resolvePublicProductStatus } from './public-product-status';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolvePublicProductStatus(undefined) === 'ACTIVE', 'default active');
assert(resolvePublicProductStatus('active') === 'ACTIVE', 'active allowed');

for (const banned of ['ALL', 'DRAFT', 'HIDDEN', '']) {
  let threw = false;
  try {
    resolvePublicProductStatus(banned || 'ALL');
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_STATUS_FORBIDDEN';
  }
  assert(threw, `${banned || 'ALL'} must be rejected`);
}

assert(isPublicProductRow('ACTIVE') === true, 'active is public');
assert(isPublicProductRow('DRAFT') === false, 'draft is not public');
assert(isPublicProductRow('HIDDEN') === false, 'hidden is not public');

console.log('public-product-status.spec.ts: ok');
