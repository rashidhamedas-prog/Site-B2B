import type { SalesChannel } from '@/lib/channel';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo-origins';
import { BUSINESS_FACTS } from '@/lib/business-facts';

const SAME_AS = [
  'https://www.instagram.com/tolidi.taranom',
  'https://t.me/toliditaranom',
];

const ADDRESS = {
  '@type': 'PostalAddress' as const,
  streetAddress: 'میدان 17 شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳',
  addressLocality: 'مشهد',
  addressRegion: 'خراسان رضوی',
  addressCountry: 'IR',
};

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationId(channel: SalesChannel = 'WHOLESALE'): string {
  return channel === 'RETAIL'
    ? `${RETAIL_ORIGIN}/#organization`
    : `${WHOLESALE_ORIGIN}/#organization`;
}

export function websiteId(channel: SalesChannel = 'WHOLESALE'): string {
  return channel === 'RETAIL'
    ? `${RETAIL_ORIGIN}/#website`
    : `${WHOLESALE_ORIGIN}/#website`;
}

export function OrganizationJsonLd({
  channel = 'WHOLESALE',
}: {
  channel?: SalesChannel;
}) {
  if (channel === 'RETAIL') {
    return (
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'OnlineStore',
          '@id': organizationId('RETAIL'),
          name: 'فروشگاه پوشاک ترنم',
          alternateName: 'Taranom Shop',
          url: RETAIL_ORIGIN,
          logo: `${RETAIL_ORIGIN}/logo-128.png`,
          image: `${RETAIL_ORIGIN}/og-retail.jpg`,
          description:
            'خرید تکی مانتو و شومیز زنانه مستقیم از تولیدی ترنم در مشهد. ارسال به سراسر ایران، پرداخت امن و امکان تعویض سایز.',
          telephone: '+98-915-242-4624',
          email: 'rashidhamedas@gmail.com',
          address: ADDRESS,
          sameAs: SAME_AS,
          currenciesAccepted: 'IRR',
          paymentAccepted: 'Credit Card, Cash on Delivery',
          parentOrganization: {
            '@id': organizationId('WHOLESALE'),
            '@type': 'Organization',
            name: 'پوشاک ترنم',
            url: WHOLESALE_ORIGIN,
          },
        }}
      />
    );
  }

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'ClothingStore',
        '@id': organizationId('WHOLESALE'),
        name: 'پوشاک ترنم',
        alternateName: 'Taranom Clothing',
        url: WHOLESALE_ORIGIN,
        logo: `${WHOLESALE_ORIGIN}/logo-128.png`,
        image: `${WHOLESALE_ORIGIN}/og-wholesale.jpg`,
        description:
          'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. از دوخت تا ارسال را خودمان انجام می‌دهیم و عمده می‌فروشیم به بوتیک‌ها در سراسر ایران.',
        foundingDate: String(BUSINESS_FACTS.foundedGregorianYear),
        telephone: '+98-915-242-4624',
        email: 'rashidhamedas@gmail.com',
        address: ADDRESS,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '36.2972',
          longitude: '59.6067',
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            opens: '09:00',
            closes: '18:00',
          },
        ],
        sameAs: SAME_AS,
        priceRange: '$$',
        currenciesAccepted: 'IRR',
        paymentAccepted: 'Cash, Bank Transfer',
        knowsAbout: ['مانتو لینن', 'فروش عمده مانتو', 'شومیزی زنانه', 'تولیدی پوشاک مشهد'],
      }}
    />
  );
}

export function WebSiteJsonLd({ channel = 'WHOLESALE' }: { channel?: SalesChannel }) {
  if (channel === 'RETAIL') {
    return (
      <JsonLdScript
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          '@id': websiteId('RETAIL'),
          name: 'فروشگاه پوشاک ترنم',
          url: RETAIL_ORIGIN,
          inLanguage: 'fa-IR',
          publisher: { '@id': organizationId('RETAIL') },
        }}
      />
    );
  }

  // NOTE: no SearchAction here — Google crawled the literal
  // `?q={search_term_string}` placeholder as a URL (GSC noise), and the
  // sitelinks-searchbox feature it powered is deprecated.
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': websiteId('WHOLESALE'),
        name: 'پوشاک ترنم',
        url: WHOLESALE_ORIGIN,
        inLanguage: 'fa-IR',
        publisher: { '@id': organizationId('WHOLESALE') },
      }}
    />
  );
}

function productOffer({
  url,
  currency,
  price,
  includePrice,
  availability,
  moq,
  channel,
}: {
  url?: string;
  currency: string;
  price?: number;
  includePrice: boolean;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
  moq?: number;
  channel: SalesChannel;
}) {
  const offerUrl =
    url ?? (channel === 'RETAIL' ? `${RETAIL_ORIGIN}/products` : `${WHOLESALE_ORIGIN}/products`);
  const priced = includePrice && typeof price === 'number' && price > 0;
  return {
    '@type': 'Offer',
    url: offerUrl,
    priceCurrency: currency,
    ...(priced ? { price } : {}),
    availability: `https://schema.org/${availability}`,
    itemCondition: 'https://schema.org/NewCondition',
    ...(moq && channel === 'WHOLESALE'
      ? {
          eligibleQuantity: {
            '@type': 'QuantitativeValue',
            minValue: moq,
            unitCode: 'C62',
          },
        }
      : {}),
    seller: { '@id': organizationId(channel) },
  };
}

export function ProductJsonLd({
  name,
  description,
  image,
  sku,
  price,
  includePrice,
  currency = 'IRR',
  availability = 'InStock',
  fabric,
  color,
  moq,
  url,
  channel = 'WHOLESALE',
}: {
  name: string;
  description?: string;
  image?: string;
  sku?: string;
  price?: number;
  /** Wholesale: omit unless the visitor can see the price. Default false on wholesale. */
  includePrice?: boolean;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  fabric?: string;
  color?: string;
  moq?: number;
  url?: string;
  channel?: SalesChannel;
}) {
  const fallbackImage =
    channel === 'RETAIL' ? `${RETAIL_ORIGIN}/og-retail.jpg` : `${WHOLESALE_ORIGIN}/og-wholesale.jpg`;
  const emitPrice = includePrice ?? channel !== 'WHOLESALE';

  const additionalProperty = [
    fabric ? { '@type': 'PropertyValue', name: 'جنس پارچه', value: fabric } : null,
    color ? { '@type': 'PropertyValue', name: 'رنگ', value: color } : null,
    moq && channel === 'WHOLESALE'
      ? { '@type': 'PropertyValue', name: 'حداقل سفارش', value: String(moq) }
      : null,
  ].filter(Boolean);

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        ...(url ? { '@id': `${url}#product` } : {}),
        name,
        description,
        image: image ?? fallbackImage,
        sku,
        brand: { '@type': 'Brand', name: 'پوشاک ترنم' },
        itemCondition: 'https://schema.org/NewCondition',
        ...(additionalProperty.length ? { additionalProperty } : {}),
        ...(fabric || color ? { material: fabric, color } : {}),
        offers: productOffer({
          url,
          currency,
          price,
          includePrice: emitPrice,
          availability,
          moq,
          channel,
        }),
      }}
    />
  );
}

export function ProductGroupJsonLd({
  name,
  description,
  image,
  url,
  sku,
  price,
  includePrice = true,
  currency = 'IRR',
  availability = 'InStock',
  variants,
  channel = 'RETAIL',
}: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  sku?: string;
  price?: number;
  includePrice?: boolean;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  variants: Array<{ color?: string; size?: string; sku?: string }>;
  channel?: SalesChannel;
}) {
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const variesBy = [
    colors.length > 1 ? 'https://schema.org/color' : null,
    sizes.length > 1 ? 'https://schema.org/size' : null,
  ].filter(Boolean);
  if (!variesBy.length) return null;

  const offer = productOffer({
    url,
    currency,
    price,
    includePrice,
    availability,
    channel,
  });

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        '@id': `${url}#productgroup`,
        name,
        description,
        image,
        url,
        sku,
        brand: { '@type': 'Brand', name: 'پوشاک ترنم' },
        variesBy,
        hasVariant: variants.map((v) => ({
          '@type': 'Product',
          name: [name, v.color, v.size].filter(Boolean).join(' — '),
          ...(v.sku ? { sku: v.sku } : {}),
          ...(v.color ? { color: v.color } : {}),
          ...(v.size ? { size: v.size } : {}),
          brand: { '@type': 'Brand', name: 'پوشاک ترنم' },
          offers: offer,
        })),
      }}
    />
  );
}

export function CollectionPageJsonLd({
  name,
  description,
  url,
  items,
}: {
  name: string;
  description?: string;
  url: string;
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        url,
        name,
        description,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: item.url,
            name: item.name,
          })),
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName = 'پوشاک ترنم',
}: {
  title: string;
  description?: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description,
        url,
        image: image ?? `${WHOLESALE_ORIGIN}/og-wholesale.jpg`,
        datePublished,
        dateModified: dateModified ?? datePublished,
        author: { '@type': 'Organization', name: authorName },
        publisher: {
          '@type': 'Organization',
          name: 'پوشاک ترنم',
          logo: {
            '@type': 'ImageObject',
            url: `${WHOLESALE_ORIGIN}/logo-128.png`,
          },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: 'fa-IR',
      }}
    />
  );
}

export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }}
    />
  );
}
