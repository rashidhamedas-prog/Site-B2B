/**
 * npx ts-node --transpile-only src/lib/packing-slip.spec.ts
 */
import {
  buildPackingSlip,
  canShowPackingSlip,
  extractIranPostal,
  formatToman,
  parseStoredShippingAddress,
  postalBoxes,
  shipMethodLabel,
} from './packing-slip';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const jsonAddr = JSON.stringify({
  recipient: 'سارا احمدی',
  mobile: '09151234567',
  province: 'خراسان رضوی',
  city: 'مشهد',
  street: 'احمدآباد، پلاک 12',
  postalCode: '9187154321',
});

const parsed = parseStoredShippingAddress(jsonAddr);
assert(parsed.recipient === 'سارا احمدی', 'json recipient');
assert(parsed.postalCode === '9187154321', 'json postal');
assert(parsed.plaque === '12', 'plaque from composed street');

const free = parseStoredShippingAddress('تهران، نیاوران ۱۲');
assert(free.street.includes('نیاوران'), 'freeform street kept');
assert(free.city === '', 'freeform does not inherit default Mashhad');
assert(extractIranPostal('مشهد دفتر 09152424624') === '', 'mobile digits are not postal');
assert(extractIranPostal('مشهد 9187154321') === '9187154321', 'isolated 10-digit postal');

assert(postalBoxes('9187154321').join('') === '9187154321', 'ten postal boxes');
assert(postalBoxes('').length === 10, 'empty postal still ten cells');
assert(shipMethodLabel('PISHTAZ') === 'پست پیشتاز', 'ship label');
assert(formatToman(11600000) === (1160000).toLocaleString('fa-IR'), 'irr to toman');

assert(canShowPackingSlip('CONFIRMED'), 'confirmed packs');
assert(canShowPackingSlip('SHIPPED'), 'reprint after ship');
assert(!canShowPackingSlip('AWAITING_PAYMENT'), 'unpaid has no slip');
assert(!canShowPackingSlip('PENDING_REVIEW'), 'review is not packing');

const slip = buildPackingSlip(
  {
    orderNumber: 'ORD-2026-00036-4FEF94',
    createdAt: '2026-09-13T06:41:11.200Z',
    type: 'RETAIL_WEBSITE',
    shippingMethod: 'PISHTAZ',
    paymentMethod: 'ONLINE',
    shippingAddress: jsonAddr,
    subtotal: 11000000,
    discount: 0,
    shippingFee: 600000,
    total: 11600000,
    items: [
      {
        productName: 'شومیز سارا',
        sku: 'SARA-1',
        color: 'کرم',
        size: 'L',
        quantity: 2,
        unitPrice: 5500000,
        totalPrice: 11000000,
      },
    ],
  },
  { businessName: 'پوشاک ترنم', phone: '09152424624', officeAddress: 'مشهد، دفتر پخش' },
);

assert(slip.channelLabel === 'فروش تکی', 'retail channel');
assert(slip.recipient.name === 'سارا احمدی', 'recipient name');
assert(slip.recipient.postalCode === '9187154321', 'recipient postal');
assert(slip.sender.postalCode === '', 'no sender postal without settings field');
assert(slip.sender.name === 'پوشاک ترنم', 'sender from settings');

const slipWithPostal = buildPackingSlip(
  {
    orderNumber: 'ORD-2026-00036-4FEF94',
    createdAt: '2026-09-13T06:41:11.200Z',
    shippingAddress: jsonAddr,
    items: [],
  },
  { businessName: 'پوشاک ترنم', officeAddress: 'مشهد 09152424624', postalCode: '۹۱۸۷۱۵۴۳۲۱' },
);
assert(slipWithPostal.sender.postalCode === '9187154321', 'settings postal wins over address mobile');
assert(slip.lines[0]?.quantity === 2, 'line qty');
assert(slip.totalToman === 1160000, 'total toman');
assert(slip.itemCount === 2, 'unit count');

console.log('packing-slip.spec ok');
