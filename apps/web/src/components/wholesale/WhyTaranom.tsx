import {
  Package,
  Truck,
  CreditCard,
  Headphones,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toPersianDigits } from '@taranom/persian-utils';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';

const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  Truck,
  CreditCard,
  Headphones,
  Shield,
  Zap,
};

export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
}

export function WhyTaranom({
  eyebrow = 'اعتماد عمده‌فروشان',
  headline = 'چرا تولیدی ترنم؟',
  body = 'مزایایی که همکاری با تولیدی ترنم را برای بوتیک‌ها پایدار و سودآور می‌کند',
  items,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  items?: FeatureItem[];
}) {
  const features =
    items?.length
      ? items
      : [
          {
            icon: 'Package',
            title: 'تولید ۰ تا ۱۰۰ داخل کارگاه',
            description:
              'از برش تا بسته‌بندی در کارگاه ترنم انجام می‌شود؛ کنترل کیفیت مستقیم و قیمت کارخانه برای عمده‌فروشان.',
          },
          {
            icon: 'Shield',
            title: 'ضمانت شستشوی آنزیمی',
            description:
              'لینن و پارچه‌های حساس با شستشوی آنزیمی ضدآبرفت آماده می‌شوند تا بوتیک شما مرجوعی کمتری داشته باشد.',
          },
          {
            icon: 'Zap',
            title: `${yearsOfOperationFa()} سال تجربه تولیدی`,
            description: `از ${toPersianDigits(BUSINESS_FACTS.foundedSolarYear)} تا امروز، تامین‌کننده بوتیک‌ها در مشهد و سراسر ایران با کلکسیون‌های فصلی مستمر.`,
          },
          {
            icon: 'Truck',
            title: 'ارسال سریع',
            description: 'ارسال چاپار به سراسر ایران. ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان.',
          },
          {
            icon: 'CreditCard',
            title: 'پرداخت اعتباری',
            description: 'مشتریان دائمی می‌توانند از اعتبار خرید استفاده کنند. سیستم فاکتور و حساب‌کتاب دقیق.',
          },
          {
            icon: 'Headphones',
            title: 'پشتیبانی اختصاصی',
            description: 'ویزیتور اختصاصی برای مشتریان مشهد و چند شهر. پشتیبانی تلفنی و تلگرامی.',
          },
        ];

  return (
    <section className="section relative overflow-hidden bg-surface-muted">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere opacity-80" />
      <div className="container-site relative">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          {eyebrow ? (
            <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-dark">{eyebrow}</p>
          ) : null}
          {headline ? <h2 className="section-title mb-3">{headline}</h2> : null}
          {body ? <p className="section-subtitle mx-auto mb-0">{body}</p> : null}
        </div>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = ICON_MAP[feature.icon || 'Package'] || Package;
            return (
              <div
                key={feature.title}
                className="group glass-card p-5 transition-all duration-250 hover:-translate-y-0.5"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-colors duration-250 group-hover:bg-secondary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
