/**
 * npx ts-node --transpile-only src/database/migrations/20261020-001-product-custom-size-pack.spec.ts
 */
import { ProductCustomSizePack1760976000001 } from './20261020-001-product-custom-size-pack';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const m = new ProductCustomSizePack1760976000001();
assert(m.name === 'ProductCustomSizePack1760976000001', 'migration name');
assert(typeof m.up === 'function' && typeof m.down === 'function', 'up/down present');

console.log('20261020-001-product-custom-size-pack.spec.ts OK');
