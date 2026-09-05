/**
 * npx ts-node --transpile-only src/modules/omnichannel/canary-ping.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  CANARY_PING_TEXT,
  DEFAULT_PRODUCT_TEMPLATE,
  canaryPingHasPersian,
  canaryPingLooksMojibake,
  formatTomanFromRial,
  renderPublicationText,
} from './canary-ping';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canaryPingHasPersian(), 'canary ping includes Persian letters');
assert(!canaryPingLooksMojibake(), 'canary ping is not question-mark mojibake');
assert(CANARY_PING_TEXT.includes('ترنم'), 'canary ping names the shop');
assert(!CANARY_PING_TEXT.includes('???'), 'source text has no ???');
assert(formatTomanFromRial(2_000_000) === '200000', 'rial to toman');
assert(
  renderPublicationText(DEFAULT_PRODUCT_TEMPLATE, {
    name: 'Sara',
    price: '200000',
    url: 'https://www.poshaktaranom.ir/products/sara',
  }).includes('https://www.poshaktaranom.ir/products/sara'),
  'template keeps url',
);

const svc = readFileSync(resolve(__dirname, 'services/omnichannel.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, 'controllers/omnichannel-admin.controller.ts'), 'utf8');
const admin = readFileSync(
  resolve(__dirname, '../../../../web/src/components/admin/AdminOmnichannel.tsx'),
  'utf8',
);

assert(svc.includes('CANARY_PING_TEXT'), 'service sends the server-owned ping text');
assert(svc.includes('renderPublicationLayout'), 'live product text uses the structured template');
assert(svc.includes('ensureProductTemplates'), 'legacy templates are upgraded automatically');
assert(svc.includes('resolveProductSourceId'), 'preview accepts slug, sku, or product url');
assert(svc.includes('imageCandidates'), 'product photos come from gallery candidates');
assert(svc.includes('markPublicationDelivered'), 'successful canary delivery can mark PUBLISHED');
assert(admin.includes('dryRun: true'), 'draft button stays dry-run');
assert(admin.includes('dryRun: false'), 'admin can enqueue one live canary product');
assert(svc.includes('selectCanaryTelegramDestinations'), 'ping still constrained by canary helper');
assert(ctl.includes('canary-ping'), 'admin route exists');
assert(admin.includes('canary-ping'), 'admin console exposes the ping');
assert(admin.includes('هنوز انتشاری ثبت نشده') && admin.includes('رویدادی در صف نیست'), 'empty states kept');

console.log('canary-ping.spec.ts: ok');
