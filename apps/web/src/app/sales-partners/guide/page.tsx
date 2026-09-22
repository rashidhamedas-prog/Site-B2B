import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

export default function SalesPartnerGuidePage() {
  return (
    <SalesPartnerShell title="آموزش و قوانین">
      <p className="text-sm leading-7 text-stone-700">
        شما محصول را معرفی و مشتری را برای تصمیم‌گیری راهنمایی می‌کنید. ترنم قیمت، موجودی، پرداخت، بسته‌بندی، ارسال و پشتیبانی سفارش را انجام می‌دهد. پورسانت هر سفارش پس از تحویل و پایان مهلت مرجوعی قابل‌برداشت می‌شود.
      </p>
      <p className="mt-3 text-sm text-stone-600">متن حقوقی نهایی شرایط همکاری هنوز باید تأیید مالک یا مشاور حقوقی شود.</p>
    </SalesPartnerShell>
  );
}
