import { FaqJsonLd } from '@/components/shared/JsonLd';

const FAQS = [
  {
    question: 'سفارش تکی چقدر طول می‌کشد تا برسد؟',
    answer:
      'معمولاً بعد از ثبت سفارش، بسته‌بندی از مشهد انجام می‌شود و بسته به شهر و روش ارسال (پیشتاز، تیپاکس و…) چند روز کاری زمان می‌برد.',
  },
  {
    question: 'اگر سایز مناسب نبود چه کار کنم؟',
    answer:
      'از حساب کاربری درخواست تعویض سایز یا مرجوعی ثبت کنید. شرایط دقیق در صفحه مرجوعی آمده است.',
  },
  {
    question: 'پرداخت چطور انجام می‌شود؟',
    answer:
      'پرداخت آنلاین از طریق زرین‌پال در دسترس است. پرداخت در محل هم با شرایط مشخص برای برخی سفارش‌ها ممکن است.',
  },
  {
    question: 'این همان تولیدی عمده است؟',
    answer:
      'بله. همان کارگاه ترنم در مشهد؛ اینجا خرید تکی است و سایت poshaktaranom.com برای سفارش عمده بوتیک‌هاست.',
  },
];

export function RetailFaq() {
  return (
    <section className="mx-auto max-w-[800px] px-4 py-16 sm:px-6">
      <FaqJsonLd items={FAQS} />
      <h2 className="text-center text-2xl font-extrabold text-[var(--retail-ink)]">سوالات پرتکرار</h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-[var(--retail-muted)]">
        قبل از خرید، این چند مورد را یک‌بار بخوانید.
      </p>
      <dl className="mt-10 space-y-6">
        {FAQS.map((item) => (
          <div key={item.question} className="border-b border-[var(--retail-border)] pb-6">
            <dt className="text-base font-bold text-[var(--retail-ink)]">{item.question}</dt>
            <dd className="mt-2 text-sm leading-7 text-[var(--retail-muted)]">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
