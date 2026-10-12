/**
 * From apps/api: npx ts-node --transpile-only ../web/src/lib/admin-customer-workspace.spec.ts
 */
import {
  parseCustomerWorkspaceQuery,
  serializeCustomerWorkspaceQuery,
} from './admin-customer-workspace.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const empty = parseCustomerWorkspaceQuery({ get: () => null });
assert(empty.channel === 'ALL', 'default channel');
assert(empty.tab === 'identity', 'default tab');
assert(empty.status === '', 'default status');

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
assert(parsed.channel === 'RETAIL', 'channel');
assert(parsed.q === 'ترنم', 'q trim');
assert(parsed.status === 'PENDING', 'status');
assert(parsed.segment === 'VIP', 'segment');
assert(parsed.tab === 'wallet', 'tab');
assert(parsed.marketingTab === 'rules', 'mtab rules');

const zeroParsed = parseCustomerWorkspaceQuery({
  get: (name) =>
    ({
      channel: 'WHOLESALE',
      mtab: 'zero',
      bucket: 'warm',
    } as Record<string, string>)[name] ?? null,
});
assert(zeroParsed.marketingTab === 'zero', 'mtab zero');
assert(zeroParsed.bucket === 'warm', 'bucket');
const zeroQs = serializeCustomerWorkspaceQuery(zeroParsed);
assert(/mtab=zero/.test(zeroQs), 'serialize mtab');
assert(/bucket=warm/.test(zeroQs), 'serialize bucket');

const blastParsed = parseCustomerWorkspaceQuery({
  get: (name) =>
    ({
      channel: 'RETAIL',
      mtab: 'blast',
    } as Record<string, string>)[name] ?? null,
});
assert(blastParsed.marketingTab === 'blast', 'mtab blast');
assert(/mtab=blast/.test(serializeCustomerWorkspaceQuery(blastParsed)), 'serialize blast');

const qs = serializeCustomerWorkspaceQuery(parsed);
assert(/channel=RETAIL/.test(qs), 'serialize channel');
assert(/tab=wallet/.test(qs), 'serialize tab');
assert(serializeCustomerWorkspaceQuery({ channel: 'ALL', tab: 'identity' }) === '', 'empty qs');

console.log('admin-customer-workspace.spec.ts: ok');

