import type { Metadata } from 'next';
import { MapPin, Users, Calendar, Award, Shirt } from 'lucide-react';

export const metadata: Metadata = {
  title: 'درباره ما',
  description:
    'ترنم از مشهد شروع شد؛ هنوز هم دوخت، کنترل کیفیت و پخش عمده را خودمان انجام می‌دهیم. اینجا داستان کارگاه و تیم‌مان را می‌خوانید.',
  alternates: { canonical: 'https://poshaktaranom.com/about' },
  openGraph: {
    title: 'درباره پوشاک ترنم',
    description: 'تولیدی مانتو زنانه در مشهد — از الگو تا ارسال عمده.',
    url: 'https://poshaktaranom.com/about',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <p className="mb-3 text-sm font-semibold tracking-[0.15em] text-secondary">هویت برند</p>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight">درباره پوشاک ترنم</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/70">
            از سال ۱۳۹۴، تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد
          </p>
        </div>
      </section>

      <section className="container-site space-y-20 py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-5">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">داستان ما</h2>
            <p className="leading-relaxed text-gray-600">
              پوشاک ترنم در سال ۱۳۹۴ توسط حامد رشید از صفر پایه‌گذاری شد. با بیش از ۱۰ سال تجربه در
              بازاریابی و مدیریت فروش پوشاک، حامد تصمیم گرفت تولیدی خودش را راه‌اندازی کند که بر کیفیت
              پارچه و طراحی مدرن تمرکز داشته باشد.
            </p>
            <p className="leading-relaxed text-gray-600">
              تخصص ما مانتو شومیزی زنانه اسپرت از جنس لینن و کتان است — پارچه‌هایی که تهویه مناسب داشته،
              سبک بوده و برای آب‌وهوای ایران مناسب هستند. امروز با تیمی ۱۵ نفره، هر فصل مدل‌های جدید را
              به بازار عرضه می‌کنیم.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calendar, value: '۱۳۹۴', label: 'سال تأسیس' },
              { icon: Users, value: '۱۵ نفر', label: 'تیم تولید' },
              { icon: Award, value: '+۵۰۰', label: 'مشتری فعال' },
              { icon: Shirt, value: '+۵۰ مدل', label: 'در هر فصل' },
            ].map((s) => (
              <div
                key={s.label}
                className="border border-[color:var(--color-border)] bg-white p-6 text-center transition-shadow duration-250 hover:shadow-md"
              >
                <s.icon className="mx-auto mb-3 h-7 w-7 text-primary" />
                <p className="text-2xl font-extrabold tracking-tight text-gray-900">{s.value}</p>
                <p className="mt-1 text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-gray-900">مکان‌های ما</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 border border-[color:var(--color-border)] bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-gray-900">کارگاه تولید</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">
                مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — پلاک ۱۳۷
              </p>
              <p className="text-xs text-gray-400">ملک ویلایی ۲۵۰ متر، دو طبقه</p>
            </div>
            <div className="space-y-3 border border-[color:var(--color-border)] bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-50">
                  <MapPin className="h-5 w-5 text-secondary" />
                </div>
                <h3 className="font-bold text-gray-900">دفتر پخش — پاساژ کیمیا</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">
                مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳
              </p>
              <p className="text-xs text-gray-400">ویترین فروش عمده، ۱۲ متر</p>
            </div>
          </div>
        </div>

        <div className="bg-primary-dark px-8 py-12 text-white sm:px-10 sm:rounded-2xl">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight">ارزش‌های ما</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: 'کیفیت پارچه',
                desc: 'فقط از لینن و کتان درجه‌یک استفاده می‌کنیم. هر پارچه قبل از برش تست می‌شود.',
              },
              {
                title: 'طراحی مدرن',
                desc: 'مدل‌های ما ترکیبی از سادگی و ظرافت هستند که در فصل‌های مختلف قابل استفاده‌اند.',
              },
              {
                title: 'پشتیبانی عمده‌فروشان',
                desc: 'با ارائه شرایط نسیه، تحویل سریع و بسته‌بندی مناسب، همراه فروشندگان هستیم.',
              },
            ].map((v) => (
              <div key={v.title}>
                <h3 className="mb-2 font-bold text-secondary">{v.title}</h3>
                <p className="text-sm leading-relaxed text-white/65">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
