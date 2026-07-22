import { Package, Truck, CreditCard, Headphones, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'تولید مستقیم',
    description: 'مستقیم از کارخانه، بدون واسطه. کیفیت تضمینی و قیمت کارخانه برای همه عمده‌فروشان.',
  },
  {
    icon: Truck,
    title: 'ارسال سریع',
    description: 'ارسال چاپار به سراسر ایران. ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان.',
  },
  {
    icon: CreditCard,
    title: 'پرداخت اعتباری',
    description: 'مشتریان دائمی می‌توانند از اعتبار خرید استفاده کنند. سیستم فاکتور و حساب‌کتاب دقیق.',
  },
  {
    icon: Headphones,
    title: 'پشتیبانی اختصاصی',
    description: 'ویزیتور اختصاصی برای مشتریان مشهد و چند شهر. پشتیبانی تلفنی و تلگرامی.',
  },
  {
    icon: Shield,
    title: 'ضمانت کیفیت',
    description: 'تمام محصولات قبل از ارسال بازرسی می‌شوند. مرجوعی ۷ روزه برای کالای معیوب.',
  },
  {
    icon: Zap,
    title: 'مدل‌های جدید',
    description: 'هر فصل کلکسیون جدید. بروزرسانی مستمر و اطلاع‌رسانی اختصاصی به مشتریان.',
  },
];

export function WhyTaranom() {
  return (
    <section className="section relative overflow-hidden bg-surface-muted">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere opacity-80" />
      <div className="container-site relative">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-dark">اعتماد عمده‌فروشان</p>
          <h2 className="section-title mb-3">چرا ترنم؟</h2>
          <p className="section-subtitle mx-auto mb-0">
            مزایایی که همکاری با تولیدی ترنم را برای بوتیک‌ها پایدار و سودآور می‌کند
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="group glass-card p-5 transition-all duration-250 hover:-translate-y-0.5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-colors duration-250 group-hover:bg-secondary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-gray-900">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
