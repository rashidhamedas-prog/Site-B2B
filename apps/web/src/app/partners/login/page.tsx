import type { Metadata } from 'next';
import { PartnerLoginForm } from '@/components/partners/PartnerLoginForm';

export const metadata: Metadata = {
  title: 'ورود همکار | ترنم',
  robots: { index: false, follow: false },
};

export default function PartnerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <img src="/logo-128.png" alt="لوگوی پوشاک ترنم" width={64} height={64} className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">ورود همکاران ترنم</h1>
          <p className="mt-2 text-sm text-gray-600">
            اینجا سفارش‌هایی را می‌بینید که مشتری از سایت ترنم خریده و ارسال‌شان با شماست.
            ثبت‌نام عمومی نیست؛ اگر دعوت نشده‌اید با ترنم تماس بگیرید.
          </p>
        </div>
        <PartnerLoginForm />
      </div>
    </div>
  );
}
