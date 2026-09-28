/**
 * Static contract tests for ERP inventory ingest.
 * npx ts-node --transpile-only src/modules/erp-inventory/erp-inventory.contract.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeErpLabel, variantMatchKey } from './erp-text-normalize';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const dir = __dirname;
const ctrl = readFileSync(resolve(dir, 'erp-inventory.controller.ts'), 'utf8');
const svc = readFileSync(resolve(dir, 'erp-inventory.service.ts'), 'utf8');
const guard = readFileSync(resolve(dir, 'erp-inventory-api-key.guard.ts'), 'utf8');
const mig = readFileSync(
  resolve(dir, '../../database/migrations/20260928-001-erp-inventory-matrix.ts'),
  'utf8',
);

assert(ctrl.includes("path: 'erp/inventory'"), 'controller path');
assert(ctrl.includes("Put('matrix')"), 'matrix route');
assert(ctrl.includes("Get('ping')"), 'ping route');
assert(guard.includes('ERP_INVENTORY_API_KEY'), 'env key');
assert(svc.includes("matchedBy: 'map'"), 'map resolve');
assert(svc.includes("matchedBy: 'color_size'"), 'color_size resolve');
assert(svc.includes("matchedBy: 'barcode'"), 'barcode resolve');
assert(svc.includes("setStock("), 'writes via setStock');
assert(svc.includes("'erp'"), 'erp actor literal');
assert(svc.includes("'ERP matrix sync'"), 'erp notes');
assert(!svc.includes('setProductStock'), 'never product-level set');
assert(svc.includes('dryRun'), 'dry-run supported');
assert(mig.includes('erp_variant_map'), 'migration map table');
assert(mig.includes('erp_inventory_idempotency'), 'migration idempotency');

assert(variantMatchKey('مشکی', 'سایز ۱') === variantMatchKey('مشکی', 'سایز 1'), 'normalize parity');
assert(normalizeErpLabel('') === '', 'empty');

console.log('erp-inventory.contract.spec.ts: ok');
