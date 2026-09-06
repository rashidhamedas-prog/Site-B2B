import Link from 'next/link';
import { getServerApiBase, slimRetailCatalogProduct } from '@/lib/server-api';
import { BoutiqueProductCard } from './BoutiqueProductCard';
import type { RetailCardProduct } from '@/components/retail/RetailProductCard';

const HOME_PRODUCT_CAP = 12;
const HOME_SALE_CAP = 6;

async function fetchRetailProducts(limit: number): Promise<RetailCardProduct[]> {
  try {
    const base = getServerApiBase();
    const res = await fetch(
      `${base}/products?limit=${Math.min(limit, HOME_PRODUCT_CAP)}&status=ACTIVE&channel=RETAIL&sort=newest`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.data ?? [];
    return (list as Record<string, unknown>[]).map((row) => slimRetailCatalogProduct(row)) as RetailCardProduct[];
  } catch {
    return [];
  }
}

function isOnSale(p: RetailCardProduct) {
  if (p.sale?.active) return true;
  const price = Number(p.sale?.payable ?? p.retailPrice ?? 0);
  const compare = Number(p.retailCompareAtPrice ?? 0);
  return compare > price && price > 0;
}

export async function BoutiqueSaleRail() {
  const all = await fetchRetailProducts(HOME_PRODUCT_CAP);
  const products = all.filter(isOnSale).slice(0, HOME_SALE_CAP);
  if (products.length === 0) return null;

  return (
    <section className="bq-container py-6" aria-label="محصولات تخفیف‌دار">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#121716] px-4 py-3">
        <div className="text-right">
          <h2 className="text-lg font-extrabold text-white">شگفت‌انگیزها</h2>
          <p className="text-xs text-white/60">فقط مدل‌هایی که الان تخفیف واقعی دارند</p>
        </div>
        <Link
          href="/products"
          className="inline-flex min-h-10 items-center rounded-lg bg-[#1b5c4a] px-4 text-sm font-bold text-white"
        >
          مشاهده همه
        </Link>
      </div>
      <ul className="bq-rail">
        {products.map((p) => (
          <li key={p.id} className="bq-card-product">
            <BoutiqueProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function BoutiqueProductRail({
  title = 'جدیدترین‌های ترنم',
  limit = 12,
}: {
  title?: string;
  limit?: number;
}) {
  const products = (await fetchRetailProducts(Math.min(limit, HOME_PRODUCT_CAP - HOME_SALE_CAP))).slice(
    0,
    HOME_PRODUCT_CAP - HOME_SALE_CAP,
  );

  return (
    <section className="bq-container py-6">
      <div className="overflow-hidden rounded-3xl bg-white p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold text-neutral-900">{title}</h2>
          <Link href="/products" className="text-sm font-bold text-[#1b5c4a]">
            مشاهده همه
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">هنوز محصولی برای نمایش نیست.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <BoutiqueProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
