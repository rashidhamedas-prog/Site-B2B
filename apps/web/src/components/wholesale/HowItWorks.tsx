const steps = [
  {
    step: '۱',
    title: 'ثبت‌نام',
    description: 'فرم ثبت‌نام را تکمیل کنید. تیم فروش ظرف ۲۴ ساعت با شما تماس می‌گیرد.',
  },
  {
    step: '۲',
    title: 'مشاهده کاتالوگ',
    description: 'پس از تأیید، به قیمت‌های عمده و تمام مدل‌های فصل دسترسی پیدا می‌کنید.',
  },
  {
    step: '۳',
    title: 'ثبت سفارش',
    description: 'سفارش خود را آنلاین ثبت کنید. پیش‌فاکتور فوری صادر می‌شود.',
  },
  {
    step: '۴',
    title: 'دریافت سفارش',
    description: 'پس از تأیید پرداخت، سفارش بسته‌بندی و از طریق چاپار ارسال می‌شود.',
  },
];

export function HowItWorks() {
  return (
    <section className="section bg-primary-dark">
      <div className="container-site">
        <div className="text-center mb-12">
          <h2 className="section-title text-white">فرآیند خرید عمده</h2>
          <p className="text-base text-white/60">چهار قدم ساده تا دریافت سفارشتان</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-0 w-full h-px bg-secondary/30 translate-x-1/2 z-0" />
              )}

              <div className="relative z-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-secondary bg-primary-dark text-secondary text-2xl font-extrabold shadow-lg">
                  {step.step}
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{step.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
