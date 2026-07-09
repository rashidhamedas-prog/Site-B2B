import type { Metadata } from 'next';
import { Phone, MapPin, Instagram, MessageCircle, Clock } from 'lucide-react';

export const metadata: Metadata = { title: 'تماس با ما | پوشاک ترنم' };

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-primary text-white py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-extrabold mb-3">تماس با ما</h1>
          <p className="text-white/70">آماده پاسخگویی به سؤالات شما هستیم</p>
        </div>
      </section>

      <div className="container-site py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Contact methods */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">راه‌های ارتباطی</h2>
            <div className="space-y-4">
              {[
                {
                  icon: Phone,
                  title: 'تلفن مستقیم',
                  value: '۰۹۱۵-۲۴۲-۴۶۲۴',
                  link: 'tel:09152424624',
                  color: 'bg-green-50 text-green-600',
                },
                {
                  icon: MessageCircle,
                  title: 'تلگرام',
                  value: '@toliditaranom',
                  link: 'https://t.me/toliditaranom',
                  color: 'bg-blue-50 text-blue-600',
                },
                {
                  icon: Instagram,
                  title: 'اینستاگرام',
                  value: 'tolidi.taranom',
                  link: 'https://instagram.com/tolidi.taranom',
                  color: 'bg-pink-50 text-pink-600',
                },
              ].map((c) => (
                <a key={c.title} href={c.link} target="_blank" rel="noopener noreferrer"
                  className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                    <c.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{c.title}</p>
                    <p className="font-bold text-gray-900">{c.value}</p>
                  </div>
                </a>
              ))}
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-gray-900">ساعات پاسخگویی</h3>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>شنبه تا چهارشنبه</span><span>۸:۰۰ — ۱۷:۰۰</span></div>
                <div className="flex justify-between"><span>پنجشنبه</span><span>۸:۰۰ — ۱۳:۰۰</span></div>
                <div className="flex justify-between text-gray-400"><span>جمعه</span><span>تعطیل</span></div>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">آدرس‌های ما</h2>
            {[
              {
                title: 'کارگاه تولید (مرکز اصلی)',
                address: 'مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — بین ۱۰ و ۱۲ — پلاک ۱۳۷',
                note: 'انبار و تولید',
              },
              {
                title: 'دفتر پخش — پاساژ کیمیا',
                address: 'مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳',
                note: 'فروش عمده، نمایش محصولات',
              },
            ].map((loc) => (
              <div key={loc.title} className="card p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{loc.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{loc.address}</p>
                    <p className="text-xs text-gray-400 mt-1">{loc.note}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="card p-5 bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                برای مراجعه حضوری به دفتر پخش، حتماً قبلاً هماهنگ کنید.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
