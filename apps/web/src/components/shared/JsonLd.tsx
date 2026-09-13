import type { SalesChannel } from '@/lib/channel';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo-origins';
import { absoluteJsonLdUrl } from '@/lib/jsonld-url';
import { jsonLdBrandNode } from '@/lib/product-jsonld-brand';
import { jsonLdImageObjects } from '@/lib/product-image-alt';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  organizationId,
  type PublicBusinessSettings,
  type PublicPaymentFlags,
  type PublicSeoSettings,
} from '@/lib/organization-from-settings';

export { absoluteJsonLdUrl } from '@/lib/jsonld-url';
export { organizationId, websiteId } from '@/lib/organization-from-settings';

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
  business,
  seo,
  payment,
}: {
  channel?: SalesChannel;
  business?: PublicBusinessSettings;
  seo?: PublicSeoSettings;
  payment?: PublicPaymentFlags;
}) {
  return (
    <JsonLdScript
      data={buildOrganizationJsonLd({ channel, business, seo, payment })}
    />
  );
}

export function WebSiteJsonLd({
  channel = 'WHOLESALE',
  business,
  seo,
}: {
  channel?: SalesChannel;
  business?: PublicBusinessSettings;
  seo?: PublicSeoSettings;
}) {
  return (
    <JsonLdScript
      data={buildWebSiteJsonLd({ channel, business, seo })}
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
  brandName,
  hideDefaultBrand,
  images,
  imageAlts,
}: {
  name: string;
  description?: string;
  image?: string;
  images?: string[];
  imageAlts?: Record<string, string>;
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
  brandName?: string | null;
  hideDefaultBrand?: boolean;
}) {
  const fallbackImage =
    channel === 'RETAIL' ? `${RETAIL_ORIGIN}/og-retail.jpg` : `${WHOLESALE_ORIGIN}/og-wholesale.jpg`;
  const emitPrice = includePrice ?? channel !== 'WHOLESALE';
  const gallery = (images?.length ? images : image ? [image] : []).filter(Boolean);
  const imageObjects = jsonLdImageObjects(
    gallery,
    imageAlts,
    { name, fabric, color },
    (src) => absoluteJsonLdUrl(channel, src),
  );
  const productImage =
    imageObjects.length > 0
      ? imageObjects
      : absoluteJsonLdUrl(channel, image) ?? fallbackImage;
  const brand = jsonLdBrandNode({ brandName, hideDefaultBrand });

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
        image: productImage,
        sku,
        ...(brand ? { brand } : {}),
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
  brandName,
  hideDefaultBrand,
  images,
  imageAlts,
}: {
  name: string;
  description?: string;
  image?: string;
  images?: string[];
  imageAlts?: Record<string, string>;
  url: string;
  sku?: string;
  price?: number;
  includePrice?: boolean;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  variants: Array<{ color?: string; size?: string; sku?: string }>;
  channel?: SalesChannel;
  brandName?: string | null;
  hideDefaultBrand?: boolean;
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
  const groupImages = jsonLdImageObjects(
    (images?.length ? images : image ? [image] : []).filter(Boolean),
    imageAlts,
    { name },
    (urlValue) => absoluteJsonLdUrl(channel, urlValue),
  );
  const groupImage = groupImages[0]?.url ?? absoluteJsonLdUrl(channel, image);
  const groupId = sku || url;
  const brand = jsonLdBrandNode({ brandName, hideDefaultBrand });

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        '@id': `${url}#productgroup`,
        productGroupID: groupId,
        name,
        description,
        ...(groupImages.length ? { image: groupImages } : groupImage ? { image: groupImage } : {}),
        url,
        sku,
        ...(brand ? { brand } : {}),
        variesBy,
        hasVariant: variants.map((v) => ({
          '@type': 'Product',
          name: [name, v.color, v.size].filter(Boolean).join(' — '),
          ...(v.sku ? { sku: v.sku } : {}),
          ...(v.color ? { color: v.color } : {}),
          ...(v.size ? { size: v.size } : {}),
          ...(description ? { description } : {}),
          ...(groupImage ? { image: groupImage } : {}),
          productGroupID: groupId,
          ...(brand ? { brand } : {}),
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
  const articleChannel: SalesChannel = url.includes('poshaktaranom.ir') ? 'RETAIL' : 'WHOLESALE';
  const fallbackImage =
    articleChannel === 'RETAIL' ? `${RETAIL_ORIGIN}/og-retail.jpg` : `${WHOLESALE_ORIGIN}/og-wholesale.jpg`;
  const articleImage = absoluteJsonLdUrl(articleChannel, image) ?? fallbackImage;
  const publisherLogo =
    articleChannel === 'RETAIL' ? `${RETAIL_ORIGIN}/logo-128.png` : `${WHOLESALE_ORIGIN}/logo-128.png`;
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description,
        url,
        image: articleImage,
        datePublished,
        dateModified: dateModified ?? datePublished,
        author: { '@type': 'Organization', name: authorName },
        publisher: {
          '@type': 'Organization',
          name: 'پوشاک ترنم',
          logo: {
            '@type': 'ImageObject',
            url: publisherLogo,
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
