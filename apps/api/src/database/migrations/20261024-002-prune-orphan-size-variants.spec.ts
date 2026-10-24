/**
 * npx ts-node --transpile-only src/database/migrations/20261024-002-prune-orphan-size-variants.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PruneOrphanSizeVariants1761283200002 } from './20261024-002-prune-orphan-size-variants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const m = new PruneOrphanSizeVariants1761283200002();
assert(m.name === 'PruneOrphanSizeVariants1761283200002', 'migration name');
assert(typeof m.up === 'function' && typeof m.down === 'function', 'up/down present');

const src = readFileSync(
  join(__dirname, '20261024-002-prune-orphan-size-variants.ts'),
  'utf8',
);
assert(src.includes('فری سایز'), 'FREE chart label');
assert(src.includes('sizeLabels'), 'CUSTOM labels');
assert(src.includes('erp_variant_map'), 'clears erp map rows');
assert(src.includes('DELETE FROM product_variants'), 'deletes orphan variants');

console.log('20261024-002-prune-orphan-size-variants.spec.ts OK');
