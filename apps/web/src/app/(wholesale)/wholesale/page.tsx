import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, Package, Truck, CreditCard, AlertCircle, TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'شرایط همکاری عمده',
  description:
    'حداقل سفارش، نحوه ثبت‌نام بوتیک، پرداخت و ارسال — قوانین همکاری عمده با تولیدی ترنم مشهد.',
  alternates: { canonical: 'https://poshaktaranom.com/wholesale' },
  openGraph: {
    title: 'شرایط عمده‌فروشی پوشاک ترنم',
    description: 'همکاری مستقیم با تولیدی مانتو زنانه در مشهد.',
    url: 'https://poshaktaranom.com/wholesale',
  },
};

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <p className="mb-3 text-sm font-semibold tracking-[0.15em] text-secondary">همکاری تجاری</p>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight">شرایط عمده‌فروشی</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/70">
            راهنمای کامل همکاری با تولیدی ترنم برای بوتیک‌ها و فروشندگان عمده
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/portal/register"
              className="inline-flex h-12 cursor-pointer items-center justify-center rounded-lg bg-secondary px-8 font-bold text-white transition-colors duration-200 hover:bg-secondary-dark"
            >
              درخواست عضویت
            </Link>
            <Link
              href="/portal/login"
              className="inline-flex h-12 cursor-pointer items-center justify-center rounded-lg border border-white/25 bg-white/10 px-8 font-bold text-white transition-colors duration-200 hover:bg-white/20"
            >
              ورود به پنل
            </Link>
          </div>
        </div>
      </section>

      <div className="container-site space-y-20 py-16 lg:py-20">
        <div>
          <h2 className="mb-3 text-center text-2xl font-bold tracking-tight text-gray-900">
            سطح‌بندی مشتریان
          </h2>
          <p className="mb-10 text-center text-gray-500">قیمت نهایی بر اساس سطح مشتری تعیین می‌شود</p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                level: 'A',
                name: 'عمده بزرگ',
                desc: 'بالای ۱۵۰ پیراهن در ماه',
                color: 'bg-secondary',
                perks: ['بالاترین تخفیف', 'اعتبار خرید بیشتر', 'اولویت رنگ‌بندی', 'ارسال رایگان'],
              },
              {
                level: 'B',
                name: 'عمده متوسط',
                desc: '۵۰ تا ۱۵۰ پیراهن در ماه',
                color: 'bg-primary',
                perks: ['تخفیف متوسط', 'اعتبار خرید', 'ارسال نیمه‌رایگان', 'دسترسی به کاتالوگ'],
              },
              {
                level: 'C',
                name: 'عمده پایه',
                desc: 'زیر ۵۰ پیراهن در ماه',
                color: 'bg-gray-500',
                perks: ['قیمت پایه عمده', 'سفارش نقدی', 'ارسال با هزینه', 'دسترسی به کاتالوگ'],
              },
            ].map((seg) => (
              <div
                key={seg.level}
                className="overflow-hidden border border-[color:var(--color-border)] bg-white"
              >
                <div className={`${seg.color} p-5 text-center text-white`}>
                  <span className="inline-block h-12 w-12 rounded-full bg-white/20 text-3xl font-black leading-[3rem]">
                    {seg.level}
                  </span>
                  <h3 className="mt-2 text-lg font-bold">{seg.name}</h3>
                  <p className="text-sm text-white/70">{seg.desc}</p>
                </div>
                <div className="space-y-2.5 p-5">
                  {seg.perks.map((p) => (
                    <div key={p} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: Package,
              title: 'حداقل سفارش',
              items: [
                <>حداقل سفارش اولیه: <strong>۱۲ عدد</strong> از یک مدل</>,
                <>ترکیب سایزبندی: <strong>۲ عدد</strong> از هر سایز (38 تا 46)</>,
                <>حداقل رنگ: <strong>۳ رنگ</strong> از هر مدل</>,
                <>سفارش زیر حداقل: <strong>امکان‌پذیر نیست</strong></>,
              ],
            },
            {
              icon: CreditCard,
              title: 'شرایط پرداخت',
              items: [
                <><strong>نقد:</strong> در زمان تحویل</>,
                <><strong>چک:</strong> یک ماهه (فقط مشتریان تأییدشده)</>,
                <><strong>نسیه:</strong> تا سقف اعتبار تعریف‌شده</>,
                <><strong>انتقال بانکی:</strong> حساب‌ها در پنل مشتری</>,
              ],
            },
            {
              icon: Truck,
              title: 'ارسال و تحویل',
              items: [
                <><strong>پیک شهری (مشهد):</strong> رایگان برای سطح A و B</>,
                <><strong>باربری:</strong> چاپار، تیپاکس، پست</>,
                <><strong>زمان آماده‌سازی:</strong> ۱ تا ۳ روز کاری</>,
                <><strong>سفارش بالای ۵ میلیون تومان:</strong> ارسال رایگان</>,
              ],
            },
            {
              icon: TrendingUp,
              title: 'مزایای همکاری',
              items: [
                <>دسترسی به <strong>کاتالوگ کامل</strong> قبل از عرضه عمومی</>,
                <>اطلاع‌رسانی <strong>مدل‌های جدید</strong> فصلی</>,
                <>امکان <strong>سفارش اختصاصی</strong> رنگ و مدل</>,
                <>پشتیبانی <strong>مستقیم</strong> از طریق تلگرام</>,
              ],
            },
          ].map((block) => (
            <div
              key={block.title}
              className="space-y-4 border border-[color:var(--color-border)] bg-white p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                  <block.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                {block.items.map((item, i) => (
                  <p key={i}>{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-secondary/30 bg-secondary-50 p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-secondary-dark" />
            <div>
              <h3 className="mb-3 font-bold text-gray-900">مرجوعی و ضمانت</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  • مرجوعی فقط در صورت <strong>عیب تولیدی</strong> پذیرفته می‌شود
                </p>
                <p>
                  • مدت اعلام عیب: حداکثر <strong>۷ روز</strong> پس از دریافت
                </p>
                <p>
                  • مرجوعی به دلیل <strong>رنگ یا مدل</strong> امکان‌پذیر نیست
                </p>
                <p>
                  • هزینه ارسال مرجوعی بر عهده <strong>مشتری</strong> است (مگر در عیب تولیدی)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="py-4 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-gray-900">آماده همکاری هستید؟</h2>
          <p className="mx-auto mb-8 max-w-md text-gray-500">
            فرم درخواست عضویت را پر کنید. تیم ما ظرف ۲۴ ساعت با شما تماس می‌گیرد.
          </p>
          <Link
            href="/portal/register"
            className="inline-flex h-12 cursor-pointer items-center justify-center rounded-lg bg-primary px-10 font-bold text-white transition-colors duration-200 hover:bg-primary-dark"
          >
            ثبت درخواست عضویت
          </Link>
        </div>
      </div>
    </div>
  );
}
