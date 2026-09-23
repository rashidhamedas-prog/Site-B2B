import type { Metadata } from 'next';
import Link from 'next/link';
import { SalesPartnerTerms, SALES_PARTNER_TERMS_VERSION } from '@/components/sales-partners/SalesPartnerTerms';

export const metadata: Metadata = {
  title: `شرایط همکاری بازاریاب ${SALES_PARTNER_TERMS_VERSION}`,
  description: 'شرایط همکاری بازاریاب با پوشاک ترنم: معرفی محصول، پرداخت با ترنم، پورسانت پس از تحویل.',
};

export default function SalesPartnershipTermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-10 text-right" dir="rtl">
      <p className="text-sm text-stone-500">
        <Link href="/sales-partnership" className="underline-offset-4 hover:underline">
          بازگشت به ثبت‌نام
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-bold text-stone-900">شرایط همکاری بازاریاب</h1>
      <div className="mt-6">
        <SalesPartnerTerms />
      </div>
    </main>
  );
}
