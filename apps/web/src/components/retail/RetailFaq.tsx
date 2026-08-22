import { FaqJsonLd } from '@/components/shared/JsonLd';

export function RetailFaq({
  headline = 'سوالات پرتکرار',
  body = 'قبل از خرید، این چند مورد را یک‌بار بخوانید.',
  items,
}: {
  headline?: string;
  body?: string;
  items?: Array<{ question: string; answer: string }>;
}) {
  const faqs =
    items?.length
      ? items
      : [
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

  return (
    <section className="mx-auto max-w-[800px] px-4 py-16 sm:px-6">
      <FaqJsonLd items={faqs} />
      {headline ? (
        <h2 className="text-center text-2xl font-extrabold text-[var(--retail-ink)]">{headline}</h2>
      ) : null}
      {body ? (
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-[var(--retail-muted)]">{body}</p>
      ) : null}
      <div className="mt-10 space-y-0 border-t border-[var(--retail-border)]">
        {faqs.map((item, index) => (
          <details
            key={item.question}
            className="border-b border-[var(--retail-border)]"
            open={index === 0}
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-right text-base font-bold text-[var(--retail-ink)] [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                className="faq-plus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--retail-border)] text-lg leading-none text-[var(--retail-gold)] transition duration-200"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="pb-5 text-sm leading-7 text-[var(--retail-muted)]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
