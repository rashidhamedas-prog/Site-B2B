/**
 * npx ts-node --transpile-only src/lib/admin-desk.spec.ts
 */
import assert from 'node:assert/strict';
import {
  DESK_SURFACES,
  attentionItems,
  channelLabel,
  growthSentence,
  orderChannel,
  type DeskStats,
} from './admin-desk.ts';

const quiet: DeskStats = {
  orders: { pending: 0 },
  ordersByStatus: {},
  customers: { pending: 0 },
  revenue: { outstanding: 0 },
  lowStock: [],
};

assert.deepEqual(attentionItems(quiet).map((item) => item.id), [], 'empty desk stays quiet');

const busy = attentionItems({
  orders: { pending: 2 },
  ordersByStatus: { AWAITING_PAYMENT: 4 },
  customers: { pending: 1 },
  revenue: { outstanding: 5000 },
  lowStock: [{}, {}],
  channels: {
    wholesale: { revenueThisMonth: 1, ordersThisMonth: 1, pendingReview: 1, activeCustomers: 1, openTickets: 3 },
    retail: { revenueThisMonth: 1, ordersThisMonth: 1, pendingReview: 1, activeCustomers: 1, openTickets: 1 },
  },
  ops: { openReturns: 2, criticalStock: 9, unpaidInvoices: 0 },
});

assert.deepEqual(
  busy.map((item) => item.id),
  ['review', 'unpaid', 'customers', 'tickets', 'returns', 'stock', 'invoices'],
  'both storefront queues surface',
);
const four = (4).toLocaleString('fa-IR');
const nine = (9).toLocaleString('fa-IR');
assert.equal(busy.find((item) => item.id === 'tickets')?.detail.includes(four), true, 'ticket total is both channels');
assert.equal(busy.find((item) => item.id === 'stock')?.detail.includes(nine), true, 'stock uses full count');
assert.equal(busy.find((item) => item.id === 'invoices')?.label, 'مطالبات', 'money without invoice count is not a fake invoice');

assert.equal(orderChannel('RETAIL_WEBSITE'), 'retail');
assert.equal(orderChannel('WHOLESALE'), 'wholesale');
assert.equal(orderChannel(null), 'wholesale');
assert.equal(channelLabel('retail'), 'تک');
assert.equal(growthSentence(412), `${(412).toLocaleString('fa-IR')}٪ بیشتر از ماه قبل`);
assert.equal(growthSentence(-3), `${(3).toLocaleString('fa-IR')}٪ کمتر از ماه قبل`);
assert.equal(growthSentence(0), 'هم‌اندازه ماه قبل');

const hrefs = DESK_SURFACES.flatMap((group) => group.items.map((item) => item.href));
for (const href of ['/admin/support', '/admin/rma', '/admin/sales-partners', '/admin/omnichannel', '/admin/inventory', '/admin/site-content']) {
  assert.equal(hrefs.includes(href), true, href);
}

console.log('admin-desk.spec.ts ok');
