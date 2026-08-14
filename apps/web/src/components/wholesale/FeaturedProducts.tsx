import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { getServerApiBase } from '@/lib/server-api';
import { WholesaleProductCard } from './WholesaleProductCard';

interface Product {
  id: string;
  slug?: string;
  sku?: string;
  name: string;
  fabric: string;
  wholesalePrice: number;
  status: string;
  minOrderQty?: number;
  isDiscounted?: boolean;
  isNew?: boolean;
  isLimitedStock?: boolean;
  images?: string[];
  variants?: Array<{ color?: string; colorHex?: string; stock?: number; size?: string }>;
}

async function fetchFeatured(limit = 6): Promise<Product[]> {
  try {
    const apiUrl = getServerApiBase();
    const res = await fetch(
      `${apiUrl}/products?limit=${limit}&status=ACTIVE&channel=WHOLESALE`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function FeaturedProducts({
  eyebrow = 'کاتالوگ فصل',
  headline = 'محصولات برتر',
  body = 'پرفروش‌ترین و جدیدترین مدل‌های فصل',
  ctaLabel = 'همه محصولات',
  ctaHref = '/products',
  viewAllLabel,
  limit = 6,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  viewAllLabel?: string;
  limit?: number;
} = {}) {
  const products = await fetchFeatured(limit);
  const items = products.length > 0 ? products : [];
  if (items.length === 0) return null;
  const linkLabel = viewAllLabel || ctaLabel;

  return (
    <section className="section bg-white">
      <div className="container-site">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            {eyebrow ? (
              <p className="mb-2 text-sm font-semibold tracking-wide text-secondary-dark">{eyebrow}</p>
            ) : null}
            {headline ? <h2 className="section-title mb-2">{headline}</h2> : null}
            {body ? <p className="section-subtitle mb-0">{body}</p> : null}
          </div>
          {linkLabel && ctaHref ? (
            <Link href={ctaHref} className="hidden flex-shrink-0 cursor-pointer sm:block">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4 rtl-flip" />}>
                {linkLabel}
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
          {items.slice(0, limit).map((product) => (
            <WholesaleProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-12 border border-[color:var(--color-border)] bg-surface-muted px-6 py-8 text-center sm:rounded-2xl">
          <p className="mb-4 text-sm font-medium text-gray-700">
            برای مشاهده قیمت‌های عمده و ثبت سفارش آنلاین، ابتدا وارد پنل مشتری شوید
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/portal/login" className="cursor-pointer">
              <Button variant="primary" size="sm">
                ورود به پنل
              </Button>
            </Link>
            <Link href="/portal/register" className="cursor-pointer">
              <Button variant="outline" size="sm">
                ثبت‌نام عمده‌فروش
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
