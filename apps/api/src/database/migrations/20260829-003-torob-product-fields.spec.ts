import { readFileSync } from 'fs';
import { join } from 'path';
import { TorobProductFields1756473600003 } from './20260829-003-torob-product-fields';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20260829-003-torob-product-fields.ts'), 'utf8');

assert(/ADD COLUMN IF NOT EXISTS "guarantee"/.test(src), 'guarantee');
assert(/ADD COLUMN IF NOT EXISTS "defaultRetailVariantId"/.test(src), 'default variant');
assert(/ON DELETE SET NULL/.test(src), 'fk');
assert(/DROP CONSTRAINT IF EXISTS "FK_products_default_retail_variant"/.test(src), 'down fk');
assert(/DROP COLUMN IF EXISTS "guarantee"/.test(src), 'down guarantee');
assert(!!new TorobProductFields1756473600003(), 'class');
console.log('20260829-003-torob-product-fields.spec ok');
