import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'این صفحه در کاتالوگ پیدا نشد',
  robots: { index: false, follow: false },
};

export default function WholesaleNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F6F1E8] px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#C9A84C]">۴۰۴</p>
        <h1 className="mt-4 text-3xl font-extrabold text-[#0F2F28]">
          این صفحه در کاتالوگ پیدا نشد
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#6B7280]">
          این آدرس در کاتالوگ عمده موجود نیست. از کاتالوگ، لینن یا تماس ادامه دهید.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
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
        </div>
      </div>
    </div>
  );
}
