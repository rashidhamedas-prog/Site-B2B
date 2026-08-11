import { toPersianDigits } from '@taranom/persian-utils';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';

export interface StatItem {
  value: string;
  label: string;
  sublabel?: string;
}

export function WholesaleStats({
  items = [
    {
      value: `+${toPersianDigits(BUSINESS_FACTS.activeCustomers)}`,
      label: 'مشتری عمده‌فروش',
      sublabel: 'در سراسر ایران',
    },
    { value: yearsOfOperationFa(), label: 'سال تجربه', sublabel: 'در بازار پوشاک' },
    {
      value: `+${toPersianDigits(BUSINESS_FACTS.activeModels)}`,
      label: 'مدل فعال',
      sublabel: 'بهار و تابستان',
    },
    { value: toPersianDigits(BUSINESS_FACTS.teamSize), label: 'نفر پرسنل', sublabel: 'در خط تولید' },
  ],
}: {
  items?: StatItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="border-b border-[color:var(--color-border)] bg-white">
      <div className="container-site py-12 sm:py-14">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-6">
          {items.map((stat) => (
            <div
              key={`${stat.label}-${stat.value}`}
              className="text-center lg:border-l lg:border-[color:var(--color-border)] lg:first:border-l-0 lg:last:border-l-0"
            >
              <p className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold text-gray-800">{stat.label}</p>
              {stat.sublabel ? <p className="mt-0.5 text-xs text-gray-400">{stat.sublabel}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
