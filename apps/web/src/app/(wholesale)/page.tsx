import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'home', {
    title: 'تولیدی مانتو مشهد | خرید عمده',
    description:
      'اگر بوتیک دارید، مانتو و شومیز را مستقیم از کارگاه ترنم در مشهد سفارش دهید. حداقل سفارش هر مدل از ۶ عدد است؛ بعد از تأیید حساب، قیمت همکاری باز می‌شود.',
    canonical: WHOLESALE_ORIGIN,
    ogImage: '/og-wholesale.jpg',
    ogAlt: 'تولیدی مانتو مشهد — پوشاک ترنم',
  });
}

export default function HomePage() {
  return <CmsPage channel="WHOLESALE" pageKey="home" />;
}
