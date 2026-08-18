/**
 * npx ts-node --transpile-only src/common/public-slug.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import { normalizePublicSlug } from './public-slug';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizePublicSlug('Blouses00001') === 'blouses00001', 'lowercase ascii');

let threw = false;
try {
  normalizePublicSlug('');
} catch (e) {
  threw = e instanceof BadRequestException;
}
assert(threw, 'empty slug rejected');

threw = false;
try {
  normalizePublicSlug('hello world');
} catch (e) {
  threw = e instanceof BadRequestException;
}
assert(threw, 'whitespace rejected');

threw = false;
try {
  normalizePublicSlug('foo/bar');
} catch (e) {
  threw = e instanceof BadRequestException;
}
assert(threw, 'slash rejected');

threw = false;
try {
  normalizePublicSlug('admin');
} catch (e) {
  threw = e instanceof BadRequestException;
}
assert(threw, 'reserved admin rejected');

threw = false;
try {
  normalizePublicSlug('products');
} catch (e) {
  threw = e instanceof BadRequestException;
}
assert(threw, 'reserved products rejected');

const nazgol = normalizePublicSlug('مانتو-نازگل', 'item');
assert(!!nazgol && !/[^\x00-\x7F]/.test(nazgol), `persian becomes ascii, got ${nazgol}`);

console.log('public-slug.spec.ts OK');
