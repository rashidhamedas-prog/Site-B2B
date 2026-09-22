import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(rel: string) {
  return readFileSync(join(__dirname, rel), 'utf8');
}

const me = read('sales-partner-me.controller.ts');
const auth = read('sales-partner-auth.controller.ts');
const draft = read('sales-partner-draft.service.ts');
const ledger = read('sales-partner-ledger.service.ts');
const payout = read('sales-partner-payout.service.ts');
const jwt = readFileSync(join(__dirname, '../auth/strategies/jwt.strategy.ts'), 'utf8');
const login = readFileSync(join(__dirname, '../auth/auth.service.ts'), 'utf8');
const channel = readFileSync(join(__dirname, '../../../../web/src/lib/channel.ts'), 'utf8');

assert(/isSalesPartnerPurpose\(req\.user\?\.purpose\)/.test(me), 'me routes require purpose');
assert(/salesPartnerId/.test(me) && /ownedDraft|getMine|listMine/.test(draft), 'partner id required');
assert(/where:\s*\{\s*id:\s*draftId,\s*salesPartnerId/.test(draft), 'owned draft scopes by partner');
assert(/type:\s*'RETAIL_WEBSITE'/.test(draft), 'convert stays retail website');
assert(!/affiliateId/.test(draft), 'convert must not write affiliateId');
assert(/idempotencyKey:\s*`sp-draft:\$\{locked\.id\}`/.test(draft), 'convert idempotency');
assert(/if \(locked\.convertedOrderId\) return/.test(draft), 'convert short-circuit');
assert(/hashConfirmationToken/.test(draft) && !/confirmationTokenHash:\s*token/.test(draft), 'token hashed');
assert(/programAllowsPartnerAction/.test(draft), 'flag gates drafts');
assert(!/VendorLedger/.test(ledger) && !/vendor_ledger/.test(ledger), 'no vendor ledger reuse');
assert(/pessimistic_write/.test(payout), 'payout row lock');
assert(/idempotencyKey/.test(payout), 'payout idempotent');
assert(/purpose === 'sales_partner'/.test(jwt), 'jwt loads sales partner purpose');
assert(/purpose === 'sales_partner'/.test(login) && /صفحه همکاران بازاریاب/.test(login), 'shared login rejects sales_partner');
assert(/pathname\.startsWith\('\/sales-partners'\)/.test(channel), 'retail rewrite exempts panel');
assert(/Get\('me'\)/.test(auth), 'GET me exists');
assert(/Get\('orders\/:id'\)/.test(me), 'GET order by id exists');
assert(/sales_partner\.application\.submitted/.test(read('sales-partner-events.ts')), 'outbox event names');
assert(/AdminOnly/.test(read('sales-partner-admin.controller.ts')), 'admin API stays ADMIN-only');

console.log('sales-partner-isolation.spec.ts: OK');
