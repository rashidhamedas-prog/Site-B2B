/**
 * npx ts-node --transpile-only src/database/migrations/20260913-011-customer-wallet-ledger.spec.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '20260913-011-customer-wallet-ledger.ts'), 'utf8');
assert.match(src, /CREATE TABLE IF NOT EXISTS "customer_wallet_entries"/);
assert.match(src, /UQ_customer_wallet_idempotencyKey/);
assert.match(src, /OPENING/);
assert.match(src, /opening:' \|\| c\.id/);
assert.match(src, /DROP TABLE IF EXISTS "customer_wallet_entries"/);
assert.match(src, /CustomerWalletLedger1757768400011/);
console.log('20260913-011-customer-wallet-ledger.spec.ts: ok');
