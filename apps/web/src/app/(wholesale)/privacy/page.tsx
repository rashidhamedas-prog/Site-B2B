import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'حریم خصوصی | پوشاک ترنم' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-primary text-white py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-extrabold mb-3">حریم خصوصی</h1>
          <p className="text-white/70">سیاست حفظ اطلاعات شخصی کاربران ترنم</p>
        </div>
      </section>
      <div className="container-site py-12 max-w-3xl">
        <div className="card p-8 space-y-6">
          {[
            { title: 'جمع‌آوری اطلاعات', body: 'اطلاعات شما صرفاً برای ارائه خدمات عمده‌فروشی جمع‌آوری می‌شود. این اطلاعات شامل نام، شماره تماس، آدرس و سابقه خرید است.' },
            { title: 'استفاده از اطلاعات', body: 'اطلاعات شما برای پردازش سفارش، ارسال فاکتور، اعلان‌های کالای جدید و پشتیبانی مشتری استفاده می‌شود.' },
            { title: 'اشتراک‌گذاری', body: 'اطلاعات شما به هیچ شخص ثالثی فروخته یا واگذار نمی‌شود. تنها برای خدمات ضروری مانند حمل‌ونقل به اطلاعات محدود دسترسی داده می‌شود.' },
            { title: 'امنیت', body: 'داده‌های شما در سرورهای امن نگهداری می‌شوند. ارتباط با سایت از طریق پروتکل HTTPS رمزگذاری می‌شود.' },
          ].map((s) => (
            <div key={s.title}>
              <h2 className="text-base font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
