import type { Metadata } from 'next';
import { Phone, MapPin, Instagram, MessageCircle, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'تماس با ما',
  description:
    'برای سفارش عمده یا بازدید از دفتر پخش مشهد با حامد رشید تماس بگیرید: ۰۹۱۵۲۴۲۴۶۲۴ — پاساژ کیمیا، میدان ۱۷ شهریور.',
  alternates: { canonical: 'https://poshaktaranom.com/contact' },
  openGraph: {
    title: 'تماس با پوشاک ترنم',
    description: 'دفتر پخش مشهد و راه‌های ارتباطی برای عمده‌فروشان.',
    url: 'https://poshaktaranom.com/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <p className="mb-3 text-sm font-semibold tracking-[0.15em] text-secondary">ارتباط مستقیم</p>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight">تماس با ما</h1>
          <p className="text-white/70">آماده پاسخگویی به سؤالات شما هستیم</p>
        </div>
      </section>

      <div className="container-site py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">راه‌های ارتباطی</h2>
            <div className="space-y-3">
              {[
                {
                  icon: Phone,
                  title: 'تلفن مستقیم',
                  value: '۰۹۱۵-۲۴۲-۴۶۲۴',
                  link: 'tel:09152424624',
                },
                {
                  icon: MessageCircle,
                  title: 'تلگرام',
                  value: '@toliditaranom',
                  link: 'https://t.me/toliditaranom',
                },
                {
                  icon: Instagram,
                  title: 'اینستاگرام',
                  value: 'tolidi.taranom',
                  link: 'https://instagram.com/tolidi.taranom',
                },
              ].map((c) => (
                <a
                  key={c.title}
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-4 border border-[color:var(--color-border)] bg-white p-5 transition-all duration-250 hover:border-primary/25 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-gray-400">{c.title}</p>
                    <p className="font-bold text-gray-900">{c.value}</p>
                  </div>
                </a>
              ))}
            </div>

            <div className="border border-[color:var(--color-border)] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-gray-900">ساعات پاسخگویی</h3>
              </div>
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>شنبه تا چهارشنبه</span>
                  <span>۸:۰۰ — ۱۷:۰۰</span>
                </div>
                <div className="flex justify-between">
                  <span>پنجشنبه</span>
                  <span>۸:۰۰ — ۱۳:۰۰</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>جمعه</span>
                  <span>تعطیل</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">آدرس‌های ما</h2>
            {[
              {
                title: 'کارگاه تولید (مرکز اصلی)',
                address:
                  'مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — بین ۱۰ و ۱۲ — پلاک ۱۳۷',
                note: 'انبار و تولید',
              },
              {
                title: 'دفتر پخش — پاساژ کیمیا',
                address: 'مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳',
                note: 'فروش عمده، نمایش محصولات',
              },
            ].map((loc) => (
              <div key={loc.title} className="border border-[color:var(--color-border)] bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-bold text-gray-900">{loc.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-600">{loc.address}</p>
                    <p className="mt-1 text-xs text-gray-400">{loc.note}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="border border-secondary/30 bg-secondary-50 p-5">
              <p className="text-sm text-secondary-dark">
                برای مراجعه حضوری به دفتر پخش، حتماً قبلاً هماهنگ کنید.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
