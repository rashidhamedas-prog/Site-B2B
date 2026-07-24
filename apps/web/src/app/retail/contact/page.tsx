import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تماس با فروشگاه',
  description:
    'سوالی درباره سفارش تکی دارید؟ با ترنم در تماس باشید: ۰۹۱۵۲۴۲۴۶۲۴ — مشهد، پاساژ کیمیا.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/contact' },
};

export default function RetailContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold">تماس با ما</h1>
      <p className="mt-5 text-sm leading-8 text-[var(--retail-muted)]">
        برای پیگیری سفارش تکی یا سوال درباره سایز و ارسال، با ما حرف بزنید.
      </p>
      <ul className="mt-6 space-y-3 text-sm leading-8 text-[var(--retail-muted)]">
        <li>
          تلفن:{' '}
          <a href="tel:09152424624" className="font-semibold text-[var(--retail-primary)]">
            ۰۹۱۵۲۴۲۴۶۲۴
          </a>
        </li>
        <li>آدرس دفتر: مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳</li>
        <li>
          اینستاگرام:{' '}
          <a
            href="https://www.instagram.com/tolidi.taranom"
            className="text-[var(--retail-primary)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            @tolidi.taranom
          </a>
        </li>
      </ul>
    </div>
  );
}
