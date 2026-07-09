import { Package, Truck, CreditCard, Headphones, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: <Package className="h-6 w-6" />,
    title: 'تولید مستقیم',
    description: 'مستقیم از کارخانه، بدون واسطه. کیفیت تضمینی و قیمت کارخانه برای همه عمده‌فروشان.',
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: 'ارسال سریع',
    description: 'ارسال چاپار به سراسر ایران. ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان.',
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'پرداخت اعتباری',
    description: 'مشتریان دائمی می‌توانند از اعتبار خرید استفاده کنند. سیستم فاکتور و حساب‌کتاب دقیق.',
  },
  {
    icon: <Headphones className="h-6 w-6" />,
    title: 'پشتیبانی اختصاصی',
    description: 'ویزیتور اختصاصی برای مشتریان مشهد و چند شهر. پشتیبانی تلفنی و تلگرامی.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'ضمانت کیفیت',
    description: 'تمام محصولات قبل از ارسال بازرسی می‌شوند. مرجوعی ۷ روزه برای کالای معیوب.',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'مدل‌های جدید',
    description: 'هر فصل کلکسیون جدید. بروزرسانی مستمر و اطلاع‌رسانی اختصاصی به مشتریان.',
  },
];

export function WhyTaranom() {
  return (
    <section className="section bg-gray-50">
      <div className="container-site">
        <div className="text-center mb-12">
          <h2 className="section-title">چرا ترنم؟</h2>
          <p className="section-subtitle">مزایایی که ما را از دیگر تولیدی‌ها متمایز می‌کند</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="card-hover p-6 group"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-base font-bold text-gray-900">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
