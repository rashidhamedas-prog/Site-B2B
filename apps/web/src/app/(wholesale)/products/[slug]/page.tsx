import type { Metadata } from 'next';
import { ProductDetail } from '@/components/wholesale/ProductDetail';
import { WHOLESALE_ORIGIN } from '@/lib/seo';
import { fetchProductBySlug } from '@/lib/server-api';

interface Props {
  params: Promise<{ slug: string }>;
}

type SeoBag = Record<string, string | undefined>;

function wholesaleSeo(product: Record<string, unknown> | null, slug: string) {
  const seo = (product?.seoMeta ?? {}) as SeoBag;
  const title =
    seo.wholesaleTitle || seo.title || (product?.name as string) || slug.replace(/-/g, ' ');
  const description =
    seo.wholesaleDescription ||
    seo.description ||
    (typeof product?.description === 'string' ? product.description.slice(0, 160) : '') ||
    `مشخصات، رنگ‌بندی و حداقل سفارش عمده «${title}» مستقیم از تولیدی ترنم مشهد.`;
  const canonical =
    seo.wholesaleCanonical || seo.canonical || `${WHOLESALE_ORIGIN}/products/${slug}`;
  return { title, description, canonical };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug, 'WHOLESALE');
  const { title, description, canonical } = wholesaleSeo(product, slug);
  const image = (product?.images as string[] | undefined)?.[0];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'fa_IR',
      images: image
        ? [{ url: image, alt: title }]
        : [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : ['/og-wholesale.jpg'],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
