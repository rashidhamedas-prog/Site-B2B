import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle, Package, Truck, CreditCard, AlertCircle, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'شرایط عمده‌فروشی | پوشاک ترنم' };

export default function WholesalePage() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light text-white py-20">
        <div className="container-site text-center">
          <h1 className="text-4xl font-extrabold mb-4">شرایط عمده‌فروشی</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            راهنمای کامل همکاری با تولیدی ترنم برای بوتیک‌ها و فروشندگان عمده
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/portal/register"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-secondary hover:bg-secondary-dark text-white font-bold transition-colors">
              درخواست عضویت
            </Link>
            <Link href="/portal/login"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 transition-colors">
              ورود به پنل
            </Link>
          </div>
        </div>
      </section>

      <div className="container-site py-16 space-y-16">
        {/* Segments */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">سطح‌بندی مشتریان</h2>
          <p className="text-center text-gray-500 mb-8">قیمت نهایی بر اساس سطح مشتری تعیین می‌شود</p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { level: 'A', name: 'عمده بزرگ', desc: 'بالای ۱۵۰ پیراهن در ماه', color: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', perks: ['بالاترین تخفیف', 'اعتبار خرید بیشتر', 'اولویت رنگ‌بندی', 'ارسال رایگان'] },
              { level: 'B', name: 'عمده متوسط', desc: '۵۰ تا ۱۵۰ پیراهن در ماه', color: 'bg-primary', badge: 'bg-primary-50 text-primary border-primary-100', perks: ['تخفیف متوسط', 'اعتبار خرید', 'ارسال نیمه‌رایگان', 'دسترسی به کاتالوگ'] },
              { level: 'C', name: 'عمده پایه', desc: 'زیر ۵۰ پیراهن در ماه', color: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200', perks: ['قیمت پایه عمده', 'سفارش نقدی', 'ارسال با هزینه', 'دسترسی به کاتالوگ'] },
            ].map((seg) => (
              <div key={seg.level} className="card overflow-hidden">
                <div className={`${seg.color} p-4 text-white text-center`}>
                  <span className="inline-block h-12 w-12 rounded-full bg-white/20 text-3xl font-black leading-[3rem]">{seg.level}</span>
                  <h3 className="mt-2 font-bold text-lg">{seg.name}</h3>
                  <p className="text-white/70 text-sm">{seg.desc}</p>
                </div>
                <div className="p-4 space-y-2">
                  {seg.perks.map((p) => (
                    <div key={p} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="grid gap-8 md:grid-cols-2">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">حداقل سفارش</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>حداقل سفارش اولیه: <strong>۱۲ عدد</strong> از یک مدل</p>
              <p>ترکیب سایزبندی: <strong>۲ عدد</strong> از هر سایز (38 تا 46)</p>
              <p>حداقل رنگ: <strong>۳ رنگ</strong> از هر مدل</p>
              <p>سفارش زیر حداقل: <strong>امکان‌پذیر نیست</strong></p>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">شرایط پرداخت</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p><strong>نقد:</strong> در زمان تحویل</p>
              <p><strong>چک:</strong> یک ماهه (فقط مشتریان تأییدشده)</p>
              <p><strong>نسیه:</strong> تا سقف اعتبار تعریف‌شده</p>
              <p><strong>انتقال بانکی:</strong> حساب‌ها در پنل مشتری</p>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">ارسال و تحویل</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p><strong>پیک شهری (مشهد):</strong> رایگان برای سطح A و B</p>
              <p><strong>باربری:</strong> چاپار، تیپاکس، پست</p>
              <p><strong>زمان آماده‌سازی:</strong> ۱ تا ۳ روز کاری</p>
              <p><strong>سفارش بالای ۵ میلیون تومان:</strong> ارسال رایگان</p>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">مزایای همکاری</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>دسترسی به <strong>کاتالوگ کامل</strong> قبل از عرضه عمومی</p>
              <p>اطلاع‌رسانی <strong>مدل‌های جدید</strong> فصلی</p>
              <p>امکان <strong>سفارش اختصاصی</strong> رنگ و مدل</p>
              <p>پشتیبانی <strong>مستقیم</strong> از طریق تلگرام</p>
            </div>
          </div>
        </div>

        {/* Return policy */}
        <div className="card p-8 border-r-4 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-3">مرجوعی و ضمانت</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p>• مرجوعی فقط در صورت <strong>عیب تولیدی</strong> پذیرفته می‌شود</p>
                <p>• مدت اعلام عیب: حداکثر <strong>۷ روز</strong> پس از دریافت</p>
                <p>• مرجوعی به دلیل <strong>رنگ یا مدل</strong> امکان‌پذیر نیست</p>
                <p>• هزینه ارسال مرجوعی بر عهده <strong>مشتری</strong> است (مگر در عیب تولیدی)</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">آماده همکاری هستید؟</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            فرم درخواست عضویت را پر کنید. تیم ما ظرف ۲۴ ساعت با شما تماس می‌گیرد.
          </p>
          <Link href="/portal/register"
            className="inline-flex items-center justify-center h-12 px-10 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold transition-colors">
            ثبت درخواست عضویت
          </Link>
        </div>
      </div>
    </div>
  );
}
