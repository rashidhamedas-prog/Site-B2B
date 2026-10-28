import * as assert from 'node:assert/strict';
import { DEFAULT_PROMO_WINDOW } from '../domain/quiet-hours';
import { mergeAudienceHits } from './audience-merge';
import {
  approverIsCreator,
  bulkNeedsSecondApproval,
  canEditUnitPrice,
  decideSingleSend,
  decideUnitPricePatch,
  deferIfOutsideWindow,
  priceCaption,
  readStoredUnitPrice,
  scheduleOutsideWindow,
  snapshotContains,
  snapshotPhones,
} from './send-audience';

const contact = {
  promoConsent: true,
  optedOut: false,
  blacklisted: false,
  sources: ['WHOLESALE'],
};

for (const sources of [['WHOLESALE'], ['WHOLESALE_REFERRAL'], ['SALES_PARTNER'], ['RETAIL']]) {
  const decision = decideSingleSend({
    role: 'SMS_OPERATOR',
    messageClass: 'TRANSACTIONAL',
    contact: { ...contact, sources },
    withinWindow: true,
  });
  assert.equal(decision.ok, true, sources.join(','));
}

assert.equal(
  decideSingleSend({ role: 'ADMIN', messageClass: 'PROMO', contact: null, withinWindow: true }).ok,
  true,
);
assert.equal(
  decideSingleSend({
    role: 'SMS_MANAGER',
    messageClass: 'TRANSACTIONAL',
    contact: null,
    withinWindow: true,
  }).ok,
  true,
);
const offlist = decideSingleSend({
  role: 'ADMIN',
  messageClass: 'PROMO',
  contact: null,
  withinWindow: true,
});
assert.equal(offlist.ok && offlist.offlist, true);

assert.equal(
  decideSingleSend({
    role: 'ADMIN',
    messageClass: 'PROMO',
    contact: { ...contact, optedOut: true },
    withinWindow: true,
  }).ok,
  false,
);
assert.equal(
  decideSingleSend({
    role: 'SMS_MANAGER',
    messageClass: 'TRANSACTIONAL',
    contact: { ...contact, blacklisted: true },
    withinWindow: true,
  }).ok,
  false,
);
for (const role of ['SMS_OPERATOR', 'SMS_MARKETER']) {
  const denied = decideSingleSend({ role, messageClass: 'PROMO', contact: null, withinWindow: true });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, 'SMS_OFFLIST_FORBIDDEN');
}

assert.equal(
  decideSingleSend({
    role: 'SMS_MARKETER',
    messageClass: 'PROMO',
    contact: { ...contact, promoConsent: true, sources: ['SALES_PARTNER'] },
    withinWindow: true,
  }).ok,
  true,
);
assert.equal(
  decideSingleSend({
    role: 'SMS_MARKETER',
    messageClass: 'PROMO',
    contact: { ...contact, optedOut: true, sources: ['SALES_PARTNER'] },
    withinWindow: true,
  }).ok,
  false,
);

const merged = mergeAudienceHits({
  hits: [
    {
      phoneRaw: '09120000000',
      source: 'WHOLESALE',
      phoneKind: 'PRIMARY',
      name: 'الف',
      promoConsent: true,
    },
    {
      phoneRaw: '09120000000',
      source: 'RETAIL',
      phoneKind: 'SECONDARY',
      name: 'ب',
      promoConsent: false,
    },
  ],
  optedOutPhones: [],
  blacklistedPhones: [],
});
assert.equal(merged.contacts.length, 1);

assert.equal(
  decideSingleSend({
    role: 'ADMIN',
    messageClass: 'PROMO',
    contact: { ...contact, promoConsent: false },
    withinWindow: true,
  }).ok,
  false,
);
assert.equal(
  decideSingleSend({
    role: 'ADMIN',
    messageClass: 'PROMO',
    contact,
    withinWindow: false,
  }).ok,
  false,
);
assert.equal(
  decideSingleSend({ role: 'SMS_OPERATOR', messageClass: 'PROMO', contact, withinWindow: true }).ok,
  false,
);
assert.equal(
  decideSingleSend({
    role: 'SMS_MARKETER',
    messageClass: 'TRANSACTIONAL',
    contact,
    withinWindow: true,
  }).ok,
  false,
);

assert.equal(bulkNeedsSecondApproval(1), true);
assert.equal(bulkNeedsSecondApproval(0), true);
assert.equal(approverIsCreator('a', 'a'), true);
assert.equal(approverIsCreator('b', 'a'), false);

const outside = new Date('2026-10-27T22:30:00+03:30');
const blocked = scheduleOutsideWindow(outside, DEFAULT_PROMO_WINDOW);
assert.ok(blocked);
assert.ok(blocked?.nextAllowedAt);
const deferred = deferIfOutsideWindow(outside, DEFAULT_PROMO_WINDOW);
assert.ok(deferred.getTime() > outside.getTime());

const frozen = snapshotPhones(['09121111111', '09121111111']);
assert.deepEqual(frozen, ['09121111111']);
assert.equal(snapshotContains(frozen, '09122222222'), false);

assert.equal(canEditUnitPrice('SMS_MARKETER'), false);
assert.equal(canEditUnitPrice('ADMIN'), true);
assert.equal(readStoredUnitPrice(undefined), null);
assert.equal(readStoredUnitPrice('250'), null);
assert.equal(readStoredUnitPrice(250), 250);
assert.equal(priceCaption(null), 'قیمت تنظیم نشده');
assert.match(priceCaption(2500), /۲٬?۵۰۰|2[,.]?500/);
assert.ok(priceCaption(2500).includes('ریال'));

const denied = decideUnitPricePatch('SMS_MARKETER', 100);
assert.equal(denied.ok, false);
if (!denied.ok) {
  assert.equal(denied.http, 403);
  assert.equal(denied.code, 'SMS_FORBIDDEN');
}
const deniedOp = decideUnitPricePatch('SMS_OPERATOR', 100);
assert.equal(deniedOp.ok, false);
if (!deniedOp.ok) assert.equal(deniedOp.http, 403);

const negative = decideUnitPricePatch('ADMIN', -1);
assert.equal(negative.ok, false);
if (!negative.ok) {
  assert.equal(negative.http, 400);
  assert.equal(negative.code, 'SMS_INVALID_UNIT_PRICE');
}
const cleared = decideUnitPricePatch('SMS_MANAGER', null);
assert.deepEqual(cleared, { ok: true, value: null });
const set = decideUnitPricePatch('ADMIN', 180);
assert.deepEqual(set, { ok: true, value: 180 });

console.log('send-audience.spec.ts: ok');
