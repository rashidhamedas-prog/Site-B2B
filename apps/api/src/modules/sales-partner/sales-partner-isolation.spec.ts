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
const attribution = read('sales-partner-attribution.ts');
const ledger = read('sales-partner-ledger.service.ts');
const payout = read('sales-partner-payout.service.ts');
const jwt = readFileSync(join(__dirname, '../auth/strategies/jwt.strategy.ts'), 'utf8');
const login = readFileSync(join(__dirname, '../auth/auth.service.ts'), 'utf8');
const channel = readFileSync(join(__dirname, '../../../../web/src/lib/channel.ts'), 'utf8');
const middleware = readFileSync(join(__dirname, '../../../../web/src/middleware.ts'), 'utf8');
const shell = readFileSync(join(__dirname, '../../../../web/src/components/sales-partners/SalesPartnerShell.tsx'), 'utf8');
const payouts = readFileSync(join(__dirname, '../../../../web/src/app/sales-partners/payouts/page.tsx'), 'utf8');
const confirm = readFileSync(join(__dirname, '../../../../web/src/components/sales-partners/SalesPartnerConfirm.tsx'), 'utf8');
const newOrder = readFileSync(join(__dirname, '../../../../web/src/components/sales-partners/SalesPartnerNewOrder.tsx'), 'utf8');
const apply = readFileSync(join(__dirname, '../../../../web/src/components/sales-partners/SalesPartnershipApply.tsx'), 'utf8');
const terms = readFileSync(join(__dirname, '../../../../web/src/components/sales-partners/SalesPartnerTerms.tsx'), 'utf8');

assert(/isSalesPartnerPurpose\(req\.user\?\.purpose\)/.test(me), 'me routes require purpose');
assert(/salesPartnerId/.test(me) && /ownedDraft|getMine|listMine/.test(draft), 'partner id required');
assert(/where:\s*\{\s*id:\s*draftId,\s*salesPartnerId/.test(draft), 'owned draft scopes by partner');
assert(/humanPartnerOrderStatus/.test(draft), 'partner sees retail order status after convert');
assert(/partnerCommissionOverlay/.test(draft), 'delivered orders overlay hold/available');
assert(/draftItemFreshness/.test(draft), 'open drafts warn on price or stock drift');
assert(/listAdmin[\s\S]*orderStatus/.test(draft), 'admin list uses retail order status');
assert(/type:\s*'RETAIL_WEBSITE'/.test(draft), 'convert stays retail website');
assert(/resolveConfirmPaymentMethod|resendBlockedReason|smsFailureBlocksSend/.test(draft), 'error-scenario helpers wired');
assert(/partnerOrderAttribution/.test(draft), 'convert stamps salesSource columns');
assert(/affiliateId:\s*null/.test(attribution), 'convert clears external affiliate');
assert(!/affiliateId:\s*['"`]/.test(draft + attribution), 'must not set affiliate click id');
assert(/adminChangeAttribution/.test(draft), 'admin attribution change exists');
assert(/idempotencyKey:\s*`sp-draft:\$\{locked\.id\}`/.test(draft), 'convert idempotency');
assert(/if \(locked\.convertedOrderId\) return/.test(draft), 'convert short-circuit');
assert(/hashConfirmationToken/.test(draft) && !/confirmationTokenHash:\s*token/.test(draft), 'token hashed');
assert(/programAllowsPartnerAction/.test(draft), 'flag gates drafts');
assert(!/VendorLedger/.test(ledger) && !/vendor_ledger/.test(ledger), 'no vendor ledger reuse');
assert(/pessimistic_write/.test(payout), 'payout row lock');
assert(/idempotencyKey/.test(payout), 'payout idempotent');
assert(/purpose === 'sales_partner'/.test(jwt), 'jwt loads sales partner purpose');
assert(/purpose === 'sales_partner'/.test(login) && /صفحه همکاران بازاریاب/.test(login), 'shared login rejects sales_partner');
assert(/isSalesPartnerPanelPath/.test(channel), 'retail rewrite exempts panel without matching partnership');
assert(!/pathname\.startsWith\('\/sales-partners'\)/.test(channel), 'panel path must not prefix-match partnership');
assert(/isSalesPartnerPanelPath\(adminPath\)/.test(middleware), 'middleware gates panel only');
assert(/humanRiskFlags/.test(read('sales-partner.service.ts')), 'admin sees risk labels');
assert(!/riskFlags/.test(me), 'partner me omits risk flags');
assert(/refreshRiskFlags/.test(draft), 'risk flags refresh after draft events');
assert(/Get\('me'\)/.test(auth), 'GET me exists');
assert(/Get\('orders\/:id'\)/.test(me), 'GET order by id exists');
assert(/sales_partner\.application\.submitted/.test(read('sales-partner-events.ts')), 'outbox event names');
assert(/AdminOnly/.test(read('sales-partner-admin.controller.ts')), 'admin API stays ADMIN-only');
assert(/Get\('audits'\)/.test(read('sales-partner-admin.controller.ts')), 'admin audits');
assert(/Get\('reports'\)/.test(read('sales-partner-admin.controller.ts')), 'admin reports');
assert(/orders\/:id\/attribution/.test(read('sales-partner-admin.controller.ts')), 'admin attribution route');
assert(/dir="rtl"/.test(shell) && /aria-label="ناوبری پنل همکار بازاریاب"/.test(shell), 'rtl shell + nav label');
assert(/focus-visible:outline/.test(shell), 'keyboard focus on partner nav');
assert(/role="status"/.test(payouts) && /Asia\/Tehran/.test(payouts), 'payout loading + Tehran dates');
assert(/htmlFor="cf-name"/.test(confirm) && /فروشنده اصلی/.test(confirm), 'confirm labels + Taranom seller');
assert(!/درآمد تضمینی|فروش قطعی/.test(confirm + shell + payouts), 'no hype copy');
assert(/LOCAL_DRAFT_KEY/.test(newOrder) && /catalogLoading/.test(newOrder), 'local draft + catalog loading');
assert(/2026-09-23-v1/.test(terms) && /تأمین‌کننده ارسال/.test(terms), 'owner terms version exists');
assert(/sales-partnership\/terms/.test(apply), 'apply links published terms');

console.log('sales-partner-isolation.spec.ts: OK');
