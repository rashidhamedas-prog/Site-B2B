import { FaqJsonLd } from '@/components/shared/JsonLd';

const FAQS = [
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

export function WholesaleFaq() {
  return (
    <section className="border-t border-[color:var(--color-border)] bg-white py-16 lg:py-20">
      <FaqJsonLd items={FAQS} />
      <div className="container-site max-w-3xl">
        <h2 className="text-center text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          سوالاتی که معمولاً می‌پرسند
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-500">
          جواب کوتاه، بدون حاشیه — اگر چیزی جا ماند با ما تماس بگیرید.
        </p>
        <dl className="mt-10 space-y-6">
          {FAQS.map((item) => (
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
