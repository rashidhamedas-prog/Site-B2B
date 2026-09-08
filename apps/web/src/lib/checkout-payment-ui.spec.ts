import assert from 'node:assert/strict';
import {
  checkoutCtaHint,
  checkoutCtaLabel,
  formatTomanFromRial,
  parseRetailPaymentChoice,
  retailPaymentOptions,
  retailSelectedPaymentId,
  retailTorobpayAddressError,
  retailTorobpayNeedsPostal,
  wholesalePaymentOptions,
} from './checkout-payment-ui';

const retailDefault = retailPaymentOptions(false);
assert.equal(retailDefault.length, 2);
assert.equal(retailDefault[0]?.id, 'ZARINPAL');
assert.equal(retailDefault[0]?.badge, 'پیشنهادی');
assert.equal(retailDefault.some((o) => o.id === 'DIGIPAY'), false);

const retailWithDigipay = retailPaymentOptions(true);
assert.equal(retailWithDigipay.length, 3);
assert.equal(retailWithDigipay[1]?.id, 'DIGIPAY');
assert.equal(retailWithDigipay[2]?.id, 'CASH');
assert.equal(retailWithDigipay.some((o) => o.id === 'TOROBPAY'), false);

const retailWithTorob = retailPaymentOptions(false, true);
assert.equal(retailWithTorob.some((o) => o.id === 'TOROBPAY'), true);
assert.equal(retailWithTorob.find((o) => o.id === 'TOROBPAY')?.title, 'ترب‌پی (اقساطی)');
assert.equal(retailTorobpayNeedsPostal('ONLINE', 'TOROBPAY', '91735'), true);
assert.equal(retailTorobpayNeedsPostal('ONLINE', 'TOROBPAY', '9173512345'), false);
assert.equal(retailTorobpayNeedsPostal('ONLINE', 'ZARINPAL', ''), false);
assert.equal(
  retailTorobpayAddressError('ONLINE', 'TOROBPAY', {
    postalCode: '9173512345',
    street: 'آز',
    recipient: 'علی رضایی',
  }),
  'برای ترب‌پی آدرس را کامل‌تر بنویسید: خیابان، پلاک و واحد (حداقل ۸ نویسه).',
);
assert.equal(
  retailTorobpayAddressError('ONLINE', 'TOROBPAY', {
    postalCode: '9173512345',
    street: 'خیابان احمدآباد پلاک ۱۲',
    recipient: 'علی رضایی',
  }),
  null,
);

const wholesaleOffline = wholesalePaymentOptions(false);
assert.equal(wholesaleOffline.some((o) => o.id === 'ONLINE'), false);
assert.equal(wholesaleOffline.map((o) => o.id).join(','), 'CASH,INSTALLMENT');

const wholesaleOnline = wholesalePaymentOptions(true);
assert.equal(wholesaleOnline[0]?.id, 'ONLINE');
assert.equal(wholesaleOnline[0]?.badge, 'پیشنهادی');

assert.equal(retailSelectedPaymentId('CASH', 'ZARINPAL'), 'CASH');
assert.equal(retailSelectedPaymentId('ONLINE', 'DIGIPAY'), 'DIGIPAY');
assert.deepEqual(parseRetailPaymentChoice('CASH'), { method: 'CASH' });
assert.deepEqual(parseRetailPaymentChoice('DIGIPAY'), { method: 'ONLINE', gateway: 'DIGIPAY' });
assert.deepEqual(parseRetailPaymentChoice('ZARINPAL'), { method: 'ONLINE', gateway: 'ZARINPAL' });
assert.deepEqual(parseRetailPaymentChoice('TOROBPAY'), { method: 'ONLINE', gateway: 'TOROBPAY' });
assert.equal(retailSelectedPaymentId('ONLINE', 'TOROBPAY'), 'TOROBPAY');

assert.equal(
  checkoutCtaLabel({ kind: 'ONLINE', channel: 'retail', payableRial: 1_250_000 }),
  `پرداخت امن ${formatTomanFromRial(1_250_000)} تومان`,
);
assert.match(formatTomanFromRial(1_250_000), /۱۲۵/);
assert.equal(checkoutCtaLabel({ kind: 'ONLINE', channel: 'retail', payableRial: 0 }), 'ثبت سفارش');
assert.equal(
  checkoutCtaLabel({ kind: 'CASH', channel: 'retail', payableRial: 1_000 }),
  'ثبت سفارش — پرداخت هنگام تحویل',
);
assert.equal(checkoutCtaLabel({ kind: 'CASH', channel: 'wholesale' }), 'ثبت نهایی سفارش نقدی');
assert.equal(checkoutCtaLabel({ kind: 'INSTALLMENT', channel: 'wholesale' }), 'ثبت سفارش اقساطی');
assert.equal(
  checkoutCtaLabel({ kind: 'ONLINE', channel: 'wholesale', busy: true }),
  'در حال اتصال به درگاه…',
);
assert.equal(
  checkoutCtaLabel({ kind: 'CASH', channel: 'retail', busy: true }),
  'در حال ثبت سفارش…',
);
assert.match(checkoutCtaHint('ONLINE'), /درگاه/);
assert.match(checkoutCtaHint('CASH'), /تحویل/);

console.log('checkout-payment-ui spec ok');
