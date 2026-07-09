import Link from 'next/link';
import { Button } from '@/components/ui';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const highlights = [
  'لینن و کتان با کیفیت برتر',
  'تحویل سریع به سراسر ایران',
  'قیمت مستقیم از کارخانه',
  'پشتیبانی اختصاصی فروش',
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-bl from-primary-dark via-primary to-primary-light min-h-[85vh] flex items-center">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Gold accent circles */}
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

      <div className="container-site relative py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Text content */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-secondary mb-6 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              تولیدی ترنم — از ۱۳۹۴ تا امروز
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              مانتو زنانه
              <br />
              <span className="text-secondary">مستقیم از تولیدی</span>
              <br />
              به بوتیک شما
            </h1>

            <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-lg">
              تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. با بیش از ده سال تجربه در بازار
              پوشاک، مستقیم به بوتیک‌ها و فروشندگان سراسر ایران می‌فروشیم.
            </p>

            <ul className="space-y-2.5 mb-10">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-white/90">
                  <CheckCircle className="h-5 w-5 text-secondary flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-4">
              <Link href="/products">
                <Button size="lg" variant="secondary" leftIcon={<ArrowLeft className="h-5 w-5 rtl-flip" />}>
                  مشاهده محصولات
                </Button>
              </Link>
              <Link href="/portal/register">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
                  ثبت‌نام عمده‌فروش
                </Button>
              </Link>
            </div>
          </div>

          {/* Visual panel */}
          <div className="hidden lg:block">
            <div className="relative mx-auto max-w-sm">
              {/* Main card */}
              <div className="rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 shadow-2xl">
                {/* Fashion SVG Illustration */}
                <div className="aspect-[3/4] rounded-2xl bg-gradient-to-b from-white/20 to-white/5 flex items-center justify-center overflow-hidden relative">
                  <svg viewBox="0 0 200 280" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
                    {/* Coat hanger */}
                    <path d="M100 20 Q100 10 110 10 Q120 10 120 20 L135 35 Q150 40 160 50 L40 50 Q50 40 65 35 Z" fill="rgba(201,168,76,0.6)" />
                    <line x1="100" y1="20" x2="100" y2="35" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
                    {/* Manteau body */}
                    <path d="M60 55 L50 80 L45 140 L45 240 L155 240 L155 140 L150 80 L140 55 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                    {/* Collar */}
                    <path d="M80 55 L100 75 L120 55 L100 65 Z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
                    {/* Button line */}
                    <line x1="100" y1="75" x2="100" y2="230" stroke="rgba(201,168,76,0.5)" strokeWidth="1" strokeDasharray="4,4"/>
                    <circle cx="100" cy="100" r="3" fill="rgba(201,168,76,0.8)"/>
                    <circle cx="100" cy="125" r="3" fill="rgba(201,168,76,0.8)"/>
                    <circle cx="100" cy="150" r="3" fill="rgba(201,168,76,0.8)"/>
                    <circle cx="100" cy="175" r="3" fill="rgba(201,168,76,0.8)"/>
                    {/* Sleeves */}
                    <path d="M60 55 L35 70 L30 120 L50 120 L55 80 Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                    <path d="M140 55 L165 70 L170 120 L150 120 L145 80 Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                    {/* Fabric texture lines */}
                    <path d="M65 90 Q75 88 85 90" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none"/>
                    <path d="M65 105 Q80 103 90 105" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none"/>
                    <path d="M110 90 Q125 88 135 90" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none"/>
                    {/* Pocket */}
                    <rect x="55" y="160" width="28" height="20" rx="4" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
                    <rect x="117" y="160" width="28" height="20" rx="4" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
                    {/* Label tag */}
                    <rect x="85" y="235" width="30" height="16" rx="3" fill="rgba(201,168,76,0.4)" stroke="rgba(201,168,76,0.7)" strokeWidth="1"/>
                    <text x="100" y="247" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.9)" fontFamily="sans-serif">ترنم</text>
                  </svg>
                  {/* Catalog label */}
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <p className="text-xs text-white/70 font-medium">کاتالوگ فصل جدید</p>
                    <p className="text-[10px] text-secondary mt-0.5">بهار–تابستان ۱۴۰۳</p>
                  </div>
                </div>

                {/* Stats overlay */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xl font-bold text-secondary">+۵۰</p>
                    <p className="text-xs text-white/70 mt-0.5">مدل</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xl font-bold text-secondary">۷</p>
                    <p className="text-xs text-white/70 mt-0.5">رنگ</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xl font-bold text-secondary">۶</p>
                    <p className="text-xs text-white/70 mt-0.5">سایز</p>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 rounded-2xl bg-secondary px-4 py-2.5 shadow-lg">
                <p className="text-xs font-semibold text-white">ارسال رایگان</p>
                <p className="text-[10px] text-white/80">بالای ۵۰۰ هزار تومان</p>
              </div>

              {/* New collection badge */}
              <div className="absolute -top-3 -left-3 rounded-full bg-white px-3 py-1.5 shadow-md border border-primary-50">
                <p className="text-[10px] font-bold text-primary">کلکسیون جدید ✦</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
