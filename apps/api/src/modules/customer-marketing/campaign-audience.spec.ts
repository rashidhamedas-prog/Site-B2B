/**
 * npx ts-node --transpile-only src/modules/customer-marketing/campaign-audience.spec.ts
 */
import {
  maskPhone,
  normalizeCustomerIds,
  parseCampaignAudienceFilter,
  smsSegmentHint,
} from './campaign-audience';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

const deduped = normalizeCustomerIds([a, a, 'nope', b, 1]);
assert(deduped.length === 2 && deduped[0] === a && deduped[1] === b, 'dedupe+uuid');
assert(normalizeCustomerIds(Array.from({ length: 120 }, () => a)).length === 1, 'same id once');
assert(
  normalizeCustomerIds(
    Array.from({ length: 120 }, (_, i) => {
      const n = String(i).padStart(12, '0');
      return `11111111-1111-4111-8111-${n}`;
    }),
  ).length === 100,
  'cap 100',
);

const parsed = parseCampaignAudienceFilter({
  grantedOnly: true,
  customerIds: [a],
  bodyOverride: ' سلام {name} ',
});
assert(parsed.customerIds[0] === a, 'parse ids');
assert(parsed.bodyOverride === 'سلام {name}', 'trim body');
assert(parseCampaignAudienceFilter(null).customerIds.length === 0, 'null filter');

assert(maskPhone('09123456789') === '0912…89', 'mask');
assert(smsSegmentHint('سلام').segments >= 1, 'persian segment');
assert(smsSegmentHint('a'.repeat(161)).segments >= 2, 'latin multi');

console.log('campaign-audience.spec.ts: ok');
