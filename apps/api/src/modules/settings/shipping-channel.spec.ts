import * as assert from 'node:assert/strict';
import {
  DEFAULT_RETAIL_COMPANIES,
  DEFAULT_WHOLESALE_COMPANIES,
  IN_PERSON_ID,
  addressPlace,
  ensureInPersonCompany,
  isInPersonMethod,
  resolveChannelCompanies,
  resolveShippingPost,
  shippingPostForChannel,
} from './shipping-channel';

const legacyCompanies = [
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 10 },
  { id: 'FREIGHT', label: 'باربری', isActive: false, sort: 40 },
];

const fromLegacy = resolveChannelCompanies({ companies: legacyCompanies }, 'WHOLESALE');
assert.equal(fromLegacy.length, 2);
assert.equal(fromLegacy[1].isActive, false);
assert.equal(fromLegacy.some((c) => c.id === IN_PERSON_ID), false);
assert.equal(resolveChannelCompanies({ companies: legacyCompanies }, 'RETAIL')[0].id, 'PISHTAZ');
assert.equal(
  resolveChannelCompanies({ companies: legacyCompanies }, 'RETAIL').length,
  DEFAULT_RETAIL_COMPANIES.length,
);
assert.ok(resolveChannelCompanies({ companies: legacyCompanies }, 'RETAIL').some((c) => c.id === IN_PERSON_ID));

const split = resolveChannelCompanies(
  {
    companies: legacyCompanies,
    retail: { companies: [{ id: 'TIPAX', label: 'تیپاکس تکی', isActive: true, sort: 1 }] },
    wholesale: { companies: [{ id: 'OTHER', label: 'سایر عمده', isActive: true, sort: 1 }] },
  },
  'RETAIL',
);
assert.equal(split.length, 1);
assert.equal(split[0].id, 'TIPAX');
assert.equal(split.some((c) => c.id === IN_PERSON_ID), false);

const retailWithoutPickup = resolveChannelCompanies(
  {
    retail: {
      companies: [
        { id: 'PISHTAZ', label: 'پست پیشتاز', isActive: true, sort: 10 },
        { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
      ],
    },
  },
  'RETAIL',
);
assert.equal(retailWithoutPickup.map((c) => c.id).join(','), 'PISHTAZ,TIPAX');

const retailEmptySaved = resolveChannelCompanies({ retail: { companies: [] } }, 'RETAIL');
assert.equal(retailEmptySaved.length, 0);

assert.equal(
  resolveChannelCompanies(
    {
      retail: { companies: [{ id: 'TIPAX', label: 'تیپاکس تکی', isActive: true, sort: 1 }] },
      wholesale: { companies: [{ id: 'OTHER', label: 'سایر عمده', isActive: true, sort: 1 }] },
    },
    'WHOLESALE',
  )[0].id,
  'OTHER',
);

const alreadyNamed = ensureInPersonCompany([
  { id: 'SHIP_1', label: 'تحویل حضوری مشهد', isActive: true, sort: 1 },
]);
assert.equal(alreadyNamed.length, 1);
assert.equal(isInPersonMethod('in_person'), true);
assert.equal(isInPersonMethod('PISHTAZ'), false);

const empty = resolveChannelCompanies({}, 'WHOLESALE');
assert.equal(empty[0].id, DEFAULT_WHOLESALE_COMPANIES[0].id);
assert.ok(empty.some((c) => c.id === IN_PERSON_ID));

const legacyPost = resolveShippingPost({
  enabled: true,
  originCity: 'مشهد',
  otherBase: 2_000_000,
});
assert.equal(legacyPost.retail.enabled, true);
assert.equal(legacyPost.wholesale.enabled, true);
assert.equal(legacyPost.retail.otherBase, 2_000_000);
assert.equal(legacyPost.wholesale.originCity, 'مشهد');

const nestedPost = resolveShippingPost({
  retail: { enabled: true, otherBase: 1_100_000 },
  wholesale: { enabled: false, otherBase: 900_000 },
});
assert.equal(nestedPost.retail.enabled, true);
assert.equal(nestedPost.wholesale.enabled, false);
assert.equal(shippingPostForChannel(nestedPost, 'WHOLESALE').otherBase, 900_000);

assert.deepEqual(addressPlace({ province: 'تهران', city: 'تهران' }), {
  province: 'تهران',
  city: 'تهران',
});
assert.deepEqual(addressPlace(JSON.stringify({ province: 'فارس', city: 'شیراز' })), {
  province: 'فارس',
  city: 'شیراز',
});
assert.deepEqual(addressPlace('not-json'), {});

console.log('shipping-channel.spec.ts: OK');
