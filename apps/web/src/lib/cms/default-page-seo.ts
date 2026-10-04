import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '../seo-origins';
import { emptyCmsPageSeo, type CmsPageSeo } from './page-seo';

/**
 * Built-in per-page SEO defaults for admin «پیش‌فرض این صفحه» / first save.
 * Keep copy honest: no invented commission % or income claims (SEO-GEO + program residual).
 */
export function getDefaultPageSeo(
  channel: 'RETAIL' | 'WHOLESALE',
  pageKey: string,
): CmsPageSeo {
  if (channel === 'RETAIL' && pageKey === 'salesPartnership') {
    return {
      title: 'همکار بازاریاب پوشاک ترنم | معرفی بدون موجودی',
      description:
        'پوشاک ترنم را معرفی کنید؛ موجودی، پرداخت امن و ارسال با ترنم است. ثبت‌نام همکار بازاریاب در پنل اختصاصی — بدون انبار و بدون دریافت پول از مشتری.',
      ogImage: `${RETAIL_ORIGIN}/sales-partner/hero-banner.webp`,
      ogAlt: 'همکار بازاریاب پوشاک ترنم — معرفی محصول بدون موجودی و ارسال با برند',
      canonical: `${RETAIL_ORIGIN}/sales-partnership`,
      robots: 'index',
    };
  }

  if (channel === 'WHOLESALE' && pageKey === 'hamkarMoarefi') {
    return {
      title: 'همکار معرفی بوتیک',
      description:
        'بوتیک پوشاک مناسب را به پوشاک ترنم معرفی کنید. تیم فروش صلاحیت را بررسی می‌کند و بوتیک بعد از تأیید، خودش عمده می‌خرد. شما قیمت، سفارش، پول و ارسال را بر عهده نمی‌گیرید.',
      ogImage: '',
      ogAlt: '',
      canonical: `${WHOLESALE_ORIGIN}/hamkar-moarefi`,
      robots: 'index',
    };
  }

  return emptyCmsPageSeo();
}

export function getDefaultPageTitle(channel: 'RETAIL' | 'WHOLESALE', pageKey: string, fallbackLabel: string): string {
  if (channel === 'RETAIL' && pageKey === 'salesPartnership') {
    return 'همکار بازاریاب پوشاک ترنم';
  }
  if (channel === 'WHOLESALE' && pageKey === 'hamkarMoarefi') {
    return 'همکار معرفی بوتیک';
  }
  return fallbackLabel;
}
