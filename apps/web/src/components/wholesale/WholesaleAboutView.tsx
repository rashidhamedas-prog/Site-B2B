import Link from 'next/link';
import { toPersianDigits } from '@taranom/persian-utils';
import { BreadcrumbJsonLd, organizationId, websiteId } from '@/components/shared/JsonLd';
import { AboutExperience } from '@/components/wholesale/about/AboutExperience';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

const PAGE_URL = `${WHOLESALE_ORIGIN}/about`;
const H1 = 'از دل پارچه، برای ویترین‌های ماندگار';
const SUBTITLE =
  'ترنم همراه فروشندگان پوشاک است؛ از انتخاب پارچه در کارگاه مشهد تا رسیدن مدل به ویترین بوتیک.';

const VALUES = [
  {
    title: 'کیفیت پایدار',
    body: 'انتخاب پارچه، برش، دوخت و کنترل کیفیت داخل کارگاه خودمان انجام می‌شود. فروشنده عمده، مدل را از مبدأ تولید می‌گیرد نه از چند واسطه.',
  },
  {
    title: 'تأمین منظم',
    body: 'دفتر پخش در مشهد سفارش را از کارگاه جدا می‌کند تا آماده‌سازی و ارسال قابل پیگیری باشد. هدف، رسیدن به‌موقع مدل به ویترین است.',
  },
  {
    title: 'طراحی فروش‌پذیر',
    body: 'تخصص ترنم مانتو و پوشاک زنانه اسپرت با لینن و کتان است. رنگ‌بندی و سایزبندی برای استفاده روزمره و نشستن روی مانکن بوتیک شکل می‌گیرد.',
  },
  {
    title: 'همکاری بلندمدت با فروشندگان',
    body: 'ثبت‌نام عمده، انتخاب مدل، سفارش و پشتیبانی فروش در یک مسیر است. بازدید از کارگاه یا دفتر پخش با هماهنگی تیم فروش انجام می‌شود.',
  },
] as const;

const STEPS = [
  {
    title: 'انتخاب محصولات',
    body: 'کاتالوگ عمده را ببینید و مدل‌های فصل را با رنگ و سایز مناسب ویترین انتخاب کنید.',
  },
  {
    title: 'ثبت سفارش عمده',
    body: 'پس از ثبت‌نام و تأیید، سفارش را ثبت کنید. حداقل سفارش در محصول از ۶ عدد به بالاست.',
  },
  {
    title: 'آماده‌سازی',
    body: 'سفارش در کارگاه و دفتر پخش آماده می‌شود؛ کنترل نهایی پیش از خروج از مشهد انجام می‌گیرد.',
  },
  {
    title: 'ارسال',
    body: 'ارسال سفارش عمده به سراسر ایران از دفتر پخش پاساژ کیمیا پیگیری می‌شود.',
  },
] as const;

const FACTS = [
  {
    value: toPersianDigits(BUSINESS_FACTS.foundedSolarYear),
    label: 'سال آغاز کار در مشهد',
  },
  {
    value: yearsOfOperationFa(),
    label: 'سال فعالیت تولیدی',
  },
  {
    value: toPersianDigits(BUSINESS_FACTS.teamSize),
    label: 'نفر در خط تولید',
  },
] as const;

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
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <nav className="text-xs text-[#6B7280]" aria-label="مسیر صفحه">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/" className="underline-offset-4 hover:text-[#1B5C4A] hover:underline">
                  خانه
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-[#0F2F28]">درباره ما</li>
            </ol>
          </nav>
        </div>

        <AboutExperience />

        <section className="border-t border-[#E8E0D4] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
            <header>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#A88530]">ارزش‌های ترنم</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-snug text-[#0F2F28]">
                آنچه برای بوتیک قابل اتکاست
              </h2>
              <p className="mt-4 max-w-md text-sm leading-8 text-[#4B5563] sm:text-base">
                این‌ها شعار تبلیغاتی نیستند؛ همان کارهایی‌اند که از کارگاه تا دفتر پخش تکرار می‌شوند.
              </p>
            </header>
            <ol className="divide-y divide-[#E8E0D4] border-y border-[#E8E0D4]">
              {VALUES.map((item, index) => (
                <li key={item.title} className="grid gap-3 py-7 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-8">
                  <span className="font-mono text-sm font-bold tracking-widest text-[#C9A84C]">
                    {toPersianDigits(index + 1).padStart(2, '۰')}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-[#0F2F28]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-8 text-[#4B5563] sm:text-base">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#0F2F28] px-4 py-16 text-[#F6F1E8] sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#C9A84C]">فرآیند همکاری</p>
            <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-snug">از انتخاب مدل تا رسیدن به فروشگاه</h2>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-white/70 sm:text-base">
              مسیر عمده را کوتاه و قابل فهم نگه داشته‌ایم تا فروشنده بداند بعد از هر قدم چه می‌شود.
            </p>
            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative border-t border-white/15 pt-6">
                  <span className="font-mono text-2xl font-extrabold text-[#C9A84C]">
                    {toPersianDigits(index + 1).padStart(2, '۰')}
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/65">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#A88530]">آنچه قابل بیان است</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#0F2F28]">رد پای واقعی ترنم</h2>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-[#4B5563] sm:text-base">
              فقط اعدادی را می‌نویسیم که در سابقه برند ثبت شده‌اند. ظرفیت تولید یا تعداد مشتری تأییدنشده
              را نمایش نمی‌دهیم.
            </p>
            <dl className="mt-12 grid gap-8 border-y border-[#E8E0D4] py-10 sm:grid-cols-3">
              {FACTS.map((fact) => (
                <div key={fact.label} className="sm:border-l sm:border-[#E8E0D4] sm:pr-0 sm:first:border-l-0">
                  <dt className="text-sm text-[#6B7280]">{fact.label}</dt>
                  <dd className="mt-2 text-4xl font-extrabold tracking-tight text-[#1B5C4A]">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-8 space-y-3 text-sm leading-8 text-[#4B5563] sm:text-base">
              <li>تولید مستقیم در مشهد؛ انتخاب پارچه، برش و دوخت داخل مجموعه.</li>
              <li>فروش عمده بدون واسطه از دفتر پخش محدوده ۱۷ شهریور، پاساژ کیمیا.</li>
              <li>ارسال سفارش عمده به سراسر ایران.</li>
            </ul>
          </div>
        </section>

        <section className="border-t border-[#E8E0D4] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
            <div>
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
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F2F28]">فروش عمده</h2>
              <p className="mt-4 text-sm leading-8 text-[#4B5563] sm:text-base">
                دفتر پخش عمده در محدوده میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳ قرار دارد.
                بوتیک‌ها می‌توانند مدل‌ها را ببینند، سفارش ثبت کنند و ارسال را از همین نقطه پیگیری کنند.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl bg-[#0F2F28] px-6 py-12 text-[#F6F1E8] sm:px-12 sm:py-16">
            <h2 className="max-w-xl text-3xl font-extrabold leading-snug sm:text-4xl">
              برای ساختن یک ویترین ماندگار آماده‌اید؟
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-8 text-white/70 sm:text-base">
              کاتالوگ لینن و مانتو را ببینید یا برای شروع همکاری عمده ثبت‌نام کنید.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex rounded-lg bg-[#C9A84C] px-6 py-3 text-sm font-bold text-[#0F2F28] transition hover:bg-[#E5C97C]"
              >
                محصولات عمده
              </Link>
              <Link
                href="/portal/register"
                className="inline-flex rounded-lg border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:border-[#C9A84C]"
              >
                ثبت‌نام و شروع همکاری
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl border-t border-[#E8E0D4] pt-10">
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
                rel="noopener noreferrer"
                target="_blank"
              >
                @toliditaranom
              </a>
            </address>
          </div>
        </section>
      </article>
    </>
  );
}
