/**
 * npx ts-node --transpile-only src/lib/admin-customer-workspace.spec.ts
 */
import assert from 'node:assert/strict';
import {
  parseCustomerWorkspaceQuery,
  serializeCustomerWorkspaceQuery,
} from './admin-customer-workspace.ts';

const empty = parseCustomerWorkspaceQuery({ get: () => null });
assert.equal(empty.channel, 'ALL');
assert.equal(empty.tab, 'identity');
assert.equal(empty.status, '');

const parsed = parseCustomerWorkspaceQuery({
  get: (name) =>
    ({
      channel: 'retail',
      q: ' ترنم ',
      status: 'PENDING',
      segment: 'VIP',
      tab: 'wallet',
      mtab: 'rules',
    } as Record<string, string>)[name] ?? null,
});
assert.equal(parsed.channel, 'RETAIL');
assert.equal(parsed.q, 'ترنم');
assert.equal(parsed.status, 'PENDING');
assert.equal(parsed.segment, 'VIP');
assert.equal(parsed.tab, 'wallet');
assert.equal(parsed.marketingTab, 'rules');

const zeroParsed = parseCustomerWorkspaceQuery({
  get: (name) =>
    ({
      channel: 'WHOLESALE',
      mtab: 'zero',
      bucket: 'warm',
    } as Record<string, string>)[name] ?? null,
});
assert.equal(zeroParsed.marketingTab, 'zero');
assert.equal(zeroParsed.bucket, 'warm');
const zeroQs = serializeCustomerWorkspaceQuery(zeroParsed);
assert.match(zeroQs, /mtab=zero/);
assert.match(zeroQs, /bucket=warm/);

const qs = serializeCustomerWorkspaceQuery(parsed);
assert.match(qs, /channel=RETAIL/);
assert.match(qs, /tab=wallet/);
assert.equal(serializeCustomerWorkspaceQuery({ channel: 'ALL', tab: 'identity' }), '');

console.log('admin-customer-workspace.spec.ts: ok');
