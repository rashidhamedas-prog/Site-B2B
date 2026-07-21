const steps = [
  {
    step: '۰۱',
    title: 'ثبت‌نام',
    description: 'فرم ثبت‌نام را تکمیل کنید. تیم فروش ظرف ۲۴ ساعت با شما تماس می‌گیرد.',
  },
  {
    step: '۰۲',
    title: 'مشاهده کاتالوگ',
    description: 'پس از تأیید، به قیمت‌های عمده و تمام مدل‌های فصل دسترسی پیدا می‌کنید.',
  },
  {
    step: '۰۳',
    title: 'ثبت سفارش',
    description: 'سفارش خود را آنلاین ثبت کنید. پیش‌فاکتور فوری صادر می‌شود.',
  },
  {
    step: '۰۴',
    title: 'دریافت سفارش',
    description: 'پس از تأیید پرداخت، سفارش بسته‌بندی و از طریق چاپار ارسال می‌شود.',
  },
];

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-primary-dark section">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(201,168,76,0.12), transparent 55%)',
        }}
      />

      <div className="container-site relative">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary">فرآیند ساده</p>
          <h2 className="section-title text-white">فرآیند خرید عمده</h2>
          <p className="text-base text-white/55">چهار قدم تا دریافت سفارش در بوتیک شما</p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-0 top-5 z-0 hidden h-px w-full translate-x-1/2 bg-gradient-to-l from-transparent via-secondary/30 to-secondary/40 lg:block" />
              )}

              <div className="relative z-10">
                <p className="mb-4 font-mono text-3xl font-extrabold tracking-tight text-secondary/90">
                  {step.step}
                </p>
                <h3 className="mb-2 text-base font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
