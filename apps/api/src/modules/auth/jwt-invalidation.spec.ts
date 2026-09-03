/**
 * Prefer: npx ts-node --transpile-only src/modules/auth/jwt-invalidation.spec.ts
 */
import { isJwtInvalidatedByPasswordChange } from './jwt-invalidation';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isJwtInvalidatedByPasswordChange(1_700_000_000, null) === false, 'no stamp keeps token');
assert(isJwtInvalidatedByPasswordChange(undefined, new Date()) === true, 'missing iat dies after change');

const changed = new Date(1_700_000_500 * 1000);
assert(isJwtInvalidatedByPasswordChange(1_700_000_000, changed) === true, 'older second dies');
assert(isJwtInvalidatedByPasswordChange(1_700_000_500, changed) === false, 'same second as stamp lives (fresh token)');
assert(isJwtInvalidatedByPasswordChange(1_700_000_501, changed) === false, 'newer token lives');

console.log('jwt-invalidation.spec.ts: OK');
