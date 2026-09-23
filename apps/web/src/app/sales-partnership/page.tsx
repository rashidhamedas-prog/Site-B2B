import type { Metadata } from 'next';
import { SalesPartnershipApply } from '@/components/sales-partners/SalesPartnershipApply';

export const metadata: Metadata = {
  title: 'همکاری بازاریاب با ترنم',
  description:
    'محصولات ترنم را معرفی کنید. قیمت، موجودی، پرداخت و ارسال با ترنم است. پورسانت پس از تحویل و پایان مهلت مرجوعی قابل‌برداشت می‌شود.',
};

export default function SalesPartnershipPage() {
  return <SalesPartnershipApply />;
}
