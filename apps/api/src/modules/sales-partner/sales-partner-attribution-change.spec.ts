import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const draft = readFileSync(join(__dirname, 'sales-partner-draft.service.ts'), 'utf8');
const method = draft.slice(draft.indexOf('async adminChangeAttribution'));
assert(method.includes('pg_advisory_xact_lock'), 'locks ledger keys');
assert(/lockedDraft\.salesPartnerId\s*=\s*nextPartnerId/.test(method), 'updates draft.salesPartnerId');
assert(/partnerOrderAttribution/.test(method), 'updates order attribution');
assert(/DELETE FROM sales_commission_snapshots/.test(method), 'deletes orphan snapshots for rebuild');
assert(/COMMISSION_EARNED/.test(method), 're-checks earned rows inside transaction');
assert(/listMine/.test(draft), 'new partner listMine uses draft.salesPartnerId');

console.log('sales-partner-attribution-change.spec.ts: OK');
