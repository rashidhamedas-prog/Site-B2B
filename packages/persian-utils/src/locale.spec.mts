import { shapeDigitsInText } from './locale.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(shapeDigitsInText('12', 'fa') === '۱۲', 'latin to fa');
assert(shapeDigitsInText('۱۲', 'fa') === '۱۲', 'fa stays fa');
assert(shapeDigitsInText('+120', 'fa') === '+۱۲۰', 'prefix kept');
assert(shapeDigitsInText('12', 'en') === '12', 'en latin');
assert(shapeDigitsInText('۱۲', 'en') === '12', 'fa to en');
assert(shapeDigitsInText('سال 1401', 'fa') === 'سال ۱۴۰۱', 'digits inside copy');
assert(shapeDigitsInText('سال ۱۴۰۱', 'en') === 'سال 1401', 'latinize inside copy');

console.log('locale.spec.mts: OK');
