/**
 * npx ts-node --transpile-only src/database/migrations/20260913-010-product-image-alts.spec.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '20260913-010-product-image-alts.ts'), 'utf8');
assert.match(src, /ADD COLUMN IF NOT EXISTS "imageAlts" jsonb/);
assert.match(src, /DROP COLUMN IF EXISTS "imageAlts"/);
assert.match(src, /ProductImageAlts1757763600010/);
console.log('20260913-010-product-image-alts.spec.ts: ok');
