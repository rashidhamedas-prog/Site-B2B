import { normalizeOrderBadgeLabel, resolveWholesaleOrderBadge } from './wholesale-order-badge';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  resolveWholesaleOrderBadge({ minOrderQty: 1 }) === 'حداقل ۱ پک',
  'default uses packs not pieces',
);
assert(
  resolveWholesaleOrderBadge({ minOrderQty: 6 }) === 'حداقل ۶ پک',
  'default respects MOQ',
);
assert(
  resolveWholesaleOrderBadge({ orderBadgeLabel: '  حداقل یک پک کامل  ', minOrderQty: 9 }) ===
    'حداقل یک پک کامل',
  'custom text replaces the whole chip',
);
assert(
  resolveWholesaleOrderBadge({ orderBadgeLabel: 'پک همکاری', minOrderQty: 1 }) === 'پک همکاری',
  'short custom labels allowed',
);
assert(normalizeOrderBadgeLabel('  ') === null, 'blank becomes null');
assert(normalizeOrderBadgeLabel('حداقل ۲ پک') === 'حداقل ۲ پک', 'keeps meaningful text');
assert(normalizeOrderBadgeLabel('a'.repeat(100))?.length === 80, 'caps at 80');

console.log('wholesale-order-badge.spec.ts OK');
