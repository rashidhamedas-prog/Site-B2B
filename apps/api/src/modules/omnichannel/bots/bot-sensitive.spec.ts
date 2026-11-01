import {
  classifySensitive,
  ensureSensitiveTag,
  findSensitiveKeyword,
  SENSITIVE_TAG,
} from './bot-sensitive';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(findSensitiveKeyword('می‌خوام نسیه بگیرم') === 'نسیه', 'keyword نسیه');
assert(findSensitiveKeyword('سلام محصول') === null, 'no keyword');

const first = classifySensitive({ text: 'سفارش ۱۰ عدد', hasPriorPfi: false });
assert(first.sensitive && first.reason === 'first_order', 'first order sensitive');

const returning = classifySensitive({ text: 'سفارش ۱۰ عدد', hasPriorPfi: true });
assert(!returning.sensitive, 'returning not sensitive');

const kw = classifySensitive({ text: 'شکایت دارم', hasPriorPfi: true });
assert(kw.sensitive && kw.reason === 'keyword', 'keyword overrides');

assert(ensureSensitiveTag([]).includes(SENSITIVE_TAG), 'tag added');
assert(ensureSensitiveTag([SENSITIVE_TAG]).length === 1, 'tag idempotent');

console.log('bot-sensitive.spec.ts: ok');
