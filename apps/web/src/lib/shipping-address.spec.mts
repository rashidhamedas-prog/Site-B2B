import assert from 'node:assert/strict';
import {
  composeStreetLine,
  finalizeShippingAddress,
  isAddressReady,
  isValidIranPostal,
  postalDigits,
  streetSignificantLen,
  toSavedAddressPayload,
  validateShippingAddress,
} from './shipping-address';

assert.equal(postalDigits('۹۱۷۳۵۱۲۳۴۵'), '9173512345', 'persian postal');
assert.equal(postalDigits('9173512345'), '9173512345', 'latin postal');
assert.equal(isValidIranPostal('۹۱۷۳۵۱۲۳۴۵'), true, 'fa postal valid');
assert.equal(isValidIranPostal('1111111111'), false, 'repeat postal');
assert.equal(isValidIranPostal('91735'), false, 'short postal');

const short = {
  recipient: 'علی رضایی',
  mobile: '۰۹۱۵۱۲۳۴۵۶۷',
  province: 'خراسان رضوی',
  city: 'مشهد',
  street: 'آز',
  postalCode: '۹۱۷۳۵۱۲۳۴۵',
};
assert.ok(validateShippingAddress(short, 'torobpay').street, 'short street fails torobpay');
assert.equal(isAddressReady(short, 'torobpay'), false, 'not ready');

const withPlaque = { ...short, plaque: '۱۲' };
assert.ok(streetSignificantLen(withPlaque) >= 8, 'plaque lengthens street');
assert.equal(isAddressReady(withPlaque, 'torobpay'), true, 'plaque makes torobpay ready');
assert.match(composeStreetLine(withPlaque), /پلاک/, 'plaque in compose');

const full = {
  recipient: 'علی رضایی',
  mobile: '09151234567',
  province: 'خراسان رضوی',
  city: 'مشهد',
  street: 'خیابان احمدآباد پلاک ۱۲',
  postalCode: '9173512345',
};
assert.equal(isAddressReady(full, 'torobpay'), true, 'full ready');
assert.equal(validateShippingAddress(full, 'standard').postalCode, undefined, 'standard ok');

const finalized = finalizeShippingAddress({
  ...short,
  alley: '۲۰',
  plaque: '۱۲',
  unit: '۳',
});
assert.equal(finalized.mobile, '09151234567', 'finalize mobile');
assert.equal(finalized.postalCode, '9173512345', 'finalize postal latin');
assert.match(finalized.street, /کوچه/, 'alley composed');
assert.match(finalized.street, /واحد/, 'unit composed');
assert.equal('plaque' in finalized, false, 'finalize omits plaque');
assert.equal('alley' in finalized, false, 'finalize omits alley');
assert.equal('unit' in finalized, false, 'finalize omits unit');

const saved = toSavedAddressPayload(
  { ...short, alley: '۲۰', plaque: '۱۲', unit: '۳' },
  { isDefault: true },
);
assert.equal(saved.isDefault, true, 'default flag kept');
assert.equal('plaque' in saved, false, 'api payload omits plaque');
assert.equal('alley' in saved, false, 'api payload omits alley');
assert.equal('unit' in saved, false, 'api payload omits unit');
assert.match(saved.street, /پلاک/, 'plaque composed into street');

const cashShortPostal = { ...full, postalCode: '12' };
assert.ok(validateShippingAddress(cashShortPostal, 'standard').postalCode, 'partial postal invalid in standard');
assert.equal(validateShippingAddress({ ...full, postalCode: '' }, 'standard').postalCode, undefined, 'empty postal ok standard');

console.log('shipping-address spec ok');
