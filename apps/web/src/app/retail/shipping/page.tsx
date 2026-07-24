import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ارسال سفارش',
  description:
    'گزینه‌های ارسال فروشگاه ترنم: پست پیشتاز، تیپاکس، چاپار و پیک تهران — زمان تقریبی و پوشش شهرها.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/shipping' },
};

export default function RetailShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold">ارسال سفارش</h1>
      <p className="mt-4 text-sm leading-8 text-[var(--retail-muted)]">
        بعد از ثبت سفارش، بسته‌تان از مشهد راه می‌افتد. بسته به شهر مقصد یکی از این روش‌ها را انتخاب
        می‌کنید:
      </p>
      <ul className="mt-6 list-disc space-y-2 pr-5 text-sm leading-8 text-[var(--retail-muted)]">
        <li>پست پیشتاز</li>
        <li>تیپاکس</li>
        <li>چاپار</li>
        <li>پیک موتوری تهران</li>
      </ul>
    </div>
  );
}
