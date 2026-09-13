import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'home', {
    title: 'خرید تکی پوشاک زنانه مشهد',
    description:
      'از کارگاه ترنم در مشهد می‌توانید شومیز، کت، کاپشن و کفتان را تکی بخرید. ارسال از همان تولیدی؛ تعویض سایز از حساب کاربری.',
    canonical: RETAIL_ORIGIN,
    ogImage: '/og-retail.jpg',
    ogAlt: 'پوشاک ترنم — خرید تکی',
  });
}

export default function RetailHomePage() {
  return <CmsPage channel="RETAIL" pageKey="home" />;
}
