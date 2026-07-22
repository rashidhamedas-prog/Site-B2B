export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    name: 'پوشاک ترنم',
    alternateName: 'Taranom Clothing',
    url: 'https://poshaktaranom.com',
    logo: 'https://poshaktaranom.com/logo.svg',
    image: 'https://poshaktaranom.com/og-image.jpg',
    description:
      'تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد با بیش از ۱۴ سال تجربه. تولید ۰ تا ۱۰۰ داخل کارگاه و فروش عمده به سراسر ایران.',
    foundingDate: '2011',
    telephone: '+98-915-242-4624',
    email: 'rashidhamedas@gmail.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'میدان 17 شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳',
      addressLocality: 'مشهد',
      addressRegion: 'خراسان رضوی',
      addressCountry: 'IR',
    },
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
    sameAs: [
      'https://www.instagram.com/tolidi.taranom',
      'https://t.me/toliditaranom',
    ],
    priceRange: '$$',
    currenciesAccepted: 'IRR',
    paymentAccepted: 'Cash, Bank Transfer',
    knowsAbout: ['لینن', 'مانتو عمده', 'شومیزی عمده', 'تولیدی پوشاک مشهد'],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
}) {
  const additionalProperty = [
    fabric ? { '@type': 'PropertyValue', name: 'جنس پارچه', value: fabric } : null,
    color ? { '@type': 'PropertyValue', name: 'رنگ', value: color } : null,
    moq ? { '@type': 'PropertyValue', name: 'حداقل سفارش', value: String(moq) } : null,
  ].filter(Boolean);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: image ?? 'https://poshaktaranom.com/og-image.jpg',
    sku,
    brand: {
      '@type': 'Brand',
      name: 'پوشاک ترنم',
    },
    ...(additionalProperty.length ? { additionalProperty } : {}),
    ...(fabric || color
      ? {
          material: fabric,
          color,
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url: url ?? 'https://poshaktaranom.com/products',
      priceCurrency: currency,
      price,
      availability: `https://schema.org/${availability}`,
      eligibleQuantity: moq
        ? { '@type': 'QuantitativeValue', minValue: moq, unitCode: 'C62' }
        : undefined,
      seller: {
        '@type': 'Organization',
        name: 'پوشاک ترنم',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
