import Link from 'next/link';
import { SalesPartnerShell, SpCard } from '@/components/sales-partners/SalesPartnerShell';

const STEPS = [
  {
    title: 'محصول را معرفی کنید',
    body: 'از کاتالوگ لینک اختصاصی یا متن معرفی را کپی کنید و برای مخاطب بفرستید. قیمت و موجودی را خودتان اختراع نکنید.',
  },
  {
    title: 'یا سفارش برای مشتری بسازید',
    body: 'اگر مشتری حضوری است، از «سفارش جدید» سبد بسازید و لینک تأیید پیامکی بفرستید. تا تأیید مشتری، پولی گرفته نمی‌شود.',
  },
  {
    title: 'ترنم فروش و ارسال را انجام می‌دهد',
    body: 'پرداخت روی درگاه ترنم است. شما انباردار، پیک یا ثبت‌کننده کد رهگیری نیستید.',
  },
  {
    title: 'پورسانت بعد از تحویل آزاد می‌شود',
    body: 'بعد از پرداخت، مبلغ در «در انتظار آزادسازی» می‌آید. پس از تحویل و پایان مهلت مرجوعی، قابل‌برداشت می‌شود. لغو یا مرجوعی همان قلم را برمی‌گرداند.',
  },
  {
    title: 'شبا را برای تسویه آماده کنید',
    body: 'در بخش حساب، شبا را ثبت کنید. تسویه را فروشگاه با مرجع بانکی ثبت می‌کند و در صفحه تسویه می‌بینید.',
  },
];

export default function SalesPartnerGuidePage() {
  return (
    <SalesPartnerShell title="آموزش">
      <SpCard className="mb-4">
        <p className="text-sm leading-7 text-stone-700">
          شما محصول را معرفی و مشتری را راهنمایی می‌کنید. ترنم قیمت، موجودی، پرداخت، بسته‌بندی، ارسال و پشتیبانی را انجام
          می‌دهد. این نقش با «تأمین‌کننده ارسال» فرق دارد.
        </p>
      </SpCard>
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <SpCard>
              <p className="text-xs font-semibold text-[#1B5C4A]">
                گام {(index + 1).toLocaleString('fa-IR')}
              </p>
              <h2 className="mt-1 text-base font-semibold text-stone-900">{step.title}</h2>
              <p className="mt-2 text-sm leading-7 text-stone-600">{step.body}</p>
            </SpCard>
          </li>
        ))}
      </ol>
      <SpCard className="mt-4 text-sm leading-7 text-stone-600">
        <p>
          متن کامل شرایط در{' '}
          <Link href="/sales-partnership/terms" className="font-medium text-[#1B5C4A] underline-offset-4 hover:underline">
            شرایط همکاری بازاریاب
          </Link>{' '}
          آمده است. پورسانت پس از تحویل و دوره نگهداری قابل‌برداشت می‌شود مگر ادمین مهلت را عوض کند.
        </p>
      </SpCard>
    </SalesPartnerShell>
  );
}
