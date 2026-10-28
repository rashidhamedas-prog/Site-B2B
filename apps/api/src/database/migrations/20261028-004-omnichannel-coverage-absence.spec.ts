/**
 * npx ts-node --transpile-only src/database/migrations/20261028-004-omnichannel-coverage-absence.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(
  resolve(__dirname, '20261028-004-omnichannel-coverage-absence.ts'),
  'utf8',
);

assert(src.includes('omnichannel_coverage_absence'), 'table name');
assert(src.includes('CREATE TABLE IF NOT EXISTS'), 'additive create');
assert(src.includes('DROP TABLE IF EXISTS'), 'down drops table');
assert(src.includes('UQ_omnichannel_coverage_absence_product_dest'), 'partial unique dest');
assert(src.includes('UQ_omnichannel_coverage_absence_product_row'), 'partial unique row');
assert(src.includes('destinationId" IS NULL'), 'row-wide null dest');
assert(!src.includes('DROP TABLE "omnichannel_publication'), 'does not touch deliveries');

console.log('20261028-004-omnichannel-coverage-absence.spec.ts: ok');
