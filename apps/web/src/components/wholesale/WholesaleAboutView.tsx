import Link from 'next/link';
import { toPersianDigits } from '@taranom/persian-utils';
import { BreadcrumbJsonLd, organizationId, websiteId } from '@/components/shared/JsonLd';
import { BUSINESS_FACTS } from '@/lib/business-facts';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

const PAGE_URL = `${WHOLESALE_ORIGIN}/about`;
const H1 = 'درباره تولیدی پوشاک ترنم';
const SUBTITLE =
  'تولید مانتو و پوشاک زنانه اسپرت در مشهد؛ از انتخاب پارچه و برش تا دوخت، کنترل کیفیت و فروش مستقیم.';

const WHY = [
  'تولید مستقیم در مشهد؛ انتخاب پارچه، برش و دوخت داخل مجموعه خودمان انجام می‌شود.',
  'تخصص در مانتو و پوشاک زنانه اسپرت با پارچه‌های لینن و کتان.',
  'کنترل کیفیت قبل از بسته‌بندی و ارسال به بوتیک.',
  'فروش عمده بدون واسطه از دفتر پخش محدوده ۱۷ شهریور، پاساژ کیمیا.',
  'رنگ‌بندی و سایزبندی مناسب ویترین فروشگاه.',
  'حداقل سفارش در محصول از 6 عدد به بالا می باشد.',
  'ارسال سفارش عمده به سراسر ایران.',
];

export function WholesaleAboutView() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: 'درباره ما', url: PAGE_URL },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            '@id': `${PAGE_URL}#webpage`,
            url: PAGE_URL,
            name: H1,
            description: SUBTITLE,
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
              <li className="font-medium text-[#0F2F28]">درباره ما</li>
            </ol>
          </nav>

          <header className="border-b border-[#E8E0D4] pb-12">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-[#C9A84C]">
              تولیدی پوشاک زنانه · مشهد
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-[#0F2F28] sm:text-5xl">
              {H1}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#4B5563] sm:text-lg">
              {SUBTITLE}
            </p>
          </header>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">داستان ما</h2>
            <p className="mt-4 text-sm leading-8 text-[#4B5563] sm:text-base">
              پوشاک ترنم از سال {toPersianDigits(BUSINESS_FACTS.foundedSolarYear)} در مشهد شکل گرفت؛
              حامد رشید مجموعه را از صفر پایه‌گذاری کرد تا تولیدی‌ای بسازد که روی پارچه، برش و دوخت
              قابل اتکا برای بوتیک تمرکز داشته باشد. امروز تیمی {toPersianDigits(BUSINESS_FACTS.teamSize)}{' '}
              نفره مدل‌های اسپرت هر فصل را از کارگاه تا دفتر پخش همراهی می‌کند.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">تخصص ما</h2>
            <p className="mt-4 text-sm leading-8 text-[#4B5563] sm:text-base">
              تخصص ترنم مانتو و پوشاک زنانه اسپرت با پارچه‌های لینن و کتان است. لینن برای روزهای گرم
              سبک و تنفس‌پذیر است؛ کتان فرم ایستاده‌تر و دوام بیشتری برای ویترین بوتیک دارد. مدل‌ها
              برای استفاده روزمره، رنگ‌های فروش‌پذیر و ست شدن با شلوار و دامن طراحی می‌شوند.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">فرآیند تولید</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                'انتخاب و بررسی پارچه',
                'الگو و برش',
                'دوخت صنعتی',
                'کنترل کیفیت',
                'بسته‌بندی',
                'ارسال از دفتر پخش',
              ].map((step, index) => (
                <li
                  key={step}
                  className="rounded-2xl bg-white/70 px-5 py-4 text-sm leading-7 text-[#0F2F28] ring-1 ring-[#E8E0D4]"
                >
                  <span className="ml-2 text-xs font-bold text-[#C9A84C]">
                    {toPersianDigits(index + 1)}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">کارگاه</h2>
            <p className="mt-4 text-sm leading-8 text-[#4B5563] sm:text-base">
              کارگاه تولید در مشهد است: بلوار نبوت، میدان عسگریه، خیابان قائمی، پلاک ۱۳۷. بازدید از
              خط برش و دوخت با هماهنگی تیم فروش انجام می‌شود.
            </p>
            <Link
              href="/workshop"
              className="mt-4 inline-flex text-sm font-semibold text-[#1B5C4A] underline-offset-4 hover:underline"
            >
              نگاه به کارگاه و خط تولید
            </Link>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">فروش عمده</h2>
            <p className="mt-4 text-sm leading-8 text-[#4B5563] sm:text-base">
              دفتر پخش عمده در محدوده میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳ قرار دارد.
              بوتیک‌ها و فروشندگان می‌توانند مدل‌ها را ببینند، سفارش ثبت کنند و ارسال به سراسر ایران
              را از همین نقطه پیگیری کنند.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-[#0F2F28]">چرا ترنم</h2>
            <ul className="mt-6 space-y-3">
              {WHY.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-sm leading-8 text-[#4B5563] sm:text-base"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A84C]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-16 rounded-3xl bg-[#0F2F28] px-6 py-10 text-[#F6F1E8] sm:px-10">
            <h2 className="text-2xl font-bold">همکاری عمده را شروع کنید</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">
              کاتالوگ لینن و مانتو را ببینید یا برای هماهنگی بازدید از دفتر پخش با تیم فروش تماس بگیرید.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/portal/register"
                className="inline-flex rounded-full bg-[#C9A84C] px-6 py-3 text-sm font-bold text-[#0F2F28] transition hover:bg-[#E5C97C]"
              >
                ثبت‌نام عمده‌فروش
              </Link>
              <Link
                href="/products"
                className="inline-flex rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:border-[#C9A84C]"
              >
                کاتالوگ عمده
              </Link>
            </div>
          </section>

          <section className="mt-16 border-t border-[#E8E0D4] pt-10">
            <h2 className="text-2xl font-bold text-[#0F2F28]">تماس محلی</h2>
            <address className="mt-4 not-italic text-sm leading-8 text-[#4B5563] sm:text-base">
              دفتر پخش: مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳
              <br />
              تلفن:{' '}
              <a href="tel:09152424624" className="font-semibold text-[#1B5C4A]">
                ۰۹۱۵۲۴۲۴۶۲۴
              </a>
              <br />
              تلگرام:{' '}
              <a
                href="https://t.me/toliditaranom"
                className="font-semibold text-[#1B5C4A]"
              >
                @toliditaranom
              </a>
            </address>
          </section>
        </div>
      </article>
    </>
  );
}
