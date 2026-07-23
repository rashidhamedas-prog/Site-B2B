import type { Metadata } from 'next';
import { RetailHero } from '@/components/retail/RetailHero';
import { RetailProductGrid } from '@/components/retail/RetailProductGrid';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'فروشگاه آنلاین مانتو زنانه',
  description: 'استایل شما، امضای ترنم — خرید تکی مانتو و شومیز از تولیدی پوشاک ترنم.',
  alternates: { canonical: 'https://www.poshaktaranom.ir' },
};

export default function RetailHomePage() {
  return (
    <>
      <RetailHero />
      <RetailProductGrid title="جدیدترین‌ها" limit={4} />
      <section className="border-y border-[var(--retail-border)] bg-[var(--retail-surface)]">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            { t: 'ارسال سریع', d: 'پست پیشتاز، تیپاکس و ارسال تهران' },
            { t: 'تعویض سایز', d: 'درخواست مرجوعی و تعویض از حساب کاربری' },
            { t: 'پرداخت امن', d: 'زرین‌پال و پرداخت در محل (با شرایط)' },
          ].map((item) => (
            <div key={item.t} className="text-center md:text-right">
              <h2 className="text-lg font-extrabold text-[var(--retail-primary)]">{item.t}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--retail-muted)]">{item.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-[var(--retail-bg)] px-4 py-16 text-center">
        <h2 className="text-2xl font-extrabold text-[var(--retail-ink)]">عمده‌فروش هستید؟</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--retail-muted)]">
          برای خرید عمده با حداقل سفارش و قیمت ویژه به سایت عمده سر بزنید.
        </p>
        <Link
          href="https://poshaktaranom.com"
          className="mt-6 inline-flex cursor-pointer rounded-md border border-[var(--retail-primary)] px-6 py-3 text-sm font-bold text-[var(--retail-primary)]"
        >
          ورود به سایت عمده
        </Link>
      </section>
    </>
  );
}
