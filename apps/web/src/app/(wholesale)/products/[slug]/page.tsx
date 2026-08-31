import type { Metadata } from 'next';
import { ProductDetail, type WholesaleProduct } from '@/components/wholesale/ProductDetail';
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { WHOLESALE_ORIGIN } from '@/lib/seo';
import { getServerApiBase } from '@/lib/server-api';
import { loadCanonicalStorefrontProduct } from '@/lib/load-canonical-storefront-product';
import { resolvePublicProductCanonical } from '@/lib/public-product-path';
import { getProductCanonicalPath } from '@/lib/canonical-urls';

interface Props {
  params: Promise<{ slug: string }>;
}

type SeoBag = Record<string, string | undefined>;

function wholesaleSeo(product: Record<string, unknown>) {
  const seo = (product.seoMeta ?? {}) as SeoBag;
  const title =
    seo.wholesaleTitle || seo.title || (product.name as string) || 'محصول';
  const description =
    seo.wholesaleDescription ||
    seo.description ||
    (typeof product.description === 'string' ? product.description.slice(0, 160) : '') ||
    `مشخصات، رنگ‌بندی و حداقل سفارش عمده «${title}» مستقیم از تولیدی ترنم مشهد.`;
  const resolved = resolvePublicProductCanonical({
    productSlug: String(product.slug || ''),
    customCanonical: seo.wholesaleCanonical || seo.canonical || null,
    origin: WHOLESALE_ORIGIN,
    onInvalid: (reason) => {
      console.warn('[publicProductPath:wholesale]', product.slug, reason);
    },
  });
  return { title, description, canonical: resolved.url };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadCanonicalStorefrontProduct(slug, 'WHOLESALE');
  const { title, description, canonical } = wholesaleSeo(product);
  const image = (product.images as string[] | undefined)?.[0];

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
  const product = await loadCanonicalStorefrontProduct(slug, 'WHOLESALE');
  const canonicalSlug = String(product.slug || '');

  const url = `${WHOLESALE_ORIGIN}${getProductCanonicalPath(canonicalSlug)}`;
  const variants =
    (product.variants as Array<{ color?: string; stock?: number; wholesaleStock?: number }>) ?? [];
  const totalStock =
    typeof product.wholesaleStock === 'number'
      ? Number(product.wholesaleStock)
      : variants.reduce((sum, v) => sum + (Number(v.wholesaleStock) || 0), 0);
  const isComingSoon = product.status === 'COMING_SOON';
  const fabricLabel =
    (product.fabric as string | undefined) ||
    ((product.specs as { fabricType?: string } | undefined)?.fabricType);
  const related = await loadWholesaleRelated(product);

  return (
    <>
      <ProductJsonLd
        channel="WHOLESALE"
        name={String(product.name ?? '')}
        description={
          (product.fullContent as string | undefined) ||
          (product.wholesaleFullContent as string | undefined) ||
          (product.description as string | undefined) ||
          fabricLabel
        }
        image={(product.images as string[] | undefined)?.[0]}
        sku={product.sku as string | undefined}
        includePrice={false}
        availability={totalStock > 0 ? 'InStock' : isComingSoon ? 'PreOrder' : 'OutOfStock'}
        fabric={fabricLabel}
        color={variants.find((v) => v.color)?.color}
        moq={Number(product.minOrderQty ?? 0) || undefined}
        url={url}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: 'محصولات', url: `${WHOLESALE_ORIGIN}/products` },
          { name: String(product.name ?? ''), url },
        ]}
      />
      <ProductDetail
        slug={canonicalSlug || slug}
        initialProduct={product as unknown as WholesaleProduct}
      />
      {related.length > 0 ? (
        <section className="container-site pb-16">
          <h2 className="text-xl font-extrabold text-gray-900">محصولات مرتبط</h2>
          <p className="mt-1 text-sm text-gray-500">مدل‌های پیشنهادی برای تکمیل خرید عمده</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((item) => {
              const href = getProductCanonicalPath(String(item.slug || item.id));
              return (
                <li key={item.id}>
                  <a href={href} className="block rounded-lg border border-[color:var(--color-border)] p-3 hover:border-[var(--brand-gold,#C9A84C)]">
                    <span className="line-clamp-2 text-sm font-bold text-gray-900">{item.name}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}

type RelatedItem = { id: string; name: string; slug?: string };

async function loadWholesaleRelated(product: Record<string, unknown>): Promise<RelatedItem[]> {
  const curated = Array.isArray(product.relatedProducts)
    ? (product.relatedProducts as RelatedItem[]).filter((p) => p?.id && p?.name)
    : [];
  if (curated.length) return curated.slice(0, 12);
  try {
    const res = await fetch(
      `${getServerApiBase()}/products?relatedTo=${encodeURIComponent(String(product.id))}&limit=4&channel=WHOLESALE`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: RelatedItem[] } | RelatedItem[];
    return (Array.isArray(json) ? json : json.data ?? []).filter((p) => p?.id && p?.name);
  } catch {
    return [];
  }
}
