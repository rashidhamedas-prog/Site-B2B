import Link from 'next/link';
import type { Metadata } from 'next';
import { getSeoChannel } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'صفحه یافت نشد | پوشاک ترنم',
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const channel = await getSeoChannel();
  const retail = channel === 'RETAIL';

  return (
    <div
      className={
        retail
          ? 'flex min-h-screen items-center justify-center bg-[var(--retail-bg,#F6F1E8)] px-4 py-16'
          : 'flex min-h-screen items-center justify-center bg-[#F6F1E8] px-4 py-16'
      }
    >
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#C9A84C]">۴۰۴</p>
        <h1 className="mt-4 text-3xl font-extrabold text-[#0F2F28]">
          {retail ? 'این صفحه پیدا نشد' : 'این صفحه در کاتالوگ پیدا نشد'}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#6B7280]">
          {retail
            ? 'آدرس عوض شده یا دیگر در فروشگاه وجود ندارد. از مسیرهای زیر ادامه دهید.'
            : 'این آدرس در کاتالوگ عمده موجود نیست. از کاتالوگ، لینن یا تماس ادامه دهید.'}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {retail ? (
            <>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#1B5C4A] px-6 text-sm font-bold text-white"
              >
                فروشگاه
              </Link>
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#E8E0D4] px-6 text-sm font-bold text-[#0F2F28]"
              >
                محصولات
              </Link>
              <Link
                href="/collections"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#E8E0D4] px-6 text-sm font-bold text-[#0F2F28]"
              >
                دسته‌بندی‌ها
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#1B5C4A] px-6 text-sm font-bold text-white"
              >
                کاتالوگ
              </Link>
              <Link
                href="/linen-collection"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#E8E0D4] px-6 text-sm font-bold text-[#0F2F28]"
              >
                لینن
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#E8E0D4] px-6 text-sm font-bold text-[#0F2F28]"
              >
                تماس
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
