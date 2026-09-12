import { toPersianDigits } from '@taranom/persian-utils';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';
import { resolveWholesaleStatKind } from '@/lib/wholesale-stat-kind';
import { WholesaleStatGlyph } from '@/components/wholesale/WholesaleStatGlyph';

export interface StatItem {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
}

const FALLBACK_ITEMS: StatItem[] = [
  {
    value: `+${toPersianDigits(BUSINESS_FACTS.activeCustomers)}`,
    label: 'مشتری عمده‌فروش',
    sublabel: 'در سراسر ایران',
    icon: 'customers',
  },
  {
    value: yearsOfOperationFa(),
    label: 'سال تجربه',
    sublabel: 'در بازار پوشاک',
    icon: 'years',
  },
  {
    value: `+${toPersianDigits(BUSINESS_FACTS.activeModels)}`,
    label: 'مدل فعال',
    sublabel: 'بهار و تابستان',
    icon: 'models',
  },
  {
    value: toPersianDigits(BUSINESS_FACTS.teamSize),
    label: 'نفر پرسنل',
    sublabel: 'در خط تولید',
    icon: 'team',
  },
];

function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
}

function cellClass(index: number, count: number): string {
  const parts = [
    'group flex min-w-0 items-center justify-center gap-2.5 px-2 py-3 sm:gap-3 sm:px-3 sm:py-3.5 lg:px-4',
  ];
  if (count === 4) {
    if (index % 2 === 1) {
      parts.push('border-s border-secondary/20');
    }
    if (index >= 2) {
      parts.push('border-t border-secondary/20 lg:border-t-0');
    }
    if (index === 2) {
      parts.push('lg:border-s lg:border-secondary/20');
    }
  } else if (count === 3 && index > 0) {
    parts.push('border-t border-secondary/20 sm:border-t-0 sm:border-s sm:border-secondary/20');
  } else if (count !== 4 && count !== 3 && index > 0) {
    parts.push('border-t border-secondary/20 sm:border-t-0 sm:border-s sm:border-secondary/20');
  }
  return parts.join(' ');
}

/**
 * Compact post-hero proof rail for wholesale.
 * Height budget is ~half the former py-12/14 number stack.
 * Server-only: inline SVG, no client JS, CMS items stay authoritative.
 */
export function WholesaleStats({ items = FALLBACK_ITEMS }: { items?: StatItem[] }) {
  const rows = items.filter((row) => row.value && row.label);
  if (!rows.length) return null;

  return (
    <section
      className="relative overflow-hidden border-b border-[color:var(--color-border)] bg-surface-muted"
      aria-label="آمار تولیدی ترنم"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-secondary/80 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.09),transparent_58%)]"
      />
      <div className="container-site relative py-2.5 sm:py-3">
        <div className="rounded-2xl bg-white/90 shadow-[0_1px_2px_rgba(27,92,74,0.05)] ring-1 ring-[color:var(--color-border)]">
          <ul className={`grid ${gridClass(rows.length)}`}>
            {rows.map((stat, index) => {
              const kind = resolveWholesaleStatKind(stat);
              return (
                <li key={`${stat.label}-${stat.value}`} className={cellClass(index, rows.length)}>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted ring-1 ring-[color:var(--color-border)]">
                    <WholesaleStatGlyph kind={kind} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold leading-none tracking-tight text-primary sm:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-semibold leading-4 text-gray-800 sm:text-xs">
                      {stat.label}
                    </p>
                    {stat.sublabel ? (
                      <p className="truncate text-[10px] leading-4 text-gray-500">{stat.sublabel}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
