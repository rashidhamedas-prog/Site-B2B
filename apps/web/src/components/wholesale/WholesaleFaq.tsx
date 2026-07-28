import { FaqJsonLd } from '@/components/shared/JsonLd';

export interface FaqItem {
  question: string;
  answer: string;
}

export function WholesaleFaq({
  headline = 'سوالاتی که معمولاً می‌پرسند',
  body = 'جواب کوتاه، بدون حاشیه — اگر چیزی جا ماند با ما تماس بگیرید.',
  items,
}: {
  headline?: string;
  body?: string;
  items?: FaqItem[];
}) {
  const faqs =
    items?.length
      ? items
      : [
          {
            question: 'حداقل سفارش عمده چقدر است؟',
            answer:
              'برای بیشتر مدل‌ها حداقل سفارش حدود ۵ عدد است. عدد دقیق هر محصول روی صفحه همان مدل نوشته شده.',
          },
          {
            question: 'ارسال عمده به شهرستان دارید؟',
            answer:
              'بله. سفارش‌ها از دفتر پخش مشهد بسته‌بندی می‌شوند و به سراسر ایران ارسال می‌گردند.',
          },
          {
            question: 'چطور عمده‌فروش شوم؟',
            answer:
              'از صفحه شرایط عمده یا ثبت‌نام پنل مشتری درخواست بدهید. بعد از تأیید، قیمت عمده و ثبت سفارش برایتان باز می‌شود.',
          },
          {
            question: 'خرید تکی هم دارید؟',
            answer:
              'بله — فروشگاه تکی روی دامنه poshaktaranom.ir است. این سایت (.com) مخصوص همکاری عمده با بوتیک‌هاست.',
          },
        ];

  return (
    <section className="border-t border-[color:var(--color-border)] bg-white py-16 lg:py-20">
      <FaqJsonLd items={faqs} />
      <div className="container-site max-w-3xl">
        {headline ? (
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {headline}
          </h2>
        ) : null}
        {body ? (
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-500">{body}</p>
        ) : null}
        <dl className="mt-10 space-y-6">
          {faqs.map((item) => (
            <div key={item.question} className="border-b border-gray-100 pb-6">
              <dt className="text-base font-bold text-gray-900">{item.question}</dt>
              <dd className="mt-2 text-sm leading-7 text-gray-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
