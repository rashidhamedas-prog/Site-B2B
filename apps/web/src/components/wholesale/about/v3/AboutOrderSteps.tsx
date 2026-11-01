import { toPersianDigits } from '@taranom/persian-utils';
import { MIN_ORDER_FA } from './about-v3-facts';

const STEPS = [
  {
    title: 'ثبت‌نام عمده',
    body: 'حساب عمده بسازید؛ پس از تأیید تیم فروش، قیمت‌های عمده برایتان باز می‌شود.',
  },
  {
    title: 'انتخاب مدل',
    body: 'کاتالوگ عمده را ببینید و مدل‌های فصل را با رنگ و سایز مناسب ویترین انتخاب کنید.',
  },
  {
    title: 'ثبت سفارش',
    body: `سفارش را ثبت کنید؛ حداقل سفارش در هر محصول از ${MIN_ORDER_FA} عدد به بالاست.`,
  },
  {
    title: 'آماده‌سازی و ارسال',
    body: 'سفارش در کارگاه و دفتر پخش آماده می‌شود، کنترل نهایی پیش از خروج از مشهد انجام می‌گیرد و ارسال به سراسر ایران از دفتر پخش پاساژ کیمیا پیگیری می‌شود.',
  },
] as const;

/** S6 */
export function AboutOrderSteps() {
  return (
    <section className="av3-section av3-wrap" aria-labelledby="about-s6">
      <p className="av3-eyebrow">مسیر همکاری</p>
      <h2 id="about-s6">مسیر سفارش عمده در چهار قدم</h2>
      <p className="av3-body reveal">
        مسیر عمده را کوتاه و قابل فهم نگه داشته‌ایم تا فروشنده بداند بعد از هر قدم چه می‌شود. اگر
        می‌خواهید همکاری با تولیدی لباس را شروع کنید، حداقل سفارش هر مدل {MIN_ORDER_FA} عدد است.
      </p>
      <div className="av3-order-wrap">
        <span className="av3-order-line" aria-hidden="true" />
        <ol className="av3-order">
          {STEPS.map((step, index) => (
            <li key={step.title} className="reveal">
              <span className="av3-num" aria-hidden="true">
                {toPersianDigits(index + 1).padStart(2, '۰')}
              </span>
              <h3>{step.title}</h3>
              <p className="av3-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
