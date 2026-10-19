import { readFileSync } from 'fs';
import { join } from 'path';
import { CategoryCta1760904000002 } from './20261019-002-category-cta';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20261019-002-category-cta.ts'), 'utf8');

assert(/ADD COLUMN IF NOT EXISTS "cta" jsonb NULL/.test(src), 'adds cta jsonb');
assert(/ADD COLUMN IF NOT EXISTS "wholesaleCta" jsonb NULL/.test(src), 'adds wholesaleCta jsonb');
assert(/DROP COLUMN IF EXISTS "cta"/.test(src), 'down drops cta');
assert(/DROP COLUMN IF EXISTS "wholesaleCta"/.test(src), 'down drops wholesaleCta');
assert(!/DEFAULT\s+true/i.test(src), 'does not auto-enable CTAs');
assert(!!new CategoryCta1760904000002(), 'class');
console.log('20261019-002-category-cta.spec ok');
