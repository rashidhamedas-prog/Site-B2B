export type CheckoutAppearance = 'retail' | 'wholesale';
export type CheckoutPaymentKind = 'ONLINE' | 'CASH' | 'INSTALLMENT';
export type CheckoutPaymentIcon = 'card' | 'wallet' | 'cash' | 'installment' | 'truck';

export type CheckoutChoiceOption = {
  id: string;
  title: string;
  description: string;
  icon: CheckoutPaymentIcon;
  badge?: string;
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
};

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
      description: 'پرداخت آنی با کارت؛ بازگشت خودکار به فروشگاه',
      icon: 'card',
      badge: 'پیشنهادی',
      hint: 'درگاه اصلی فروشگاه',
    },
    ...(digipayAvailable
      ? [
          {
            id: 'DIGIPAY',
            title: 'دیجی‌پی',
            description: 'پرداخت آنلاین از طریق دیجی‌پی',
            icon: 'wallet' as const,
          },
        ]
      : []),
    ...(torobpayAvailable
      ? [
          {
            id: 'TOROBPAY',
            title: 'ترب‌پی (اقساطی)',
            description: 'پرداخت اقساطی ترب‌پی؛ بازگشت خودکار به فروشگاه',
            icon: 'installment' as const,
            hint: 'کدپستی ۱۰ رقمی برای این درگاه لازم است',
          },
        ]
      : []),
    {
      id: 'CASH',
      title: 'پرداخت هنگام تحویل',
      description: 'مبلغ را هنگام دریافت سفارش تسویه کنید',
      icon: 'cash',
    },
  ];
}

export function wholesalePaymentOptions(onlineEnabled: boolean): CheckoutChoiceOption[] {
  return [
    ...(onlineEnabled
      ? [
          {
            id: 'ONLINE',
            title: 'پرداخت آنلاین',
            description: 'تسویه آنی از درگاه امن زرین‌پال و بازگشت به پرتال',
            icon: 'card' as const,
            badge: 'پیشنهادی',
            hint: 'سریع‌ترین مسیر ثبت قطعی',
          },
        ]
      : []),
    {
      id: 'CASH',
      title: 'پرداخت نقدی',
      description: 'ثبت سفارش و هماهنگی تسویه با تیم فروش',
      icon: 'cash',
    },
    {
      id: 'INSTALLMENT',
      title: 'پرداخت اقساطی',
      description: 'پیش‌پرداخت و اقساط برای حساب‌های تأییدشده',
      icon: 'installment',
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
    return opts.kind === 'ONLINE' ? 'در حال اتصال به درگاه…' : 'در حال ثبت سفارش…';
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
  if (kind === 'ONLINE') return 'انتقال رمزگذاری‌شده به درگاه · بازگشت خودکار بعد از پرداخت';
  if (kind === 'INSTALLMENT') return 'اقساط فقط برای حساب تأییدشده و طبق سقف اعلام‌شده';
  return 'مبلغ هنگام تحویل یا هماهنگی فروش دریافت می‌شود';
}

export type RetailPaymentGateway = 'ZARINPAL' | 'DIGIPAY' | 'TOROBPAY';

export function retailPostalDigits(postalCode: string): string {
  return String(postalCode || '').replace(/\D/g, '');
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
  address: { postalCode?: string; street?: string; recipient?: string },
): string | null {
  if (paymentMethod !== 'ONLINE' || paymentGateway !== 'TOROBPAY') return null;
  if (retailPostalDigits(address.postalCode || '').length !== 10) {
    return 'برای پرداخت ترب‌پی کدپستی ۱۰ رقمی را وارد کنید.';
  }
  if (String(address.street || '').trim().replace(/\s/g, '').length < 8) {
    return 'برای ترب‌پی آدرس را کامل‌تر بنویسید: خیابان، پلاک و واحد (حداقل ۸ نویسه).';
  }
  if (String(address.recipient || '').trim().length < 3) {
    return 'برای ترب‌پی نام و نام خانوادگی گیرنده را کامل وارد کنید.';
  }
  return null;
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
