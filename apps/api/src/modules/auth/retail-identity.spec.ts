import {
  isUnconfirmedRetailPlace,
  patchRetailCustomerIdentity,
  retailSignupIdentity,
  usablePersonName,
} from './retail-identity';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(usablePersonName('خریدار ترنم') === null, 'placeholder rejected');
assert(usablePersonName('  ') === null, 'blank rejected');
assert(usablePersonName('م') === null, 'one char rejected');
assert(usablePersonName('مهدی فیاضی') === 'مهدی فیاضی', 'real name kept');

const fresh = retailSignupIdentity({ name: '', otpName: 'خریدار ترنم', province: 'ا', city: 'اصفهان' });
assert(fresh.name === null && fresh.province === null && fresh.city === 'اصفهان', 'signup facts');

const placeholder = {
  ownerName: 'خریدار ترنم',
  businessName: 'خریدار ترنم',
  province: 'تهران',
  city: 'تهران',
  address: '',
  postalCode: '',
};
assert(isUnconfirmedRetailPlace(placeholder), 'default tehran is unconfirmed');
const filled = patchRetailCustomerIdentity(placeholder, {
  name: 'آزادوئیل',
  province: 'اصفهان',
  city: 'اصفهان',
  street: 'خیابان نمونه ۱۲',
  postalCode: '1234567890',
});
assert(filled.ownerName === 'آزادوئیل', 'owner replaced');
assert(filled.businessName === 'آزادوئیل', 'business replaced');
assert(filled.city === 'اصفهان', 'city replaced');
assert(filled.address === 'خیابان نمونه ۱۲', 'street filled');

const kept = patchRetailCustomerIdentity(
  { ...placeholder, ownerName: 'مهدی فیاضی', businessName: 'فروشگاه مهدی', province: 'فارس', city: 'شیراز', address: 'خیابان الف' },
  { name: 'نام دیگر', province: 'تهران', city: 'تهران', street: 'نباید عوض شود چون آدرس دارد' },
);
assert(Object.keys(kept).length === 0, 'real profile stays');

console.log('retail-identity.spec.ts: OK');
