import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  organizationId,
  websiteId,
} from '@/components/shared/JsonLd';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

const PAGE_PATH = '/wholesale-manto-mashhad';
const PAGE_URL = `${WHOLESALE_ORIGIN}${PAGE_PATH}`;
const H1 = 'تولیدی و عمده‌فروشی مانتو زنانه در مشهد';
const TITLE = 'تولیدی و عمده‌فروشی مانتو زنانه در مشهد | پوشاک ترنم';
const DESCRIPTION =
  'خرید عمده مانتو زنانه مستقیم از تولیدی ترنم در مشهد؛ لینن و کتان، رنگ‌بندی و سایزبندی بوتیک، ارسال به سراسر ایران.';
const HERO =
  'اگر برای بوتیک یا فروشگاه خود به‌دنبال تولیدی مانتو زنانه در مشهد هستید، ترنم مدل‌های اسپرت را از کارگاه تا دفتر پخش عمده عرضه می‌کند.';

const CATEGORIES = [
  { href: '/category/women-manto', label: 'مانتو زنانه' },
  { href: '/category/shomiz', label: 'شومیز' },
  { href: '/category/women-coats', label: 'کت زنانه' },
  { href: '/category/women-pants', label: 'شلوار زنانه' },
  { href: '/category/winter-wear', label: 'لباس زمستانی' },
  { href: '/category/linen-collection', label: 'کلکسیون لینن' },
];

const FAQ = [
  {
    question: 'حداقل سفارش عمده چقدر است؟',
    answer: 'حداقل سفارش در محصول از 6 عدد به بالا می باشد.',
  },
  {
    question: 'دفتر پخش ترنم کجاست؟',
    answer:
      'دفتر پخش در مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳ قرار دارد.',
  },
  {
    question: 'چه محصولاتی به‌صورت عمده عرضه می‌شود؟',
    answer:
      'مانتو، شومیز، کت، شلوار، لباس زمستانی و کلکسیون لینن از تولیدی ترنم مشهد قابل سفارش است.',
  },
  {
    question: 'آیا سفارش به شهرهای دیگر ارسال می‌شود؟',
    answer: 'بله؛ سفارش عمده پس از کنترل کیفیت از دفتر پخش مشهد به سراسر ایران ارسال می‌شود.',
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
    locale: 'fa_IR',
  },
};

export default function WholesaleMantoMashhadPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: H1, url: PAGE_URL },
        ]}
      />
      <FaqJsonLd items={FAQ} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': `${PAGE_URL}#webpage`,
            url: PAGE_URL,
            name: H1,
            description: DESCRIPTION,
            isPartOf: { '@id': websiteId('WHOLESALE') },
            about: { '@id': organizationId('WHOLESALE') },
            inLanguage: 'fa-IR',
          }),
        }}
      />

      <article className="bg-[#F6F1E8] text-[#1A1A1A]">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <nav className="mb-10 text-xs text-[#6B7280]" aria-label="مسیر صفحه">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/" className="hover:text-[#1B5C4A]">
                  خانه
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-[#0F2F28]">{H1}</li>
            </ol>
          </nav>

          <header className="border-b border-[#E8E0D4] pb-12">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-[#C9A84C]">
              محلی · مشهد
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-[#0F2F28] sm:text-5xl">
              {H1}
            </h1>
            <p className="mt-6 text-base leading-8 text-[#4B5563] sm:text-lg">{HERO}</p>
          </header>

          <section className="mt-12 space-y-4 text-sm leading-8 text-[#4B5563] sm:text-base">
            <p>
              تولیدی پوشاک ترنم در مشهد مانتو زنانه اسپرت را برای فروش عمده آماده می‌کند. انتخاب
              پارچه، برش، دوخت و کنترل کیفیت داخل مجموعه انجام می‌شود و سفارش از دفتر پخش پاساژ
              کیمیا برای بوتیک‌های سراسر ایران ارسال می‌گردد.
            </p>
            <p>
              اگر به‌دنبال مانتو لینن، شومیز، کت یا شلوار زنانه برای ویترین فروشگاه هستید، دسته‌های
              زیر مسیر مستقیم به مدل‌های جاری هستند.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold text-[#0F2F28]">دسته‌های عمده</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex rounded-2xl bg-white/80 px-5 py-4 text-sm font-semibold text-[#0F2F28] ring-1 ring-[#E8E0D4] transition hover:border-[#C9A84C] hover:ring-[#C9A84C]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-bold text-[#0F2F28]">سوالات متداول</h2>
            <dl className="mt-6 space-y-4">
              {FAQ.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl bg-white/70 p-5 ring-1 ring-[#E8E0D4]"
                >
                  <dt className="font-bold text-[#0F2F28]">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-7 text-[#4B5563]">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14 rounded-3xl bg-[#0F2F28] px-6 py-8 text-[#F6F1E8]">
            <p className="text-sm leading-7 text-white/80">
              برای هماهنگی بازدید یا ثبت سفارش عمده با دفتر پخش مشهد تماس بگیرید.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex rounded-full bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#0F2F28]"
              >
                تماس با فروش
              </Link>
              <Link
                href="/category/women-manto"
                className="inline-flex rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold"
              >
                مانتو عمده
              </Link>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
