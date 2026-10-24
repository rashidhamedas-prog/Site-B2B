import { resolvePageBlocks, metadataForCmsPage } from '@/lib/cms/fetch';
import { CmsPageScope } from '@/lib/cms/page-scope';
import type { ContentBlock } from '@/lib/cms/types';
import { SiteBlocksRenderer } from '@/components/cms/SiteBlocksRenderer';
import { SalesPartnershipApply } from '@/components/sales-partners/SalesPartnershipApply';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

const PAGE_KEY = 'salesPartnership';

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', PAGE_KEY, {
    title: 'همکار بازاریاب پوشاک ترنم | معرفی بدون موجودی',
    description:
      'پوشاک ترنم را معرفی کنید؛ موجودی، پرداخت امن و ارسال با ترنم است. ثبت‌نام همکار بازاریاب در پنل اختصاصی — بدون انبار و بدون دریافت پول از مشتری.',
    canonical: `${RETAIL_ORIGIN}/sales-partnership`,
    ogImage: `${RETAIL_ORIGIN}/sales-partner/hero-banner.webp`,
    ogAlt: 'همکار بازاریاب پوشاک ترنم — معرفی محصول بدون موجودی و ارسال با برند',
  });
}

function faqEntities(blocks: ContentBlock[]): Array<{ question: string; answer: string }> {
  const faq = blocks.find((block) => block.type === 'faq');
  const items = faq?.props.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const question = (item as { question?: unknown }).question;
    const answer = (item as { answer?: unknown }).answer;
    if (typeof question !== 'string' || typeof answer !== 'string') return [];
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) return [];
    return [{ question: q, answer: a }];
  });
}

function jsonLd(blocks: ContentBlock[]) {
  const pageUrl = `${RETAIL_ORIGIN}/sales-partnership`;
  const faqs = faqEntities(blocks);
  // HowTo is intentionally omitted: Google no longer shows HowTo rich results.
  const graph: Array<Record<string, unknown>> = [
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: 'همکار بازاریاب پوشاک ترنم | معرفی بدون موجودی',
      description:
        'پوشاک ترنم را معرفی کنید؛ موجودی، پرداخت امن و ارسال با ترنم است. ثبت‌نام همکار بازاریاب بدون انبار و بدون دریافت پول از مشتری.',
      inLanguage: 'fa-IR',
      isPartOf: { '@type': 'WebSite', name: 'پوشاک ترنم', url: RETAIL_ORIGIN },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: `${RETAIL_ORIGIN}/sales-partner/hero-banner.webp`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: RETAIL_ORIGIN },
        { '@type': 'ListItem', position: 2, name: 'همکار بازاریاب', item: pageUrl },
      ],
    },
  ];
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      url: pageUrl,
      inLanguage: 'fa-IR',
      isPartOf: { '@id': `${pageUrl}#webpage` },
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export default async function RetailSalesPartnershipPage() {
  const blocks = await resolvePageBlocks('RETAIL', PAGE_KEY);

  return (
    <CmsPageScope channel="RETAIL" pageKey={PAGE_KEY}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(blocks)) }}
      />
      <SiteBlocksRenderer blocks={blocks} channel="RETAIL" />
      <SalesPartnershipApply />
    </CmsPageScope>
  );
}
