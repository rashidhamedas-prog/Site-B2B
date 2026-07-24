import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'کلکسیون‌ها',
  description: 'کلکسیون‌های فصلی و لینن فروشگاه ترنم — انتخاب سریع‌تر برای استایل روزمره.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/collections' },
};

export default function RetailCollectionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold">کلکسیون‌ها</h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--retail-muted)]">
        صفحات فصلی به‌تدریج کامل می‌شوند. فعلاً همه مدل‌های موجود را در فروشگاه ببینید.
      </p>
      <Link
        href="/products"
        className="mt-8 inline-flex cursor-pointer rounded-full bg-[var(--retail-primary)] px-6 py-3 text-sm font-bold text-white"
      >
        رفتن به فروشگاه
      </Link>
    </div>
  );
}
