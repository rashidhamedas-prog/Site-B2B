type FeeSource = 'tariff' | 'tapin' | 'fallback';

const TEXT: Record<FeeSource, string | null> = {
  tapin: null,
  tariff: 'مبلغ بر اساس نرخ‌نامهٔ فروشگاه',
  fallback: 'مبلغ تقریبی است و در صورت اختلاف با نرخ پست، اصلاح می‌شود',
};

export function shippingSourceText(source?: FeeSource | null): string | null {
  return source ? TEXT[source] ?? null : null;
}

export function ShippingSourceNote({
  feeSource,
  weightIsEstimated,
  className,
}: {
  feeSource?: FeeSource | null;
  weightIsEstimated?: boolean;
  className?: string;
}) {
  const text = shippingSourceText(feeSource);
  if (!text && !weightIsEstimated) return null;
  return (
    <p className={className ?? 'mt-1 text-xs text-gray-500'} data-fee-source={feeSource ?? undefined}>
      {text}
      {text && weightIsEstimated ? ' · ' : null}
      {weightIsEstimated ? 'وزن بر اساس تخمین محاسبه شده است' : null}
    </p>
  );
}
