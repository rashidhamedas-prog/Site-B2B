import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'مرجوعی و تعویض سایز',
  description:
    'اگر سایز جور نبود، از حساب کاربری درخواست تعویض یا مرجوعی ثبت کنید. شرایط شفاف، بدون حرف اضافه.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/returns' },
};

export default function RetailReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
