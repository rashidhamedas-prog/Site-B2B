import { resolvePageBlocks, metadataForCmsPage } from '@/lib/cms/fetch';
import { CmsPageScope } from '@/lib/cms/page-scope';
import { SiteBlocksRenderer } from '@/components/cms/SiteBlocksRenderer';
import { SalesPartnershipApply } from '@/components/sales-partners/SalesPartnershipApply';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

const PAGE_KEY = 'salesPartnership';

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', PAGE_KEY, {
    title: 'همکار بازاریاب پوشاک ترنم | معرفی بدون موجودی',
    description:
      'پوشاک ترنم را معرفی کنید؛ موجودی، پرداخت و ارسال با ترنم است. ثبت‌نام همکار بازاریاب در پنل اختصاصی — بدون انبار و بدون دریافت پول از مشتری.',
    canonical: `${RETAIL_ORIGIN}/sales-partnership`,
  });
}

function jsonLd() {
  const pageUrl = `${RETAIL_ORIGIN}/sales-partnership`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'همکار بازاریاب پوشاک ترنم',
        description:
          'معرفی محصول پوشاک ترنم بدون موجودی و بدون دریافت پول از مشتری؛ پورسانت پس از تحویل طبق قوانین برنامه.',
        inLanguage: 'fa-IR',
        isPartOf: { '@type': 'WebSite', name: 'پوشاک ترنم', url: RETAIL_ORIGIN },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: RETAIL_ORIGIN },
          { '@type': 'ListItem', position: 2, name: 'همکار بازاریاب', item: pageUrl },
        ],
      },
    ],
  };
}

export default async function RetailSalesPartnershipPage() {
  const blocks = await resolvePageBlocks('RETAIL', PAGE_KEY);

  return (
    <CmsPageScope channel="RETAIL" pageKey={PAGE_KEY}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />
      <SiteBlocksRenderer blocks={blocks} channel="RETAIL" />
      <SalesPartnershipApply />
    </CmsPageScope>
  );
}
