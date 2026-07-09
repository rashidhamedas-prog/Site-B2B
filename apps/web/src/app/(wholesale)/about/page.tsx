import type { Metadata } from 'next';
import { MapPin, Phone, Users, Calendar, Award, Shirt } from 'lucide-react';

export const metadata: Metadata = { title: 'درباره ترنم | تولیدی مانتو زنانه مشهد' };

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light text-white py-20">
        <div className="container-site text-center">
          <h1 className="text-4xl font-extrabold mb-4">درباره پوشاک ترنم</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            از سال ۱۳۹۴، تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد
          </p>
        </div>
      </section>

      <section className="container-site py-16 space-y-16">
        {/* Story */}
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-5">
            <h2 className="text-3xl font-extrabold text-gray-900">داستان ما</h2>
            <p className="text-gray-600 leading-relaxed">
              پوشاک ترنم در سال ۱۳۹۴ توسط حامد رشید از صفر پایه‌گذاری شد. با بیش از ۱۰ سال تجربه در بازاریابی و مدیریت فروش پوشاک، حامد تصمیم گرفت تولیدی خودش را راه‌اندازی کند که بر کیفیت پارچه و طراحی مدرن تمرکز داشته باشد.
            </p>
            <p className="text-gray-600 leading-relaxed">
              تخصص ما مانتو شومیزی زنانه اسپرت از جنس لینن و کتان است — پارچه‌هایی که تهویه مناسب داشته، سبک بوده و برای آب‌وهوای ایران مناسب هستند. امروز با تیمی ۱۵ نفره، هر فصل مدل‌های جدید را به بازار عرضه می‌کنیم.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calendar, value: '۱۳۹۴', label: 'سال تأسیس' },
              { icon: Users, value: '۱۵ نفر', label: 'تیم تولید' },
              { icon: Award, value: '+۵۰۰', label: 'مشتری فعال' },
              { icon: Shirt, value: '+۵۰ مدل', label: 'در هر فصل' },
            ].map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <s.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">مکان‌های ما</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-gray-900">کارگاه تولید</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — پلاک ۱۳۷
              </p>
              <p className="text-xs text-gray-400">ملک ویلایی ۲۵۰ متر، دو طبقه</p>
            </div>
            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-secondary" />
                </div>
                <h3 className="font-bold text-gray-900">دفتر پخش — پاساژ کیمیا</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳
              </p>
              <p className="text-xs text-gray-400">ویترین فروش عمده، ۱۲ متر</p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="bg-primary-50 rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">ارزش‌های ما</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: 'کیفیت پارچه', desc: 'فقط از لینن و کتان درجه‌یک استفاده می‌کنیم. هر پارچه قبل از برش تست می‌شود.' },
              { title: 'طراحی مدرن', desc: 'مدل‌های ما ترکیبی از سادگی و ظرافت هستند که در فصل‌های مختلف قابل استفاده‌اند.' },
              { title: 'پشتیبانی عمده‌فروشان', desc: 'با ارائه شرایط نسیه، تحویل سریع و بسته‌بندی مناسب، همراه فروشندگان هستیم.' },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
