export interface ProcessStep {
  step: string;
  title: string;
  description: string;
}

export function HowItWorks({
  eyebrow = 'فرآیند ساده',
  headline = 'فرآیند خرید عمده',
  body = 'چهار قدم تا دریافت سفارش در بوتیک شما',
  steps,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  steps?: ProcessStep[];
}) {
  const list =
    steps?.length
      ? steps
      : [
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
          {eyebrow ? (
            <p className="mb-3 text-sm font-semibold tracking-wide text-secondary">{eyebrow}</p>
          ) : null}
          {headline ? <h2 className="section-title text-white">{headline}</h2> : null}
          {body ? <p className="text-base text-white/55">{body}</p> : null}
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {list.map((step, index) => (
            <div key={`${step.step}-${step.title}`} className="relative">
              {index < list.length - 1 && (
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
