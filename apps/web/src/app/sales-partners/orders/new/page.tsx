import { Suspense } from 'react';
import { SalesPartnerNewOrder } from '@/components/sales-partners/SalesPartnerNewOrder';

export default function SalesPartnerNewOrderPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-stone-600" dir="rtl">در حال بارگذاری فرم سفارش…</p>}>
      <SalesPartnerNewOrder />
    </Suspense>
  );
}
