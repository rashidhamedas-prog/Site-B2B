/**
 * npx ts-node --transpile-only src/modules/sms-panel/audience/audience.spec.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WHOLESALE_REFERRAL_PARTNER_STATUSES } from '../../wholesale-referral/wholesale-referral-policy';
import { SALES_PARTNER_PROFILE_STATUSES } from '../../sales-partner/sales-partner-policy';
import { mergeAudienceHits, presentAudienceContact, settleSources } from './audience-merge';
import {
  audienceSourceForCustomerType,
  buildCustomerQuery,
  buildPartnerQuery,
  customerHasSmsPromoConsent,
  defaultPartnerPromoConsent,
  hitsFromCustomerRows,
  hitsFromReferrals,
  hitsFromSalesPartners,
  isBlacklistActive,
  loadSourceHits,
  partnerConsentAfterInbound,
  type AudienceDb,
} from './audience-sources';
import type { AudienceHit, AudienceSource } from './audience.types';

const WHOLESALE = '09120000001';
const PARTNER = '09120000002';
const RETAIL = '09120000003';
const REFERRAL = '09120000004';

function hit(partial: Partial<AudienceHit> & Pick<AudienceHit, 'phoneRaw' | 'source' | 'name'>): AudienceHit {
  return {
    phoneKind: 'PRIMARY',
    promoConsent: false,
    orderCount: 0,
    orderStatuses: [],
    ...partial,
  };
}

function mergedName(hits: AudienceHit[]) {
  const { contacts } = mergeAudienceHits({ hits });
  assert.equal(contacts.length, 1);
  return contacts[0];
}

const pairs: Array<[AudienceSource, AudienceSource, string]> = [
  ['WHOLESALE', 'WHOLESALE_REFERRAL', 'عمده'],
  ['WHOLESALE', 'SALES_PARTNER', 'عمده'],
  ['WHOLESALE', 'RETAIL', 'عمده'],
  ['WHOLESALE_REFERRAL', 'SALES_PARTNER', 'معرف'],
  ['WHOLESALE_REFERRAL', 'RETAIL', 'معرف'],
  ['SALES_PARTNER', 'RETAIL', 'همکار'],
];

for (const [left, right, winner] of pairs) {
  const row = mergedName([
    hit({ phoneRaw: WHOLESALE, source: left, name: left === 'WHOLESALE' ? 'عمده' : left === 'WHOLESALE_REFERRAL' ? 'معرف' : left === 'SALES_PARTNER' ? 'همکار' : 'خرده', city: 'شهر-چپ' }),
    hit({ phoneRaw: '+98' + WHOLESALE.slice(1), source: right, name: right === 'WHOLESALE' ? 'عمده' : right === 'WHOLESALE_REFERRAL' ? 'معرف' : right === 'SALES_PARTNER' ? 'همکار' : 'خرده', city: 'شهر-راست' }),
  ]);
  assert.equal(row.name, winner, `${left} vs ${right}`);
  assert.equal(row.sources.length, 2, `${left}+${right} badges`);
  assert.equal(row.phone, WHOLESALE, 'persian/plus98 collapse');
}

const persian = mergedName([
  hit({ phoneRaw: '۰۹۱۲۰۰۰۰۰۰۱', source: 'RETAIL', name: 'خرده' }),
  hit({ phoneRaw: '00989120000001', source: 'WHOLESALE', name: 'عمده', city: 'تهران' }),
]);
assert.equal(persian.phone, WHOLESALE);
assert.equal(persian.name, 'عمده');
assert.equal(persian.city, 'تهران');

const phone2Wins = mergedName([
  hit({
    phoneRaw: PARTNER,
    source: 'WHOLESALE',
    phoneKind: 'SECONDARY',
    name: 'عمده-الف',
    city: 'اصفهان',
    customerId: 'cust-a',
  }),
  hit({
    phoneRaw: PARTNER,
    source: 'SALES_PARTNER',
    name: 'همکار-ب',
    salesPartnerId: 'sp-b',
    city: 'شیراز',
  }),
]);
assert.equal(phone2Wins.name, 'عمده-الف');
assert.equal(phone2Wins.city, 'اصفهان');
assert.equal(phone2Wins.customerId, 'cust-a');

const sameCustomer = hitsFromCustomerRows(
  [{
    id: 'c1',
    phone: WHOLESALE,
    phone2: WHOLESALE,
    businessName: 'فروشگاه',
    ownerName: 'علی',
    type: 'B2B',
    segment: 'A',
    city: 'کرج',
    province: 'البرز',
  }],
  new Map([['c1', 'CHECKOUT']]),
  new Map(),
);
const sameMerged = mergeAudienceHits({ hits: sameCustomer.hits });
assert.equal(sameMerged.contacts.length, 1, 'phone2 equal to phone is one row');
assert.deepEqual(sameMerged.contacts[0].phoneKinds.sort(), ['PRIMARY', 'SECONDARY']);

const badSecondary = hitsFromCustomerRows(
  [{ id: 'c2', phone: RETAIL, phone2: '123', businessName: 'خرده', type: 'B2C', city: 'رشت' }],
  new Map(),
  new Map(),
);
assert.ok(badSecondary.invalid.includes('123'));
assert.equal(audienceSourceForCustomerType('B2C'), 'RETAIL');
assert.equal(audienceSourceForCustomerType('RETAIL'), 'RETAIL');
assert.equal(badSecondary.hits[0].source, 'RETAIL');

assert.equal(customerHasSmsPromoConsent([{ channel: 'EMAIL', status: 'GRANTED', source: 'FORM' }]).ok, false);
assert.equal(customerHasSmsPromoConsent([{ channel: 'SMS', status: 'GRANTED', source: 'CHECKOUT' }]).source, 'CHECKOUT');

const fresh = defaultPartnerPromoConsent(new Date('2026-10-27T12:00:00.000Z'));
assert.equal(fresh.smsPromoConsent, true);
assert.equal(fresh.smsPromoConsentSource, 'OWNER_DEFAULT_POLICY');
const partnerHit = hitsFromSalesPartners([{
  id: 'sp1',
  phone: PARTNER,
  displayName: 'نگار',
  status: SALES_PARTNER_PROFILE_STATUSES[2],
  smsPromoConsent: true,
  smsPromoConsentSource: 'OWNER_DEFAULT_POLICY',
}]) ;
assert.equal(partnerHit.hits[0].promoConsent, true);
assert.equal(partnerHit.hits[0].consentSource, 'OWNER_DEFAULT_POLICY');

const referralHit = hitsFromReferrals([{
  id: 'rf1',
  phone: REFERRAL,
  displayName: 'معرف',
  status: WHOLESALE_REFERRAL_PARTNER_STATUSES[0],
  smsPromoConsent: true,
  smsPromoConsentSource: 'OWNER_DEFAULT_POLICY',
}]);
assert.equal(referralHit.hits[0].source, 'WHOLESALE_REFERRAL');
assert.equal(referralHit.hits[0].referralStatus, 'PENDING_PHONE');

const opted = mergeAudienceHits({
  hits: partnerHit.hits,
  optedOutPhones: [PARTNER],
});
assert.equal(opted.contacts[0].optedOut, true);
assert.equal(opted.contacts[0].promoConsent, false);
const stored = partnerConsentAfterInbound({
  smsPromoConsent: true,
  smsPromoConsentSource: 'OWNER_DEFAULT_POLICY',
});
assert.equal(stored.smsPromoConsent, true);
assert.equal(stored.smsPromoConsentSource, 'OWNER_DEFAULT_POLICY');

const now = new Date('2026-10-27T12:00:00.000Z');
assert.equal(isBlacklistActive({ expiresAt: '2026-10-27T11:00:00.000Z', scope: 'ALL' }, now), false);
assert.equal(isBlacklistActive({ expiresAt: '2026-10-28T11:00:00.000Z', scope: 'ALL' }, now), true);
assert.equal(isBlacklistActive({ expiresAt: null, scope: 'TRANSACTIONAL' }, now), false);
const blocked = mergeAudienceHits({
  hits: [hit({ phoneRaw: RETAIL, source: 'RETAIL', name: 'خرده', promoConsent: true, consentSource: 'SMS' })],
  blacklistedPhones: [RETAIL],
});
assert.equal(blocked.contacts[0].blacklisted, true);
assert.equal(blocked.contacts[0].promoConsent, false);

assert.equal(presentAudienceContact(blocked.contacts[0], 'SMS_OPERATOR').phone, '0912***0003');
assert.equal(presentAudienceContact(blocked.contacts[0], 'SMS_MARKETER').phone, '0912***0003');
assert.equal(presentAudienceContact(blocked.contacts[0], 'ADMIN').phone, RETAIL);
assert.equal(presentAudienceContact(blocked.contacts[0], 'SMS_MANAGER').phone, RETAIL);

const attack = `'; DROP TABLE customers; --`;
const built = buildCustomerQuery({ channel: 'WHOLESALE', q: attack });
assert.equal(built.sql.includes(attack), false);
assert.equal(String(built.params[0]).includes('DROP TABLE'), true);
const partnerSql = buildPartnerQuery('sales_partner_profiles', { q: attack });
assert.equal(partnerSql.sql.includes(attack), false);

async function main() {
  const calls: string[] = [];
  const db: AudienceDb = {
    async query(sql: string) {
      calls.push(sql);
      if (sql.includes('sales_partner_profiles')) throw new Error('partner down');
      if (sql.includes('FROM customers')) return [];
      return [];
    },
  };
  await assert.rejects(() => loadSourceHits(db, 'SALES_PARTNER', { q: 'نگار' }));
  const settled = await settleSources<number>({
    WHOLESALE: async () => [1],
    WHOLESALE_REFERRAL: async () => [2],
    SALES_PARTNER: async () => {
      throw new Error('down');
    },
    RETAIL: async () => [4],
  });
  assert.deepEqual(settled.partialSources, ['SALES_PARTNER']);
  assert.equal(settled.rows.length, 3);

  const inbound = readFileSync(join(__dirname, '..', 'sms-panel.service.ts'), 'utf8');
  const start = inbound.indexOf('async pollInbound()');
  const end = inbound.indexOf('async pollDelivery()');
  const body = inbound.slice(start, end);
  assert.equal(body.includes('smsPromoConsent'), false, 'inbound must not rewrite the partner consent flag');
  assert.ok(calls.some((sql) => sql.includes('sales_partner_profiles')));

  console.log('audience.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
