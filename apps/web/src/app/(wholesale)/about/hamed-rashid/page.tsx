import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd, organizationId, websiteId } from '@/components/shared/JsonLd';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

const PAGE_PATH = '/about/hamed-rashid';
const PAGE_URL = `${WHOLESALE_ORIGIN}${PAGE_PATH}`;
const H1 = 'حامد رشید، بنیان‌گذار پوشاک ترنم';
const TITLE = 'حامد رشید، بنیان‌گذار پوشاک ترنم | تولیدی مانتو مشهد';
const DESCRIPTION =
  'حامد رشید، بنیان‌گذار و مدیرعامل پوشاک ترنم؛ تولیدی مانتو و پوشاک زنانه در مشهد از ۱۳۹۴. مسیر شروع، نقش او و راه همکاری عمده با ترنم را بخوانید.';

const FAQ = [
  {
    q: 'حامد رشید کیست؟',
    a: 'حامد رشید بنیان‌گذار و مدیرعامل پوشاک ترنم است؛ تولیدی مانتو و پوشاک زنانه در مشهد که از سال ۱۳۹۴ فعالیت می‌کند.',
  },
  {
    q: 'حامد رشید کار را چطور شروع کرد؟',
    a: 'او بدون سابقهٔ قبلی در این کار، از بازاریابی پوشاک شروع کرد. پس از دو شکست سخت ادامه داد و ترنم را از صفر ساخت.',
  },
  {
    q: 'پوشاک ترنم از چه سالی فعالیت می‌کند؟',
    a: 'از سال ۱۳۹۴؛ یعنی بیش از ۱۰ سال فعالیت تولیدی در مشهد.',
  },
  {
    q: 'تفاوت poshaktaranom.com و www.poshaktaranom.ir چیست؟',
    a: 'poshaktaranom.com سایت فروش عمده برای بوتیک‌ها و فروشگاه‌هاست و www.poshaktaranom.ir سایت خرید تکی برای مصرف‌کننده.',
  },
  {
    q: 'چطور خرید عمده از ترنم را شروع کنم؟',
    a: 'از صفحهٔ شرایط همکاری عمده در poshaktaranom.com ثبت‌نام کنید. حداقل سفارش و مراحل ثبت تا ارسال سفارش در همان صفحه آمده است.',
  },
];

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: 'profile',
    locale: 'fa_IR',
  },
};

const PROFILE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfilePage',
      '@id': `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: H1,
      inLanguage: 'fa-IR',
      isPartOf: { '@id': websiteId('WHOLESALE') },
      about: { '@id': `${PAGE_URL}#person` },
      mainEntity: { '@id': `${PAGE_URL}#person` },
    },
    {
      '@type': 'Person',
      '@id': `${PAGE_URL}#person`,
      name: 'حامد رشید',
      url: PAGE_URL,
      jobTitle: 'بنیان‌گذار و مدیرعامل',
      worksFor: { '@id': organizationId('WHOLESALE') },
    },
  ],
};

const P = 'text-sm leading-8 text-[#4B5563] sm:text-base';
const H2 = 'mt-12 text-xl font-bold text-[#0F2F28]';
const A = 'font-semibold text-[#1B5C4A] underline underline-offset-4';

export default function HamedRashidFounderPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: 'درباره ما', url: `${WHOLESALE_ORIGIN}/about` },
          { name: 'حامد رشید', url: PAGE_URL },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PROFILE_JSON_LD) }}
      />
      <article className="bg-[#F6F1E8] text-[#1A1A1A]">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <nav className="mb-10 text-xs text-[#6B7280]" aria-label="مسیر صفحه">
            <ol className="flex flex-wrap items-center gap-1">
              <li><Link href="/" className="hover:text-[#1B5C4A]">خانه</Link></li>
              <li aria-hidden>/</li>
              <li><Link href="/about" className="hover:text-[#1B5C4A]">درباره ما</Link></li>
              <li aria-hidden>/</li>
              <li className="font-medium text-[#0F2F28]">حامد رشید</li>
            </ol>
          </nav>

          <header className="border-b border-[#E8E0D4] pb-10">
            <h1 className="text-4xl font-extrabold leading-tight text-[#0F2F28] sm:text-5xl">{H1}</h1>
            <p className="mt-6 text-base leading-8 text-[#4B5563] sm:text-lg">
              حامد رشید بنیان‌گذار و مدیرعامل پوشاک ترنم است؛ تولیدی مانتو و پوشاک زنانه در مشهد که از
              سال ۱۳۹۴ فعالیت می‌کند. او کار را از بازاریابی پوشاک و بدون سابقهٔ تولید شروع کرد و در
              راه‌اندازی ترنم همهٔ مراحل کار را خودش انجام داد. فروش عمدهٔ ترنم برای بوتیک‌ها و
              فروشگاه‌ها از poshaktaranom.com انجام می‌شود.
            </p>
          </header>

          <h2 className={H2}>مسیر شروع</h2>
          <p className={`mt-4 ${P}`}>
            حامد رشید بی‌آنکه پیش‌تر در این کار سابقه‌ای داشته باشد، از بازاریابی پوشاک شروع کرد. در
            این مسیر دو بار شکست سخت خورد، اما کار را رها نکرد؛ ادامه داد و ترنم را در سال ۱۳۹۴ در
            مشهد راه انداخت.
          </p>

          <h2 className={H2}>نقش و تخصص</h2>
          <p className={`mt-4 ${P}`}>
            حامد رشید بنیان‌گذار و مدیرعامل پوشاک ترنم است. ترنم را از صفر ساخت و در شروع کار، همهٔ
            کارها را خودش انجام می‌داد؛ به همین دلیل با همهٔ مراحل کار آشناست.
          </p>

          <h2 className={H2}>پوشاک ترنم امروز</h2>
          <p className={`mt-4 ${P}`}>
            پوشاک ترنم بیش از ۱۰ سال است که در مشهد مانتو و پوشاک زنانه تولید می‌کند. فروش عمده برای
            بوتیک‌ها و فروشگاه‌ها از <Link href="/" className={A}>poshaktaranom.com</Link> و فروش تکی
            برای مصرف‌کننده از{' '}
            <a href="https://www.poshaktaranom.ir/" className={A}>www.poshaktaranom.ir</a> انجام
            می‌شود. برای آشنایی بیشتر با شرکت، صفحهٔ{' '}
            <Link href="/about" className={A}>دربارهٔ پوشاک ترنم</Link> را ببینید.
          </p>

          <h2 className={H2}>رویکرد ترنم به کیفیت و خدمات</h2>
          <p className={`mt-4 ${P}`}>
            تعهد ترنم این است که کیفیت محصول و خدمات را در هر سفارش در بالاترین سطحی که از عهده‌اش
            برمی‌آید نگه دارد. معیار این تعهد هم بازگشت مشتری است: اینکه بوتیک یا فروشگاهی که یک بار
            از ترنم خرید کرده، برای سفارش بعدی هم برگردد.
          </p>

          <h2 className={H2}>سخن حامد رشید</h2>
          <blockquote className="mt-4 border-r-4 border-[#C9A84C] pr-5">
            <p className="text-lg font-semibold leading-8 text-[#0F2F28]">
              «همیشه هدف ترنم این بود مشتری فقط یک بار خرید نکند.»
            </p>
            <footer className="mt-2 text-sm text-[#6B7280]">
              — حامد رشید، بنیان‌گذار و مدیرعامل پوشاک ترنم
            </footer>
          </blockquote>

          <h2 className={H2}>پرسش‌های پرتکرار</h2>
          <div className="mt-6 space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl bg-white/70 p-5 ring-1 ring-[#E8E0D4]">
                <h3 className="font-bold text-[#0F2F28]">{item.q}</h3>
                <p className="mt-2 text-sm leading-7 text-[#4B5563]">{item.a}</p>
              </div>
            ))}
          </div>

          <section className="mt-14 rounded-3xl bg-[#0F2F28] px-6 py-8 text-[#F6F1E8]">
            <p className="text-sm leading-7 text-white/80">
              <strong>صاحب بوتیک یا فروشگاه هستید؟</strong> حداقل سفارش و مراحل همکاری را ببینید و
              درخواست همکاری عمده ثبت کنید.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/wholesale" className="inline-flex rounded-full bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#0F2F28]">
                ثبت‌نام و شرایط همکاری عمده
              </Link>
              <Link href="/products" className="inline-flex rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold">
                مشاهدهٔ محصولات
              </Link>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
