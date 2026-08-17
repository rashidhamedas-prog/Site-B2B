import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'این صفحه پیدا نشد',
  robots: { index: false, follow: false },
};

export default function RetailNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[var(--retail-bg,#F6F1E8)] px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--retail-gold,#C9A84C)]">۴۰۴</p>
        <h1 className="mt-4 text-3xl font-extrabold text-[var(--retail-primary-dark,#0F2F28)]">
          این صفحه پیدا نشد
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--retail-muted,#6B7280)]">
          آدرس عوض شده یا دیگر در فروشگاه وجود ندارد. از مسیرهای زیر ادامه دهید.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--retail-primary,#1B5C4A)] px-6 text-sm font-bold text-white"
          >
            فروشگاه
          </Link>
          <Link
            href="/products"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--retail-border,#E8E0D4)] px-6 text-sm font-bold text-[var(--retail-primary-dark,#0F2F28)]"
          >
            محصولات
          </Link>
          <Link
            href="/collections"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--retail-border,#E8E0D4)] px-6 text-sm font-bold text-[var(--retail-primary-dark,#0F2F28)]"
          >
            دسته‌بندی‌ها
          </Link>
        </div>
      </div>
    </div>
  );
}
