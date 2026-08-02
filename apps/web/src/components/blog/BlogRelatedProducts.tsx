import Link from 'next/link';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface RelatedProduct {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  image?: string | null;
  price?: number | null;
}

export async function BlogRelatedProducts({
  articleId,
  channel,
  tone = 'wholesale',
  productBasePath = '/products',
}: {
  articleId: string;
  channel: 'WHOLESALE' | 'RETAIL';
  tone?: 'wholesale' | 'retail';
  productBasePath?: string;
}) {
  let products: RelatedProduct[] = [];
  try {
    const res = await fetch(
      `${API_URL}/blog/article/${articleId}/related-products?channel=${channel}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const data = await res.json();
      products = Array.isArray(data) ? data : [];
    }
  } catch {
    products = [];
  }

  if (products.length === 0) return null;

  const titleCls = tone === 'retail' ? 'text-stone-900' : 'text-gray-900';
  const cardCls =
    tone === 'retail'
      ? 'rounded-xl border border-stone-200 bg-white p-3 transition hover:shadow-md'
      : 'card p-3 transition-shadow hover:shadow-md';

  return (
    <section className="mt-10">
      <h2 className={`mb-4 text-base font-bold ${titleCls}`}>محصولات مرتبط</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.slice(0, 6).map((p) => {
          const href = p.slug ? `${productBasePath}/${p.slug}` : productBasePath;
          return (
            <Link key={p.id} href={href} className={cardCls}>
              {p.image && (
                <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-gray-50">
                  <Image src={p.image} alt={p.name} fill className="object-cover" sizes="200px" />
                </div>
              )}
              <p className="text-xs font-bold leading-snug">{p.name}</p>
              {p.sku && <p className="mt-1 font-mono text-[10px] text-gray-400">{p.sku}</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
