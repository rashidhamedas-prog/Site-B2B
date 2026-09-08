import * as assert from 'node:assert/strict';
import {
  DEFAULT_POST_TARIFF,
  localPostFeeIrr,
  provinceCode,
  resolvePostZone,
} from './iran-post-quote';

assert.equal(provinceCode('خراسان رضوی'), 7);
assert.ok(provinceCode('تهران'));
assert.equal(provinceCode(''), null);

assert.equal(
  resolvePostZone({ originProvince: 'خراسان رضوی', destProvince: 'خراسان رضوی', originCity: 'مشهد', destCity: 'مشهد' }),
  'same_city',
);
assert.equal(
  resolvePostZone({ originProvince: 'خراسان رضوی', destProvince: 'خراسان رضوی', originCity: 'مشهد', destCity: 'نیشابور' }),
  'same_province',
);
assert.equal(
  resolvePostZone({ originProvince: 'خراسان رضوی', destProvince: 'تهران', originCity: 'مشهد', destCity: 'تهران' }),
  'other',
);

const oneKgOther = localPostFeeIrr(0.9, 'other', DEFAULT_POST_TARIFF);
assert.equal(oneKgOther, Math.round(DEFAULT_POST_TARIFF.otherBase * 1.1));
const twoKg = localPostFeeIrr(1.2, 'other', DEFAULT_POST_TARIFF);
assert.ok(twoKg > oneKgOther);

console.log('iran-post-quote.spec.ts: OK');
