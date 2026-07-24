import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'کارگاه و دفتر پخش',
  description:
    'نگاهی کوتاه به خط برش، دوخت و دفتر پخش ترنم در مشهد — جایی که سفارش عمده شما از آنجا راه می‌افتد.',
  alternates: { canonical: 'https://poshaktaranom.com/workshop' },
  openGraph: {
    title: 'کارگاه پوشاک ترنم',
    description: 'از الگو تا بسته‌بندی عمده در مشهد.',
    url: 'https://poshaktaranom.com/workshop',
  },
};

const GALLERY = [
  { title: 'خط برش و الگو', caption: 'شروع تولید از الگوی استاندارد سایز عمده' },
  { title: 'دوخت صنعتی', caption: 'دوخت تقویت‌شده برای دوام بوتیک' },
  { title: 'کنترل کیفیت', caption: 'بازرسی قبل از بسته‌بندی و ارسال' },
  { title: 'دفتر پخش مشهد', caption: 'پاساژ کیمیا — میدان ۱۷ شهریور' },
];

export default function WorkshopPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container-site relative z-10">
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-light">E-E-A-T</p>
          <h1 className="mb-4 max-w-3xl text-3xl font-extrabold text-white sm:text-4xl">
            کارگاه و خط تولید ترنم
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            شفافیت تولید برای بوتیک‌داران: از برش تا بسته‌بندی داخل کارگاه مشهد انجام می‌شود.
          </p>
        </div>
      </section>

      <section className="section bg-atmosphere">
        <div className="container-site">
          <div className="mb-10 max-w-2xl">
            <h2 className="section-title">گالری تولید و دفتر پخش</h2>
            <p className="section-subtitle mb-0">
              تصاویر نماینده فضای واقعی کارگاه و دفتر عمده هستند. برای بازدید حضوری با تیم فروش هماهنگ کنید.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {GALLERY.map((item) => (
              <article key={item.title} className="glass-card overflow-hidden">
                <div className="flex aspect-[16/10] items-end bg-gradient-to-br from-primary-dark via-primary to-primary-light p-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/75">{item.caption}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/contact" className="cursor-pointer">
              <Button variant="primary" size="lg">هماهنگی بازدید</Button>
            </Link>
            <Link href="/linen-collection" className="cursor-pointer">
              <Button variant="glass" size="lg">کلکسیون لینن</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
