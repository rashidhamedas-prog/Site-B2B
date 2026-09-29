import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const src = readFileSync(join(__dirname, '20260929-001-product-order-badge-label.ts'), 'utf8');
assert(src.includes('ADD COLUMN IF NOT EXISTS "orderBadgeLabel"'), 'additive column');
assert(src.includes('DROP COLUMN IF EXISTS "orderBadgeLabel"'), 'reversible');
assert(src.includes('character varying(80)'), 'bounded length');

console.log('20260929-001-product-order-badge-label.spec.ts OK');
