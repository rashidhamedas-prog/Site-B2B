import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'صفحه یافت نشد | پوشاک ترنم' };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-primary-100 mb-4">۴۰۴</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">صفحه یافت نشد</h1>
        <p className="text-gray-500 mb-8">
          صفحه‌ای که دنبالش می‌گردید وجود ندارد یا جابه‌جا شده است.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="inline-flex items-center justify-center h-11 px-8 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-colors">
            بازگشت به خانه
          </Link>
          <Link href="/products"
            className="inline-flex items-center justify-center h-11 px-8 rounded-xl border border-gray-200 text-gray-700 font-medium hover:border-primary hover:text-primary transition-colors">
            مشاهده محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}
