import type { SalesChannel } from '@/lib/channel';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo-origins';

/** Matches BUSINESS_FACTS.foundedGregorianYear — keep in sync. */
const FOUNDED_GREGORIAN_YEAR = 2015;

export type PublicBusinessSettings = {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  telegram?: string;
  address?: string;
  officeAddress?: string;
  postalCode?: string;
  logoUrl?: string;
  logoAlt?: string;
  descriptionWholesale?: string;
  descriptionRetail?: string;
  sameAs?: string[];
};

export type PublicSeoChannel = {
  defaultTitle?: string;
  defaultDescription?: string;
  ogImageUrl?: string;
  ogImageAlt?: string;
};

export type PublicSeoSettings = {
  wholesale?: PublicSeoChannel;
  retail?: PublicSeoChannel;
};

export type PublicPaymentFlags = {
  retailCashEnabled?: boolean;
  wholesaleCashEnabled?: boolean;
};

const FALLBACK_ADDRESS = {
  '@type': 'PostalAddress' as const,
  streetAddress: 'میدان 17 شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳',
  addressLocality: 'مشهد',
  addressRegion: 'خراسان رضوی',
  addressCountry: 'IR',
  postalCode: '',
};

const FALLBACK_SAME_AS = [
  'https://www.instagram.com/tolidi.taranom',
  'https://t.me/toliditaranom',
];

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

function absoluteAsset(origin: string, raw?: string): string {
  const value = String(raw ?? '').trim();
  if (!value) return `${origin}/logo-128.png`;
  if (value.startsWith('https://')) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return `${origin}${value}`;
  return `${origin}/logo-128.png`;
}

function telSchema(phone?: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+98-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return '+98-915-242-4624';
}

function socialUrl(raw: string | undefined, kind: 'instagram' | 'telegram'): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('https://')) return value;
  if (kind === 'instagram') {
    const handle = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '');
    return handle ? `https://www.instagram.com/${handle}` : '';
  }
  const handle = value.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
  return handle ? `https://t.me/${handle}` : '';
}

function sameAsFrom(business?: PublicBusinessSettings): string[] {
  const extras = Array.isArray(business?.sameAs) ? business!.sameAs! : [];
  const derived = [
    socialUrl(business?.instagram, 'instagram'),
    socialUrl(business?.telegram, 'telegram'),
    ...extras,
  ].filter((u) => u.startsWith('https://'));
  const unique = Array.from(new Set(derived));
  return unique.length ? unique : FALLBACK_SAME_AS;
}

function addressFrom(business?: PublicBusinessSettings) {
  const line = String(business?.officeAddress || business?.address || '').trim();
  if (!line) return FALLBACK_ADDRESS;
  return {
    ...FALLBACK_ADDRESS,
    streetAddress: line,
    postalCode: String(business?.postalCode || '').trim(),
  };
}

export function paymentAcceptedFor(
  channel: SalesChannel,
  payment?: PublicPaymentFlags,
): string {
  if (channel === 'RETAIL') {
    return payment?.retailCashEnabled
      ? 'Credit Card, Cash on Delivery'
      : 'Credit Card';
  }
  return payment?.wholesaleCashEnabled
    ? 'Cash, Bank Transfer'
    : 'Bank Transfer';
}

export function buildOrganizationJsonLd(input: {
  channel: SalesChannel;
  business?: PublicBusinessSettings;
  seo?: PublicSeoSettings;
  payment?: PublicPaymentFlags;
}): Record<string, unknown> {
  const channel = input.channel;
  const origin = channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
  const seo = channel === 'RETAIL' ? input.seo?.retail : input.seo?.wholesale;
  const name =
    channel === 'RETAIL'
      ? (input.business?.businessName ? `فروشگاه ${input.business.businessName}` : 'فروشگاه پوشاک ترنم')
      : (input.business?.businessName || 'پوشاک ترنم');
  const description =
    (channel === 'RETAIL'
      ? input.business?.descriptionRetail || seo?.defaultDescription
      : input.business?.descriptionWholesale || seo?.defaultDescription) ||
    (channel === 'RETAIL'
      ? 'خرید تکی مانتو و شومیز زنانه مستقیم از تولیدی ترنم در مشهد. ارسال به سراسر ایران، پرداخت امن و امکان تعویض سایز.'
      : 'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. از دوخت تا ارسال را خودمان انجام می‌دهیم و عمده می‌فروشیم به بوتیک‌ها در سراسر ایران.');
  const logo = absoluteAsset(origin, input.business?.logoUrl);
  const image = absoluteAsset(origin, seo?.ogImageUrl || (channel === 'RETAIL' ? '/og-retail.jpg' : '/og-wholesale.jpg'));
  const logoAlt = input.business?.logoAlt?.trim() || `لوگوی ${name}`;
  const ogAlt = seo?.ogImageAlt?.trim() || name;

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': channel === 'RETAIL' ? 'OnlineStore' : 'ClothingStore',
    '@id': organizationId(channel),
    name,
    alternateName: channel === 'RETAIL' ? 'Taranom Shop' : 'Taranom Clothing',
    url: origin,
    logo: { '@type': 'ImageObject', url: logo, name: logoAlt, caption: logoAlt },
    image: { '@type': 'ImageObject', url: image, name: ogAlt, caption: ogAlt },
    description,
    telephone: telSchema(input.business?.phone),
    email: input.business?.email || (channel === 'RETAIL' ? 'rashidhamedas@gmail.com' : 'info@poshaktaranom.com'),
    address: addressFrom(input.business),
    sameAs: sameAsFrom(input.business),
    currenciesAccepted: 'IRR',
    paymentAccepted: paymentAcceptedFor(channel, input.payment),
  };

  if (channel === 'RETAIL') {
    base.parentOrganization = {
      '@id': organizationId('WHOLESALE'),
      '@type': 'Organization',
      name: input.business?.businessName || 'پوشاک ترنم',
      url: WHOLESALE_ORIGIN,
    };
    return base;
  }

  return {
    ...base,
    foundingDate: String(FOUNDED_GREGORIAN_YEAR),
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
    priceRange: '$$',
    knowsAbout: ['مانتو لینن', 'فروش عمده مانتو', 'شومیزی زنانه', 'تولیدی پوشاک مشهد'],
  };
}

export function buildWebSiteJsonLd(input: {
  channel: SalesChannel;
  business?: PublicBusinessSettings;
  seo?: PublicSeoSettings;
}): Record<string, unknown> {
  const channel = input.channel;
  const origin = channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
  const seo = channel === 'RETAIL' ? input.seo?.retail : input.seo?.wholesale;
  const name =
    seo?.defaultTitle?.split('|')[0]?.trim() ||
    (channel === 'RETAIL'
      ? (input.business?.businessName ? `فروشگاه ${input.business.businessName}` : 'فروشگاه پوشاک ترنم')
      : (input.business?.businessName || 'پوشاک ترنم'));
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(channel),
    name,
    url: origin,
    inLanguage: 'fa-IR',
    publisher: { '@id': organizationId(channel) },
  };
}

export function layoutSeoFromSettings(input: {
  channel: SalesChannel;
  business?: PublicBusinessSettings;
  seo?: PublicSeoSettings;
}): { title: string; description: string; ogImage: string; ogAlt: string; siteName: string } {
  const channel = input.channel;
  const seo = channel === 'RETAIL' ? input.seo?.retail : input.seo?.wholesale;
  const fallback = channel === 'RETAIL'
    ? {
        title: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
        description:
          'مانتو و شومیز را تکی، مستقیم از تولیدی ترنم در مشهد بخرید. ارسال سریع، پرداخت امن و امکان تعویض سایز.',
        ogImage: '/og-retail.jpg',
        ogAlt: 'فروشگاه پوشاک ترنم',
        siteName: 'فروشگاه پوشاک ترنم',
      }
    : {
        title: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
        description: 'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها در سراسر ایران.',
        ogImage: '/og-wholesale.jpg',
        ogAlt: 'پوشاک ترنم — تولیدی مانتو زنانه مشهد',
        siteName: 'پوشاک ترنم',
      };
  const channelDescription =
    channel === 'RETAIL'
      ? input.business?.descriptionRetail
      : input.business?.descriptionWholesale;
  return {
    title: seo?.defaultTitle?.trim() || fallback.title,
    description: seo?.defaultDescription?.trim() || channelDescription?.trim() || fallback.description,
    ogImage: seo?.ogImageUrl?.trim() || fallback.ogImage,
    ogAlt: seo?.ogImageAlt?.trim() || fallback.ogAlt,
    siteName:
      channel === 'RETAIL'
        ? (input.business?.businessName ? `فروشگاه ${input.business.businessName}` : fallback.siteName)
        : (input.business?.businessName || fallback.siteName),
  };
}
