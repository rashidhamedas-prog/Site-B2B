import type { Metadata } from 'next';
import Link from 'next/link';
import { SalesPartnerTerms, SALES_PARTNER_TERMS_VERSION } from '@/components/sales-partners/SalesPartnerTerms';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `شرایط همکاری بازاریاب ${SALES_PARTNER_TERMS_VERSION}`,
  description:
    'شرایط همکاری بازاریاب با پوشاک ترنم: معرفی محصول، پرداخت با ترنم، پورسانت پس از تحویل و پایان مهلت مرجوعی.',
  alternates: { canonical: `${RETAIL_ORIGIN}/sales-partnership/terms` },
};

export default function RetailSalesPartnershipTermsPage() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 py-10 text-right" dir="rtl">
      <p className="text-sm text-[var(--retail-muted,#5C6B66)]">
        <Link href="/sales-partnership" className="underline-offset-4 hover:underline">
          بازگشت به صفحه همکار بازاریاب
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-extrabold text-[var(--retail-ink,#0F2F28)]">
        شرایط همکاری بازاریاب
      </h1>
      <div className="mt-6 text-[var(--retail-ink,#0F2F28)]">
        <SalesPartnerTerms />
      </div>
    </main>
  );
}
