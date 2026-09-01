/**
 * npx ts-node --transpile-only src/modules/auth/customer-addresses.spec.ts
 */
import { normalizeAddressList, removeAddress, upsertAddress } from './customer-addresses';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  recipient: 'علی رضایی',
  mobile: '۰۹۱۵۱۲۳۴۵۶۷',
  province: 'خراسان رضوی',
  city: 'مشهد',
  street: 'بلوار نبوت پلاک ۱',
  postalCode: '1234567890',
};

const first = upsertAddress([], base);
assert(first.length === 1, 'add first');
assert(first[0]!.mobile === '09151234567', 'persian mobile normalized');
assert(first[0]!.isDefault === true, 'first is default');

const second = upsertAddress(first, {
  ...base,
  recipient: 'مریم',
  mobile: '09150000000',
  street: 'خیابان امام',
  isDefault: true,
});
assert(second.length === 2, 'add second');
assert(second.filter((a) => a.isDefault).length === 1, 'one default');
assert(second.find((a) => a.recipient === 'مریم')?.isDefault === true, 'new default wins');

const updated = upsertAddress(second, { ...second[0]!, street: 'آدرس جدید' });
assert(updated.find((a) => a.id === second[0]!.id)?.street === 'آدرس جدید', 'edit street');

const removed = removeAddress(updated, updated.find((a) => a.isDefault)!.id);
assert(removed.length === 1, 'removed default');
assert(removed[0]!.isDefault === true, 'remaining becomes default');

assert(normalizeAddressList(null).length === 0, 'null list');
assert(normalizeAddressList([{ junk: true }]).length === 0, 'corrupt skipped');

let overflow = first;
for (let i = 0; i < 9; i++) {
  overflow = upsertAddress(overflow, {
    ...base,
    recipient: `n${i}`,
    street: `s${i}`,
    mobile: `0915100000${i}`,
  });
}
assert(overflow.length === 10, 'filled to 10');
try {
  upsertAddress(overflow, { ...base, recipient: 'extra', street: 'extra', mobile: '09159999999' });
  throw new Error('should cap');
} catch (e) {
  assert(e instanceof Error && String(e.message).includes('حداکثر'), 'cap at 10');
}

console.log('customer-addresses.spec.ts: ok');
