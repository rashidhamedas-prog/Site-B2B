import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'درباره فروشگاه ترنم',
  description:
    'ترنم در مشهد مانتو می‌دوزد؛ این فروشگاه همان کیفیت کارگاه را برای خرید تکی شما می‌آورد.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/about' },
};

export default function RetailAboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold">درباره پوشاک ترنم</h1>
      <p className="mt-5 leading-8 text-[var(--retail-muted)]">
        تولیدی پوشاک ترنم در مشهد؛ مانتوهای لینن و کتان را هم عمده و هم تکی عرضه می‌کند. این فروشگاه،
        کانال خرید مستقیم برای شماست — با همان کیفیت کارخانه.
      </p>
      <p className="mt-4 leading-8 text-[var(--retail-muted)]">
        دفتر پخش: مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳. تماس:{' '}
        <a href="tel:09152424624" className="font-semibold text-[var(--retail-primary)]">
          ۰۹۱۵۲۴۲۴۶۲۴
        </a>
      </p>
    </div>
  );
}
