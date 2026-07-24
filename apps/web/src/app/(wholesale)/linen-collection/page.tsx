import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCatalog } from '@/components/wholesale/ProductCatalog';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'کلکسیون لینن — عمده از کارگاه مشهد',
  description:
    'مانتو و شومیز لینن را برای بوتیک‌تان عمده بگیرید؛ پارچه سبک، دوخت کارگاهی، ارسال به سراسر ایران.',
  alternates: { canonical: 'https://poshaktaranom.com/linen-collection' },
  openGraph: {
    title: 'کلکسیون لینن ترنم',
    description: 'عمده مانتو و شومیز لینن مستقیم از تولیدی مشهد.',
    url: 'https://poshaktaranom.com/linen-collection',
    images: [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: 'کلکسیون لینن ترنم' }],
  },
};

export default function LinenCollectionPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container-site relative z-10">
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-light">کلکسیون ویژه</p>
          <h1 className="mb-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            تولیدی لباس لینن در مشهد
          </h1>
          <p className="mb-8 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            اگر به‌دنبال <strong className="font-semibold text-white">عمده مانتو و شومیزی لینن</strong> از
            تولیدی هستید، کلکسیون لینن ترنم برای بوتیک‌داران طراحی شده است: پارچه لینن با دوخت تقویت‌شده،
            حداقل سفارش عمده، و ارسال به سراسر ایران.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/portal/register" className="cursor-pointer">
              <Button variant="secondary" size="lg">ثبت‌نام عمده‌فروش</Button>
            </Link>
            <Link href="/contact" className="cursor-pointer">
              <Button variant="glass" size="lg" className="border-white/40 text-white">
                مشاوره خرید عمده
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="section bg-atmosphere">
        <div className="container-site mb-10 max-w-3xl">
          <h2 className="section-title">چرا لینن ترنم؟</h2>
          <p className="section-subtitle mb-0">
            لینن خنک، سبک و مناسب فصل گرم است. در ترنم، شستشوی آنزیمی و کنترل کیفیت قبل از ارسال، جمع‌شدگی و
            افت کیفیت را برای بوتیک شما کاهش می‌دهد.
          </p>
        </div>
        <ProductCatalog searchParams={{ fabric: 'لینن' }} embedded hideHeader />
      </section>
    </>
  );
}
