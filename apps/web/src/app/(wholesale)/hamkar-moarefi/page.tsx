import type { Metadata } from 'next';
import Link from 'next/link';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { websiteId } from '@/lib/organization-from-settings';
import { API_URL, WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 300;

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
  return metadataForCmsPage('WHOLESALE', 'hamkarMoarefi', {
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
        mainEntityOfPage: PAGE_URL,
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
  const settings = await publicReferral();
  const applyOpen = settings.applyOpen === true;
  const termsBody = settings.termsFinal && settings.termsBody?.trim() ? settings.termsBody.trim() : '';
  const eligibility = settings.eligibilityNote?.trim() || '';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-[var(--brand-ink,#1c1917)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd()) }} />
      <nav aria-label="مسیر" className="text-sm text-[var(--brand-muted,#57534e)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className={focus}>
              خانه
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{PAGE_TITLE}</li>
        </ol>
      </nav>
      <p className="mt-4 text-sm text-[var(--brand-muted,#57534e)]">برنامهٔ همکار معرفی بوتیک — فروش عمدهٔ پوشاک ترنم</p>
      <h1 className="mt-3 text-2xl font-semibold leading-10 sm:text-3xl">
        بوتیک‌های مناسب ترنم را معرفی کنید؛ نتیجهٔ هر معرفی را ببینید.
      </h1>
      <p className="mt-4 text-base leading-8">
        این صفحه برای صاحب بوتیک یا کسی است که بوتیک پوشاک دیگری را به پوشاک ترنم معرفی می‌کند. شما معرفی می‌کنید.
        تیم فروش ترنم صلاحیت را بررسی می‌کند، با بوتیک حرف می‌زند و حساب عمده را تأیید می‌کند. بعد از تأیید، بوتیک مستقیم از ترنم خرید می‌کند.
        شما قیمت تعیین نمی‌کنید، سفارش را نمی‌بندید، پول را نمی‌گیرید و کالا را ارسال نمی‌کنید.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href="#terms" className={`inline-flex min-h-11 items-center justify-center rounded-full bg-[#1B5C4A] px-5 text-sm text-white ${focus}`}>
          شرایط همکاری و پاداش را ببینید
        </a>
        <a href="#example" className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#1B5C4A] px-5 text-sm text-[#1B5C4A] ${focus}`}>
          یک مسیر نمونهٔ معرفی را ببینید
        </a>
        {applyOpen ? (
          <Link href="/hamkar-moarefi/apply" className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm underline ${focus}`}>
            درخواست همکاری
          </Link>
        ) : null}
      </div>

      <section className="mt-10 space-y-3 leading-8" aria-labelledby="value-title">
        <h2 id="value-title" className="text-xl font-semibold">از همان روز اول چه چیزی دستتان است</h2>
        <ul className="list-disc pe-5">
          <li>یک لینک دعوت مشخص، بعد از تأیید همکاری.</li>
          <li>متن دعوت و راهنمایی که ترنم تأیید کرده باشد.</li>
          <li>وضعیت هر معرفی، دلیل قابل‌گفتن برای تأخیر یا رد، و اقدام بعدی.</li>
          <li>پشتیبانی انسانی اگر معرفی یا پاداش نیاز به بررسی داشته باشد.</li>
        </ul>
        <p>{settings.freshnessNote || 'به‌روزرسانی‌ها بعد از ثبت توسط تیم فروش دیده می‌شوند و لحظه‌ای نیستند.'}</p>
      </section>

      <section id="terms" className="mt-10 scroll-mt-28 space-y-3 leading-8" aria-labelledby="terms-title">
        <h2 id="terms-title" className="text-xl font-semibold">شرایط همکاری و پاداش</h2>
        {termsBody ? (
          <>
            {settings.termsVersion ? <p className="text-sm text-[var(--brand-muted,#57534e)]">نسخهٔ شرایط: {settings.termsVersion}</p> : null}
            <div className="whitespace-pre-line">{termsBody}</div>
          </>
        ) : (
          <p>
            مبلغ یا درصد پاداش، سقف، مهلت مالکیت معرفی، دورهٔ نگهداری، حداقل پرداخت و زمان واریز هنوز توسط مالک برنامه تأیید و منتشر نشده است.
            تا انتشار همین متن، این عددها اعلام نمی‌شوند و درخواست همکاری روی این صفحه باز نمی‌ماند.
          </p>
        )}
        <p>پاداش اولیه، اگر قواعد برنامه تأیید شده باشد، فقط برای اولین سفارش عمدهٔ واجد شرایط همان بوتیک است. ساخت سفارش به‌تنهایی پاداش را آزاد نمی‌کند.</p>
        <p>حمل و مالیات در پایهٔ پاداش محاسبه نمی‌شود. تخفیف کالا، لغو جزئی، بازپرداخت و مرجوعی از مبلغ واجد شرایط کم می‌شود.</p>
        <p>پاداش سفارش‌های بعدی و سطح پیشرفتهٔ توسعهٔ بازار در این نسخه فعال نیست.</p>
        <p>
          این برنامه جدا از خرید عمدهٔ خود بوتیک است. شرایط خرید در{' '}
          <Link href="/wholesale" className={`underline ${focus}`}>
            صفحهٔ شرایط عمده
          </Link>{' '}
          است. معرفی پوشاک ترنم و کارگاه در{' '}
          <Link href="/about" className={`underline ${focus}`}>
            دربارهٔ پوشاک ترنم
          </Link>{' '}
          آمده و راه تماس با فروش در{' '}
          <Link href="/contact" className={`underline ${focus}`}>
            تماس با ما
          </Link>{' '}
          است.
        </p>
      </section>

      <section className="mt-10 space-y-3 leading-8" aria-labelledby="fit-title">
        <h2 id="fit-title" className="text-xl font-semibold">چه بوتیکی مناسب است</h2>
        {eligibility ? (
          <p className="whitespace-pre-line">{eligibility}</p>
        ) : (
          <p>معیار دقیق بوتیک بعد از تأیید مالک برنامه همین‌جا منتشر می‌شود. تا آن زمان، معرفی را برای بوتیک پوشاک واقعی بفرستید که خودش خریدار عمده باشد، نه برای مشتری نهایی.</p>
        )}
      </section>

      <section id="example" className="mt-10 scroll-mt-28 space-y-3 leading-8" aria-labelledby="example-title">
        <h2 id="example-title" className="text-xl font-semibold">نمونهٔ مسیر یک معرفی</h2>
        <p className="rounded-2xl bg-[#F6F1E8] px-4 py-3 text-sm">این فهرست فقط نمایش مسیر است و وضعیت یک معرفی واقعی، درآمد یا ظرفیت همکاری نیست.</p>
        <ol className="list-decimal pe-5">
          <li>ثبت معرفی</li>
          <li>بررسی و پیگیری فروش</li>
          <li>تأیید حساب عمدهٔ بوتیک</li>
          <li>اولین سفارش پرداخت‌شده</li>
          <li>پاداش برآوردی، سپس نگهداری، سپس قابل پرداخت</li>
        </ol>
      </section>
    </main>
  );
}
