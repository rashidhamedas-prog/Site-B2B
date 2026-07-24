import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'قوانین و مقررات',
  description: 'قوانین استفاده از سایت و سفارش عمده پوشاک ترنم؛ شفاف و کوتاه.',
  alternates: { canonical: 'https://poshaktaranom.com/terms' },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight">قوانین و مقررات</h1>
          <p className="text-white/70">شرایط استفاده از پلتفرم عمده‌فروشی ترنم</p>
        </div>
      </section>
      <div className="container-site max-w-3xl py-12">
        <div className="prose prose-gray max-w-none space-y-8 border border-[color:var(--color-border)] bg-white p-8">
          {[
            {
              title: '۱. شرایط عضویت',
              body: `کلیه مشتریان برای استفاده از پنل عمده باید درخواست عضویت دهند. پس از بررسی توسط تیم فروش، حساب فعال می‌شود. ترنم حق رد یا تعلیق هر حساب را بدون ذکر دلیل برای خود محفوظ می‌دارد.`,
            },
            {
              title: '۲. قیمت‌گذاری',
              body: `قیمت‌های نمایش‌داده‌شده در پنل مشتری به صورت اختصاصی برای هر مشتری محاسبه شده‌اند. انتشار یا اشتراک‌گذاری این قیمت‌ها با اشخاص ثالث ممنوع است.`,
            },
            {
              title: '۳. ثبت سفارش',
              body: `ثبت سفارش در پنل به معنی درخواست اولیه است. سفارش پس از تأیید توسط تیم ترنم قطعی می‌شود. حداقل سفارش ۱۲ عدد از یک مدل است.`,
            },
            {
              title: '۴. پرداخت',
              body: `پرداخت باید طبق شرایط توافق‌شده انجام شود. فاکتور رسمی پس از تأیید سفارش صادر می‌گردد. تأخیر در پرداخت ممکن است به تعلیق حساب منجر شود.`,
            },
            {
              title: '۵. مرجوعی و ضمانت',
              body: `مرجوعی تنها در صورت عیب تولیدی و ظرف ۷ روز پس از دریافت پذیرفته می‌شود. محصول باید بدون استفاده و با بسته‌بندی اصلی برگردانده شود.`,
            },
            {
              title: '۶. حریم خصوصی',
              body: `اطلاعات مشتریان نزد ترنم محرمانه است و به هیچ شخص ثالثی منتقل نمی‌شود. اطلاعات تماس برای ارتباطات تجاری مستقیم استفاده می‌شود.`,
            },
          ].map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-gray-600 leading-relaxed text-sm">{s.body}</p>
            </div>
          ))}
          <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            آخرین بروزرسانی: تیر ۱۴۰۳ — برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.
          </div>
        </div>
      </div>
    </div>
  );
}
