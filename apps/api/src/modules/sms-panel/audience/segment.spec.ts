/**
 * npx ts-node --transpile-only src/modules/sms-panel/audience/segment.spec.ts
 */
import * as assert from 'node:assert/strict';
import { QueryRunner } from 'typeorm';
import { SmsSegment1761523400003 } from '../../../database/migrations/20261027-003-sms-segment';
import { countSmsParts } from '../domain/parts';
import { previewAudience, readUnitPrice, worstCaseSmsBody } from './audience-preview';
import type { AudienceContact } from './audience.types';
import { canManageSegments } from './segment.service';
import { contactMatchesRules, normalizeFa, parseSegmentRules, SegmentRuleError } from './segment-rules';

function contact(partial: Partial<AudienceContact> & Pick<AudienceContact, 'phone' | 'sources'>): AudienceContact {
  return {
    phoneKinds: ['PRIMARY'],
    name: 'مشتری',
    orderCount: 0,
    orderStatuses: [],
    promoConsent: true,
    consentSource: 'SMS',
    optedOut: false,
    blacklisted: false,
    ...partial,
  };
}

assert.throws(() => parseSegmentRules({ or: [{ field: 'city', op: 'in', value: ['تهران'] }] }), SegmentRuleError);
assert.throws(() => parseSegmentRules([{ field: 'city', op: 'in', value: ['تهران'], rules: [] }]), SegmentRuleError);
assert.throws(() => parseSegmentRules([{ field: 'city; DROP TABLE customers', op: 'in', value: ['تهران'] }]), SegmentRuleError);
assert.throws(() => parseSegmentRules([{ field: 'city', op: 'in', value: 'تهران' }]), SegmentRuleError);

const rules = parseSegmentRules([
  { field: 'city', op: 'in', value: ['تهران'] },
  { field: 'orderCount', op: 'gte', value: 1 },
]);
assert.equal(rules.length, 2);
const tehran = contact({ phone: '09120000001', sources: ['WHOLESALE'], city: 'تهران', orderCount: 2 });
const yeh = contact({ phone: '09120000002', sources: ['WHOLESALE'], city: 'تهران'.replace('ی', 'ي'), orderCount: 2 });
assert.equal(normalizeFa('تهران'), normalizeFa('تهران'.replace('ی', 'ي')));
assert.equal(contactMatchesRules(tehran, rules).pass, true);
assert.equal(contactMatchesRules(yeh, rules).pass, true);
assert.equal(contactMatchesRules(contact({ phone: '09120000003', sources: ['WHOLESALE'], city: 'رشت', orderCount: 2 }), rules).pass, false);

const partner = contact({ phone: '09120000004', sources: ['SALES_PARTNER'], name: 'همکار', promoConsent: true });
assert.equal(contactMatchesRules(partner, parseSegmentRules([{ field: 'city', op: 'in', value: ['تهران'] }])).notApplicable, true);

const preview = previewAudience({
  contacts: [
    tehran,
    contact({ phone: '09120000005', sources: ['RETAIL'], city: 'تهران', orderCount: 3, promoConsent: false }),
    contact({ phone: '09120000006', sources: ['WHOLESALE'], city: 'تهران', orderCount: 4, optedOut: true }),
    contact({ phone: '09120000007', sources: ['WHOLESALE'], city: 'تهران', orderCount: 4, blacklisted: true }),
    partner,
  ],
  duplicateExtras: 2,
  invalid: 1,
  rules,
  messageClass: 'PROMO',
  text: 'سلام {name}',
  availableCredit: 1,
  unitPricePerPart: null,
});
assert.equal(preview.duplicates, 2);
assert.equal(preview.invalid, 1);
assert.equal(preview.optedOut, 1);
assert.equal(preview.blacklisted, 1);
assert.equal(preview.noConsent, 1);
assert.equal(preview.notApplicable, 1);
assert.equal(preview.final, 1);
assert.equal(preview.unitPricePerPart, null);
assert.equal(preview.estimatedCost, null);
assert.equal(preview.creditOk, false);
const body = worstCaseSmsBody('سلام {name}', 'PROMO');
assert.ok(body.endsWith('لغو11'));
assert.equal(preview.partsPerMsg, countSmsParts(body));
assert.ok(preview.partsPerMsg >= 2);

assert.equal(readUnitPrice({}), null);
assert.equal(readUnitPrice({ unitPricePerPart: 250 }), 250);
assert.equal(canManageSegments('SMS_OPERATOR'), false);
assert.equal(canManageSegments('SMS_MARKETER'), true);
assert.equal(canManageSegments('ADMIN'), true);

async function migration() {
  const calls: string[] = [];
  const runner = { async query(sql: string) { calls.push(sql); } } as QueryRunner;
  const mig = new SmsSegment1761523400003();
  await mig.up(runner);
  const up = calls.join('\n');
  assert.ok(up.includes('CREATE TABLE IF NOT EXISTS "sms_segment"'));
  assert.ok(up.includes('"segmentId"'));
  assert.ok(up.includes('"audienceSpec"'));
  calls.length = 0;
  await mig.down(runner);
  const down = calls.join('\n');
  assert.ok(down.includes('DROP TABLE IF EXISTS "sms_segment"'));
  assert.ok(down.includes('DROP COLUMN IF EXISTS "segmentId"'));
}

migration().then(() => {
  console.log('segment.spec.ts: ok');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
