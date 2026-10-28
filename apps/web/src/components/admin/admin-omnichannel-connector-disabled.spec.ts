/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-connector-disabled.spec.ts
 * Source-level (no React) so CI can run without the web node_modules graph.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ui = readFileSync(join(__dirname, 'admin-omnichannel-ui.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');
const api = readFileSync(join(__dirname, '../../lib/api.ts'), 'utf8');

assert.match(ui, /export function isConnectorDisabledError/);
assert.match(ui, /connector is disabled/i);
assert.match(ui, /if \(isConnectorDisabledError\(error\)\) return 'warn'/);
assert.match(admin, /revive-connector-disabled/);
assert.match(admin, /isConnectorDisabledError/);
assert.match(admin, /بازتلاش یک مورد/);
// PR-4: UI never asks for a batch revive.
assert.match(admin, /reason: reason \|\| 'بازتلاش پس از روشن‌شدن کانکتور', limit: 1 \}/);
assert.doesNotMatch(admin, /revive-connector-disabled[\s\S]{0,400}limit: 200/);
assert.match(api, /سرور در حال به‌روزرسانی است/);

console.log('admin-omnichannel-connector-disabled.spec.ts OK');
