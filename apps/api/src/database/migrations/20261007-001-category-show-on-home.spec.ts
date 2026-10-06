import { readFileSync } from 'fs';
import { join } from 'path';
import { CategoryShowOnHome1760092800001 } from './20261007-001-category-show-on-home';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, '20261007-001-category-show-on-home.ts'), 'utf8');

assert(/ADD COLUMN IF NOT EXISTS "showOnHome"/.test(src), 'adds showOnHome');
assert(/boolean NOT NULL DEFAULT true/.test(src), 'default true preserves existing home tiles');
assert(/DROP COLUMN IF EXISTS "showOnHome"/.test(src), 'down drops column');
assert(!/ALTER TABLE "categories"[\s\S]*status/.test(src), 'does not alter status column');
assert(!!new CategoryShowOnHome1760092800001(), 'class');
console.log('20261007-001-category-show-on-home.spec ok');
