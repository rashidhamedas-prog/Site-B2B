import type { CheckoutBrandLogo } from '@/lib/checkout-payment-ui';

const SRC: Record<CheckoutBrandLogo, string> = {
  zarinpal: '/payments/zarinpal.svg',
  digipay: '/payments/digipay-mark.svg',
  torobpay: '/payments/torobpay.png',
  cash: '/payments/cash.svg',
  installment: '/payments/installment.svg',
};

export function PaymentBrandLogo({ logo }: { logo: CheckoutBrandLogo }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local brand marks; SVG optimizer adds no value here
    <img src={SRC[logo]} alt="" width={40} height={40} className="h-9 w-9 object-contain" />
  );
}
