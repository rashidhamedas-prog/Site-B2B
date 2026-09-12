import {
  firstAddressError,
  postalDigits,
  validateShippingAddress,
  type ShippingAddress,
} from './shipping-address';

export type CheckoutAppearance = 'retail' | 'wholesale';
export type CheckoutPaymentKind = 'ONLINE' | 'CASH' | 'INSTALLMENT';
export type CheckoutPaymentIcon = 'card' | 'wallet' | 'cash' | 'installment' | 'truck';
export type CheckoutBrandLogo = 'zarinpal' | 'digipay' | 'torobpay' | 'cash' | 'installment';

export type CheckoutChoiceOption = {
  id: string;
  title: string;
  description: string;
  icon: CheckoutPaymentIcon;
  logo?: CheckoutBrandLogo;
  badge?: string;
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
};

/** Shown above the payment radio list. Written for a first-time shopper. */
export const CHECKOUT_PAYMENT_INTRO =
  'اگر اسم این روش‌ها را نمی‌شناسی نگران نباش. هر کارت را بخوان و یکی را انتخاب کن. شک داشتی همان گزینهٔ «پیشنهادی» را بزن.';

export function formatTomanFromRial(rial: number): string {
  return Math.round(Number(rial) / 10).toLocaleString('fa-IR');
}

export function retailPaymentOptions(
  digipayAvailable: boolean,
  torobpayAvailable = false,
): CheckoutChoiceOption[] {
  return [
    {
      id: 'ZARINPAL',
      title: 'زرین‌پال',
      description:
        'پول لباس را همین الان با کارت بانکی می‌دهی. بعد از دکمه می‌روی صفحهٔ امن زرین‌پال، رمز کارت را می‌زنی، و خودبه‌خود برمی‌گردی به فروشگاه. کارت را به خود فروشگاه نمی‌دهی.',
      icon: 'card',
      logo: 'zarinpal',
      badge: 'پیشنهادی',
      hint: 'اگر نمی‌دانی کدام را بزنی، همین را انتخاب کن.',
    },
    ...(digipayAvailable
      ? [
          {
            id: 'DIGIPAY',
            title: 'دیجی‌پی',
            description:
              'اگر در دیجی‌کالا کیف‌پول یا اعتبار داری، از همان حساب پول را می‌دهی. وارد دیجی‌پی می‌شوی و تأیید می‌کنی؛ لازم نیست شماره کارت را از نو بنویسی.',
            icon: 'wallet' as const,
            logo: 'digipay' as const,
          },
        ]
      : []),
    ...(torobpayAvailable
      ? [
          {
            id: 'TOROBPAY',
            title: 'ترب‌پی',
            description:
              'همه پول را یکجا نمی‌دهی. ترب‌پی مبلغ را قسط‌قسط می‌گیرد؛ لباس را می‌گیری و کم‌کم پولش را می‌دهی. برای این روش کد پستی خانه‌ات باید ۱۰ رقم کامل باشد.',
            icon: 'installment' as const,
            logo: 'torobpay' as const,
            hint: 'کد پستی ۱۰ رقمی را در آدرس بالا بنویس.',
          },
        ]
      : []),
    {
      id: 'CASH',
      title: 'پرداخت وقتی لباس رسید',
      description:
        'الان هیچ پولی از کارت کم نمی‌شود. اول لباس به دستت می‌رسد؛ بعد همان موقع پول را به پیک یا فروشگاه می‌دهی. مثل خرید از مغازه، فقط لباس را پیک می‌آورد.',
      icon: 'cash',
      logo: 'cash',
    },
  ];
}

export function wholesalePaymentOptions(onlineEnabled: boolean): CheckoutChoiceOption[] {
  return [
    ...(onlineEnabled
      ? [
          {
            id: 'ONLINE',
            title: 'پرداخت آنلاین با زرین‌پال',
            description:
              'همین الان با کارت بانکی حساب را صاف می‌کنی. می‌روی صفحهٔ امن زرین‌پال، رمز را می‌زنی، و سفارش قطعی می‌شود.',
            icon: 'card' as const,
            logo: 'zarinpal' as const,
            badge: 'پیشنهادی',
            hint: 'اگر نمی‌دانی کدام را بزنی، همین را انتخاب کن.',
          },
        ]
      : []),
    {
      id: 'CASH',
      title: 'بعداً با فروشگاه حساب کن',
      description:
        'الان کارت نمی‌کشی. سفارش ثبت می‌شود و بعداً با تیم فروش هماهنگ می‌کنی چطور پول را بدهی — کارت‌به‌کارت، حواله یا نقد.',
      icon: 'cash',
      logo: 'cash',
    },
    {
      id: 'INSTALLMENT',
      title: 'اقساط خود فروشگاه ترنم',
      description:
        'اگر حساب عمده‌ات تأیید شده باشد، بخشی از پول را الان می‌گذاری و بقیه را ماه‌به‌ماه می‌دهی. این قسط ترب‌پی نیست؛ با خود ترنم است.',
      icon: 'installment',
      logo: 'installment',
    },
  ];
}

export function checkoutCtaLabel(opts: {
  kind: CheckoutPaymentKind;
  channel: CheckoutAppearance;
  busy?: boolean;
  payableRial?: number;
}): string {
  if (opts.busy) {
    return opts.kind === 'ONLINE' ? 'در حال رفتن به صفحهٔ پرداخت…' : 'در حال ثبت سفارش…';
  }

  const payable = Math.max(0, Number(opts.payableRial) || 0);
  if (opts.kind === 'ONLINE') {
    if (payable <= 0) return 'ثبت سفارش';
    return `پرداخت امن ${formatTomanFromRial(payable)} تومان`;
  }
  if (opts.kind === 'INSTALLMENT') return 'ثبت سفارش اقساطی';
  if (opts.channel === 'retail') {
    return payable <= 0 ? 'ثبت سفارش' : 'ثبت سفارش — پرداخت هنگام تحویل';
  }
  return 'ثبت نهایی سفارش نقدی';
}

export function checkoutCtaHint(kind: CheckoutPaymentKind): string {
  if (kind === 'ONLINE') return 'بعد از دکمه به صفحهٔ امن پرداخت می‌روی؛ وقتی تمام شد خودبه‌خود برمی‌گردی';
  if (kind === 'INSTALLMENT') return 'اقساط فقط وقتی حساب عمده‌ات تأیید شده باشد کار می‌کند';
  return 'الان پولی از کارت کم نمی‌شود';
}

export type RetailPaymentGateway = 'ZARINPAL' | 'DIGIPAY' | 'TOROBPAY';

export function retailPostalDigits(postalCode: string): string {
  return postalDigits(postalCode);
}

export function retailTorobpayNeedsPostal(
  paymentMethod: 'ONLINE' | 'CASH',
  paymentGateway: RetailPaymentGateway,
  postalCode: string,
): boolean {
  return (
    paymentMethod === 'ONLINE' &&
    paymentGateway === 'TOROBPAY' &&
    retailPostalDigits(postalCode).length !== 10
  );
}

export function retailTorobpayAddressError(
  paymentMethod: 'ONLINE' | 'CASH',
  paymentGateway: RetailPaymentGateway,
  address: Partial<ShippingAddress> & { postalCode?: string; street?: string; recipient?: string },
): string | null {
  if (paymentMethod !== 'ONLINE' || paymentGateway !== 'TOROBPAY') return null;
  return firstAddressError(
    validateShippingAddress(
      {
        recipient: address.recipient || '',
        mobile: address.mobile || '',
        province: address.province || '',
        city: address.city || '',
        street: address.street || '',
        postalCode: address.postalCode || '',
        alley: address.alley,
        plaque: address.plaque,
        unit: address.unit,
      },
      'torobpay',
    ),
  );
}

export function retailSelectedPaymentId(
  paymentMethod: 'ONLINE' | 'CASH',
  paymentGateway: RetailPaymentGateway,
): string {
  return paymentMethod === 'CASH' ? 'CASH' : paymentGateway;
}

export function parseRetailPaymentChoice(id: string): {
  method: 'ONLINE' | 'CASH';
  gateway?: RetailPaymentGateway;
} {
  if (id === 'CASH') return { method: 'CASH' };
  if (id === 'DIGIPAY') return { method: 'ONLINE', gateway: 'DIGIPAY' };
  if (id === 'TOROBPAY') return { method: 'ONLINE', gateway: 'TOROBPAY' };
  return { method: 'ONLINE', gateway: 'ZARINPAL' };
}
