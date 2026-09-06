import type { TrustItem } from '@/components/retail/RetailTrustStrip';
import { RETAIL_TRUST_FALLBACK } from '@/components/retail/RetailTrustStrip';

export function BoutiqueTrustStrip({ items }: { items?: TrustItem[] }) {
  const rows = (items?.length ? items : RETAIL_TRUST_FALLBACK).slice(0, 4);
  return (
    <section className="bq-container py-4" aria-label="تعهدهای فروشگاه">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#121716] p-3 sm:grid-cols-4">
        {rows.map((item) => (
          <div key={item.value} className="px-3 py-3 text-right">
            <p className="text-sm font-extrabold text-white">{item.value}</p>
            {item.label ? <p className="mt-1 text-xs leading-6 text-white/55">{item.label}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
