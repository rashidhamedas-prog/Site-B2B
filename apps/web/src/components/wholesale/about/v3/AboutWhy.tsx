import {
  CUSTOMERS_FA,
  FOUNDED_FA,
  MIN_ORDER_FA,
  MODELS_FA,
  TEAM_FA,
  YEARS_FA,
} from './about-v3-facts';

const FACTS = [
  { label: 'سال آغاز در مشهد', value: FOUNDED_FA },
  { label: 'سابقه', value: YEARS_FA, small: true },
  { label: 'نفر در خط تولید', value: TEAM_FA },
  { label: 'حداقل سفارش هر مدل', value: `${MIN_ORDER_FA} عدد` },
  { label: 'مشتری فعال', value: CUSTOMERS_FA },
  { label: 'مدل در هر فصل', value: MODELS_FA },
] as const;

const VALUES = [
  {
    title: 'قیمت کارخانه، بدون واسطه',
    body: 'فروش مستقیم به بوتیک؛ فروشنده مدل را از مبدأ تولید می‌گیرد، نه از چند واسطه.',
  },
  {
    title: 'کیفیت بدون واسطه',
    body: 'انتخاب پارچه، برش، دوخت و کنترل کیفیت داخل کارگاه خودمان انجام می‌شود.',
  },
  {
    title: 'همراهی بلندمدت',
    body: 'ثبت‌نام عمده، انتخاب مدل، سفارش و پشتیبانی فروش در یک مسیر؛ پشتیبانی و ویزیت برای مشتریان دائمی.',
  },
  {
    title: 'تأمین منظم',
    body: 'دفتر پخش در مشهد سفارش را از کارگاه جدا می‌کند تا آماده‌سازی و ارسال قابل پیگیری باشد. هدف، رسیدن به‌موقع مدل به ویترین است.',
  },
  { title: 'ارسال به سراسر ایران', body: 'از دفتر پخش پاساژ کیمیا.' },
  {
    title: 'طراحی فروش‌پذیر',
    body: 'رنگ‌بندی و سایزبندی برای استفادهٔ روزمره و نشستن روی مانکن بوتیک.',
  },
] as const;

/** S5 */
export function AboutWhy() {
  return (
    <section className="av3-section av3-dark" aria-labelledby="about-s5">
      <div className="av3-wrap">
        <p className="av3-eyebrow">چرا بوتیک‌ها ترنم را انتخاب می‌کنند</p>
        <h2 id="about-s5">چرا بوتیک‌ها برای خرید عمده ترنم را انتخاب می‌کنند</h2>
        <p className="av3-body reveal">
          این‌ها شعار تبلیغاتی نیستند؛ همان کارهایی‌اند که از کارگاه تا دفتر پخش تکرار می‌شوند. فقط
          اعدادی را می‌نویسیم که در سابقهٔ برند ثبت شده‌اند: {FOUNDED_FA} در مشهد، {YEARS_FA} و {TEAM_FA}{' '}
          نفر در خط تولید.
        </p>
        <dl className="av3-facts">
          {FACTS.map((fact) => (
            <div key={fact.label} className="reveal">
              <dt>{fact.label}</dt>
              <dd className={'small' in fact ? 'av3-sm' : undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="av3-why-list">
          {VALUES.map((item) => (
            <li key={item.title} className="reveal">
              <b>{item.title}</b> — {item.body}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
