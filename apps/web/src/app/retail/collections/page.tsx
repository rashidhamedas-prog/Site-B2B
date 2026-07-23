import Link from 'next/link';

export default function RetailCollectionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold">کلکسیون‌ها</h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--retail-muted)]">
        صفحات فصلی و کلکسیون لینن به‌زودی با فیلتر پارچه و فصل کامل می‌شود.
      </p>
      <Link
        href="/retail/products"
        className="mt-8 inline-flex cursor-pointer rounded-full bg-[var(--retail-primary)] px-6 py-3 text-sm font-bold text-white"
      >
        رفتن به فروشگاه
      </Link>
    </div>
  );
}
