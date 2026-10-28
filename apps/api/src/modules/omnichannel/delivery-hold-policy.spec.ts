/**
 * npx ts-node --transpile-only src/modules/omnichannel/delivery-hold-policy.spec.ts
 * PR-4: revive is one-at-a-time unless the rollback flag is on.
 */
import {
  effectiveReviveLimit,
  isBulkReviveEnabled,
  REVIVE_BULK_DEFAULT,
  REVIVE_BULK_MAX,
  REVIVE_SINGLE_LIMIT,
} from './delivery-hold-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const off: NodeJS.ProcessEnv = {};
const offExplicit: NodeJS.ProcessEnv = { OMNICHANNEL_BULK_REVIVE_ENABLED: 'false' };
const loose: NodeJS.ProcessEnv = { OMNICHANNEL_BULK_REVIVE_ENABLED: '1' };
const on: NodeJS.ProcessEnv = { OMNICHANNEL_BULK_REVIVE_ENABLED: 'true' };

assert(REVIVE_SINGLE_LIMIT === 1, 'single limit is 1');
assert(isBulkReviveEnabled(off) === false, 'default off');
assert(isBulkReviveEnabled(offExplicit) === false, 'false stays off');
assert(isBulkReviveEnabled(loose) === false, 'only the exact string true enables');
assert(isBulkReviveEnabled(on) === true, 'true enables');

for (const requested of [undefined, null, 0, 1, 5, 200, 500, 100000, '300', 'abc', -4]) {
  assert(effectiveReviveLimit(requested, off) === 1, `flag off clamps ${String(requested)} to 1`);
  assert(effectiveReviveLimit(requested, loose) === 1, `loose flag clamps ${String(requested)} to 1`);
}

assert(effectiveReviveLimit(undefined, on) === REVIVE_BULK_DEFAULT, 'rollback flag keeps the legacy default');
assert(effectiveReviveLimit(50, on) === 50, 'rollback flag honours the request');
assert(effectiveReviveLimit(100000, on) === REVIVE_BULK_MAX, 'rollback flag keeps the legacy max');
assert(effectiveReviveLimit(-4, on) === 1, 'rollback flag never goes below 1');

console.log('delivery-hold-policy.spec.ts: ok');
