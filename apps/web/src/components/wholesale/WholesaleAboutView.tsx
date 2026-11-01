import Link from 'next/link';
import { BreadcrumbJsonLd, organizationId, websiteId } from '@/components/shared/JsonLd';
import { AboutCollections } from '@/components/wholesale/about/v3/AboutCollections';
import { AboutCtaDialog } from '@/components/wholesale/about/v3/AboutCtaDialog';
import { AboutFabric } from '@/components/wholesale/about/v3/AboutFabric';
import { ABOUT_H1, ABOUT_LEAD, AboutHero } from '@/components/wholesale/about/v3/AboutHero';
import { AboutOrderSteps } from '@/components/wholesale/about/v3/AboutOrderSteps';
import { AboutPlacesCta } from '@/components/wholesale/about/v3/AboutPlacesCta';
import { AboutProcess } from '@/components/wholesale/about/v3/AboutProcess';
import { AboutStorySection } from '@/components/wholesale/about/v3/AboutStorySection';
import { AboutWhy } from '@/components/wholesale/about/v3/AboutWhy';
import '@/components/wholesale/about/v3/about-v3.css';
import { BUSINESS_FACTS } from '@/lib/business-facts';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

const PAGE_URL = `${WHOLESALE_ORIGIN}/about`;

const ABOUT_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      '@id': `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: ABOUT_H1,
      description: ABOUT_LEAD,
      isPartOf: { '@id': websiteId('WHOLESALE') },
      about: { '@id': organizationId('WHOLESALE') },
      inLanguage: 'fa-IR',
    },
    {
      '@type': 'Organization',
      '@id': organizationId('WHOLESALE'),
      name: 'پوشاک ترنم',
      url: `${WHOLESALE_ORIGIN}/`,
      foundingDate: String(BUSINESS_FACTS.foundedGregorianYear),
      founder: { '@id': `${WHOLESALE_ORIGIN}/about/hamed-rashid#person` },
      sameAs: ['https://www.poshaktaranom.ir/'],
    },
  ],
};

/** /about v3: S0 hero … S7 places + CTA. Server-rendered; motion is progressive enhancement. */
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ABOUT_JSON_LD) }}
      />

      <article className="av3" data-about-v3="">
        <nav className="av3-wrap av3-crumbs" aria-label="مسیر صفحه">
          <ol>
            <li>
              <Link href="/">خانه</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">درباره ما</li>
          </ol>
        </nav>
        <AboutHero />
        <AboutStorySection />
        <AboutProcess />
        <AboutFabric />
        <AboutCollections />
        <AboutWhy />
        <AboutOrderSteps />
        <AboutPlacesCta />
        <AboutCtaDialog />
      </article>
    </>
  );
}
