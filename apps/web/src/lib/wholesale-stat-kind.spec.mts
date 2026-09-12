import { resolveWholesaleStatKind } from './wholesale-stat-kind.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolveWholesaleStatKind({ label: 'مشتری عمده‌فروش' }) === 'customers', 'customer label');
assert(resolveWholesaleStatKind({ label: 'مشتری فعال' }) === 'customers', 'active customer');
assert(resolveWholesaleStatKind({ label: 'سال تجربه' }) === 'years', 'years label');
assert(resolveWholesaleStatKind({ label: 'سال تأسیس' }) === 'years', 'founded label');
assert(resolveWholesaleStatKind({ label: 'مدل فعال' }) === 'models', 'models label');
assert(resolveWholesaleStatKind({ label: 'در هر فصل' }) === 'models', 'season label');
assert(resolveWholesaleStatKind({ label: 'نفر پرسنل' }) === 'team', 'staff label');
assert(resolveWholesaleStatKind({ label: 'تیم تولید' }) === 'team', 'team label');
assert(resolveWholesaleStatKind({ label: 'سایر' }) === 'default', 'unknown label');
assert(resolveWholesaleStatKind({ label: 'سایر', icon: 'users' }) === 'customers', 'icon override');
assert(resolveWholesaleStatKind({ label: 'مشتری', icon: 'team' }) === 'team', 'kind name wins');
assert(resolveWholesaleStatKind({ icon: 'Store' }) === 'customers', 'case-insensitive icon');
assert(resolveWholesaleStatKind({}) === 'default', 'empty falls back');

console.log('wholesale-stat-kind.spec.mts: ok');
