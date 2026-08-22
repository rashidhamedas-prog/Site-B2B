import { RefreshCw, Scissors, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';

export type TrustItem = {
  value: string;
  label: string;
  sublabel?: string;
};

export const RETAIL_TRUST_FALLBACK: TrustItem[] = [
  { value: 'ارسال سریع', label: 'پست پیشتاز، تیپاکس و ارسال تهران' },
  { value: 'تعویض سایز', label: 'درخواست مرجوعی و تعویض از حساب کاربری' },
  { value: 'پرداخت امن', label: 'زرین‌پال و پرداخت در محل (با شرایط)' },
  { value: 'دوخت کارگاهی', label: 'مستقیم از تولیدی مشهد، بدون واسطه' },
];

function iconFor(value: string): LucideIcon {
  if (/تعویض|مرجوع/.test(value)) return RefreshCw;
  if (/پرداخت|امن/.test(value)) return ShieldCheck;
  if (/دوخت|کارگاه|تولید/.test(value)) return Scissors;
  return Truck;
}

/** Compact post-hero trust bar — Digistyle/Banimode pattern, Taranom tokens. Server-only. */
export function RetailTrustStrip({ items }: { items?: TrustItem[] }) {
  const rows = (items?.length ? items : RETAIL_TRUST_FALLBACK).slice(0, 4);
  const cols =
    rows.length === 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : rows.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2';

  return (
    <section
      className="border-y border-[var(--retail-border)] bg-[var(--retail-surface)]"
      aria-label="تعهدهای فروشگاه"
    >
      <div className={`mx-auto grid max-w-[1200px] divide-y divide-[var(--retail-border)] sm:divide-y-0 ${cols}`}>
        {rows.map((item) => {
          const Icon = iconFor(item.value);
          return (
            <div
              key={`${item.value}-${item.label}`}
              className="flex items-start gap-3 px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--retail-gold)]/40 bg-white text-[var(--retail-primary)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-extrabold text-[var(--retail-ink)]">{item.value}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--retail-muted)]">
                  {item.label}
                  {item.sublabel ? ` — ${item.sublabel}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
