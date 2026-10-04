import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteBlocksRenderer } from '@/components/cms/SiteBlocksRenderer';
import { metadataForCmsPage, resolvePageBlocks } from '@/lib/cms/fetch';
import { websiteId } from '@/lib/organization-from-settings';
import { API_URL, WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 300;

const PAGE_KEY = 'hamkarMoarefi';
const PAGE_PATH = '/hamkar-moarefi';
const PAGE_URL = `${WHOLESALE_ORIGIN}${PAGE_PATH}`;
const PAGE_TITLE = 'همکار معرفی بوتیک';
const PAGE_DESCRIPTION =
  'بوتیک پوشاک مناسب را به پوشاک ترنم معرفی کنید. تیم فروش صلاحیت را بررسی می‌کند و بوتیک بعد از تأیید، خودش عمده می‌خرد. شما قیمت، سفارش، پول و ارسال را بر عهده نمی‌گیرید.';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-green,#1B5C4A)]';

type PublicReferral = {
  applyOpen?: boolean;
  termsFinal?: boolean;
  termsVersion?: string;
  termsBody?: string;
  eligibilityNote?: string | null;
  freshnessNote?: string;
};

export async function generateMetadata(): Promise<Metadata> {
  return metadataForCmsPage('WHOLESALE', PAGE_KEY, {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    canonical: PAGE_URL,
  });
}

function pageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        inLanguage: 'fa-IR',
        isPartOf: { '@id': websiteId('WHOLESALE') },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${PAGE_URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: WHOLESALE_ORIGIN },
          { '@type': 'ListItem', position: 2, name: PAGE_TITLE, item: PAGE_URL },
        ],
      },
    ],
  };
}

async function publicReferral(): Promise<PublicReferral> {
  try {
    const response = await fetch(`${API_URL}/boutique-referral/public-settings`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return {};
    return (await response.json()) as PublicReferral;
  } catch {
    return {};
  }
}

export default async function BoutiqueReferralLandingPage() {
  const [settings, blocks] = await Promise.all([
    publicReferral(),
    resolvePageBlocks('WHOLESALE', PAGE_KEY),
  ]);
  const applyOpen = settings.applyOpen === true;
  const termsBody = settings.termsFinal && settings.termsBody?.trim() ? settings.termsBody.trim() : '';
  const eligibility = settings.eligibilityNote?.trim() || '';
  const story = blocks.filter((block) => block.type !== 'process' && block.type !== 'cta');
  const process = blocks.filter((block) => block.type === 'process');
  const ctas = blocks.filter((block) => block.type === 'cta');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd()) }} />
      <section className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-site py-10 lg:py-14">
          <nav aria-label="مسیر" className="text-sm text-gray-500">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className={focus}>خانه</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">همکار معرفی بوتیک</li>
            </ol>
          </nav>
          <p className="mt-6 text-sm font-semibold text-primary">برنامهٔ همکار معرفی بوتیک — فروش عمدهٔ پوشاک ترنم</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl">
            بوتیک‌های مناسب ترنم را معرفی کنید؛ نتیجهٔ هر معرفی را ببینید.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-gray-600">
            شما بوتیک را معرفی می‌کنید. تیم فروش ترنم صلاحیت را بررسی می‌کند، با بوتیک حرف می‌زند و حساب عمده را تأیید می‌کند.
            بعد از تأیید، بوتیک مستقیم از ترنم خرید می‌کند.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="#terms" className={`inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white ${focus}`}>
              شرایط همکاری و پاداش را ببینید
            </a>
            <a href="#example" className={`inline-flex min-h-11 items-center justify-center rounded-full border border-primary px-5 text-sm font-bold text-primary ${focus}`}>
              یک مسیر نمونهٔ معرفی را ببینید
            </a>
            <Link href="/hamkar-moarefi/apply" className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold underline ${focus}`}>
              درخواست همکاری
            </Link>
          </div>
          {applyOpen ? null : (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500">
              پذیرش درخواست هنوز باز نیست. همین دکمه وضعیت فعلی را نشان می‌دهد و بعد از تأیید قواعد، فرم ثبت‌نام همان‌جا باز می‌شود.
            </p>
          )}
        </div>
      </section>

      <SiteBlocksRenderer blocks={story} channel="WHOLESALE" />

      <div id="example" className="scroll-mt-32">
        <SiteBlocksRenderer blocks={process} channel="WHOLESALE" />
      </div>

      <section id="terms" className="scroll-mt-32 border-t border-[color:var(--color-border)] bg-white py-16">
        <div className="container-site max-w-3xl space-y-4 leading-8 text-gray-700">
          <h2 id="terms-title" className="text-2xl font-extrabold tracking-tight text-gray-900">شرایط همکاری و پاداش</h2>
          {termsBody ? (
            <>
              {settings.termsVersion ? <p className="text-sm text-gray-500">نسخهٔ شرایط: {settings.termsVersion}</p> : null}
              <div className="whitespace-pre-line">{termsBody}</div>
            </>
          ) : (
            <p>
              مبلغ یا درصد پاداش، سقف، مهلت مالکیت معرفی، دورهٔ نگهداری، حداقل پرداخت و زمان واریز هنوز توسط مالک برنامه تأیید و منتشر نشده است.
              تا انتشار همین متن، این عددها اعلام نمی‌شوند.
            </p>
          )}
          <p>پاداش اولیه، اگر قواعد برنامه تأیید شده باشد، فقط برای اولین سفارش عمدهٔ واجد شرایط همان بوتیک است. ساخت سفارش به‌تنهایی پاداش را آزاد نمی‌کند.</p>
          <p>حمل و مالیات در پایهٔ پاداش محاسبه نمی‌شود. تخفیف کالا، لغو جزئی، بازپرداخت و مرجوعی از مبلغ واجد شرایط کم می‌شود.</p>
          <p>پاداش سفارش‌های بعدی و سطح پیشرفتهٔ توسعهٔ بازار در این نسخه فعال نیست.</p>
          <p>{settings.freshnessNote || 'به‌روزرسانی‌ها بعد از ثبت توسط تیم فروش دیده می‌شوند و لحظه‌ای نیستند.'}</p>
          <h2 className="pt-4 text-2xl font-extrabold tracking-tight text-gray-900">چه بوتیکی مناسب است</h2>
          {eligibility ? (
            <p className="whitespace-pre-line">{eligibility}</p>
          ) : (
            <p>معیار دقیق بوتیک بعد از تأیید مالک برنامه همین‌جا منتشر می‌شود. تا آن زمان، معرفی را برای بوتیک پوشاک واقعی بفرستید که خودش خریدار عمده باشد، نه برای مشتری نهایی.</p>
          )}
          <p>
            شرایط خرید بوتیک در <Link href="/wholesale" className={`underline ${focus}`}>صفحهٔ شرایط عمده</Link> است.
            معرفی کارگاه در <Link href="/about" className={`underline ${focus}`}>دربارهٔ پوشاک ترنم</Link> آمده
            و راه حرف زدن با فروش در <Link href="/contact" className={`underline ${focus}`}>تماس با ما</Link> است.
          </p>
        </div>
      </section>

      <SiteBlocksRenderer blocks={ctas} channel="WHOLESALE" />
    </>
  );
}
