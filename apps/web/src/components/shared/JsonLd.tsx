import type { SalesChannel } from '@/lib/channel';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo';

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
        name: 'پوشاک ترنم',
        alternateName: 'Taranom Clothing',
        url: WHOLESALE_ORIGIN,
        logo: `${WHOLESALE_ORIGIN}/logo-128.png`,
        image: `${WHOLESALE_ORIGIN}/og-wholesale.jpg`,
        description:
          'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. از دوخت تا ارسال را خودمان انجام می‌دهیم و عمده می‌فروشیم به بوتیک‌ها در سراسر ایران.',
        foundingDate: '2011',
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
          name: 'فروشگاه پوشاک ترنم',
          url: RETAIL_ORIGIN,
          inLanguage: 'fa-IR',
          publisher: { '@type': 'Organization', name: 'پوشاک ترنم' },
        }}
      />
    );
  }

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'پوشاک ترنم',
        url: WHOLESALE_ORIGIN,
        inLanguage: 'fa-IR',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${WHOLESALE_ORIGIN}/products?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

export function ProductJsonLd({
  name,
  description,
  image,
  sku,
  price,
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
  price: number;
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
        name,
        description,
        image: image ?? fallbackImage,
        sku,
        brand: { '@type': 'Brand', name: 'پوشاک ترنم' },
        ...(additionalProperty.length ? { additionalProperty } : {}),
        ...(fabric || color ? { material: fabric, color } : {}),
        offers: {
          '@type': 'Offer',
          url:
            url ??
            (channel === 'RETAIL' ? `${RETAIL_ORIGIN}/products` : `${WHOLESALE_ORIGIN}/products`),
          priceCurrency: currency,
          price,
          availability: `https://schema.org/${availability}`,
          ...(moq && channel === 'WHOLESALE'
            ? {
                eligibleQuantity: {
                  '@type': 'QuantitativeValue',
                  minValue: moq,
                  unitCode: 'C62',
                },
              }
            : {}),
          seller: {
            '@type': 'Organization',
            name: channel === 'RETAIL' ? 'فروشگاه پوشاک ترنم' : 'پوشاک ترنم',
          },
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
