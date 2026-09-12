import { readFileSync } from 'fs';
import { join } from 'path';
import { CategoryLiveUnique1757682000005 } from './20260912-005-category-live-unique';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20260912-005-category-live-unique.ts'), 'utf8');

assert(/UQ_categories_name_live/.test(src), 'live name unique');
assert(/UQ_categories_slug_live/.test(src), 'live slug unique');
assert(/WHERE "deletedAt" IS NULL/.test(src), 'partial unique');
assert(/DROP INDEX IF EXISTS "IDX_categories_name_unique"/.test(src), 'drop full name unique');
assert(/jsonb_agg\(x.updated ORDER BY x.ord\)/.test(src), 'cms block order preserved');
assert(/maxItems/.test(src) && /16/.test(src), 'home maxItems bump');
assert(/DROP INDEX IF EXISTS "UQ_categories_name_live"/.test(src), 'down drops live unique');
assert(!!new CategoryLiveUnique1757682000005(), 'class');
console.log('20260912-005-category-live-unique.spec ok');
