import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'شرایط مرجوعی عمده',
  description:
    'اگر ایراد دوخت یا مغایرت سفارش عمده داشتید، شرایط مرجوعی و تعویض ترنم را اینجا بخوانید.',
  alternates: { canonical: 'https://poshaktaranom.com/returns' },
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight">شرایط مرجوعی</h1>
          <p className="text-white/70">راهنمای بازگشت کالا و ضمانت کیفیت</p>
        </div>
      </section>
      <div className="container-site max-w-3xl py-12">
        <div className="space-y-6 border border-[color:var(--color-border)] bg-white p-8">
          {[
            { title: 'شرایط پذیرش مرجوعی', body: 'مرجوعی فقط در صورت عیب تولیدی یا ارسال کالای اشتباه پذیرفته می‌شود. مهلت اعلام: ۷ روز کاری پس از دریافت.' },
            { title: 'نحوه درخواست مرجوعی', body: 'برای ثبت درخواست مرجوعی با پشتیبانی از طریق تلگرام @toliditaranom تماس بگیرید. تصویر عیب را ارسال کنید.' },
            { title: 'شرایط مرجوعی', body: 'کالا باید بدون استفاده، بدون تغییر و با برچسب‌های اصلی باشد. کالایی که استفاده شده یا دچار آسیب خریدار شده باشد پذیرفته نمی‌شود.' },
            { title: 'هزینه ارسال', body: 'در صورت عیب تولیدی، هزینه ارسال مرجوعی توسط ترنم پرداخت می‌شود. در سایر موارد هزینه با خریدار است.' },
            { title: 'استرداد وجه', body: 'پس از تأیید مرجوعی، مبلغ در حساب اعتباری شما (برای خرید بعدی) یا واریز بانکی ظرف ۵ روز کاری برگردانده می‌شود.' },
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
