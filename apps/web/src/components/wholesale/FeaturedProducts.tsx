import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

interface Product {
  id: string;
  slug?: string;
  name: string;
  fabric: string;
  wholesalePrice: number;
  status: string;
  isDiscounted?: boolean;
  isNew?: boolean;
  isLimitedStock?: boolean;
  images?: string[];
}

async function fetchFeatured(): Promise<Product[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/products?limit=6&status=ACTIVE`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

function ProductPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2">
      <svg viewBox="0 0 100 140" className="h-full w-auto opacity-30" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 8 Q50 4 54 4 Q58 4 58 8 L65 16 Q72 18 76 23 L24 23 Q28 18 35 16 Z" fill="currentColor" className="text-primary"/>
        <line x1="50" y1="8" x2="50" y2="16" stroke="currentColor" strokeWidth="1.5" className="text-primary"/>
        <path d="M30 25 L24 38 L22 72 L22 125 L78 125 L78 72 L76 38 L70 25 Z" fill="currentColor" className="text-primary-light" opacity="0.5"/>
        <path d="M38 25 L50 36 L62 25 L50 31 Z" fill="currentColor" className="text-primary" opacity="0.7"/>
        <path d="M30 25 L16 32 L14 62 L24 62 L27 40 Z" fill="currentColor" className="text-primary-light" opacity="0.4"/>
        <path d="M70 25 L84 32 L86 62 L76 62 L73 40 Z" fill="currentColor" className="text-primary-light" opacity="0.4"/>
        <rect x="26" y="82" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-primary" opacity="0.5"/>
        <rect x="60" y="82" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-primary" opacity="0.5"/>
      </svg>
    </div>
  );
}

function ProductBadges({ product }: { product: Product }) {
  const badges: Array<{ label: string; className: string }> = [];
  if (product.isNew) badges.push({ label: 'جدید', className: 'bg-secondary text-white' });
  if (product.isDiscounted) badges.push({ label: 'تخفیف‌دار', className: 'bg-primary text-white' });
  if (product.isLimitedStock) badges.push({ label: 'موجودی محدود', className: 'bg-amber-600 text-white' });
  if (badges.length === 0) return null;
  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
      {badges.map((b) => (
        <span key={b.label} className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export async function FeaturedProducts() {
  const products = await fetchFeatured();
  const items = products.length > 0 ? products : [];
  if (items.length === 0) return null;

  return (
    <section className="section bg-white">
      <div className="container-site">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold tracking-wide text-secondary-dark">کاتالوگ فصل</p>
            <h2 className="section-title mb-2">محصولات برتر</h2>
            <p className="section-subtitle mb-0">پرفروش‌ترین و جدیدترین مدل‌های فصل</p>
          </div>
          <Link href="/products" className="hidden flex-shrink-0 cursor-pointer sm:block">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4 rtl-flip" />}>
              همه محصولات
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
          {items.slice(0, 6).map((product) => {
            const priceInTomans = Math.round(product.wholesalePrice / 10).toLocaleString('fa-IR');
            const imageUrl = product.images?.[0];
            return (
              <Link
                key={product.id}
                href={`/products/${product.slug ?? product.id}`}
                className="product-tile group"
              >
                <div className="product-tile-media">
                  {imageUrl ? (
                    <ProductImage
                      src={imageUrl}
                      alt={product.name}
                      sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 16vw"
                    />
                  ) : (
                    <ProductPlaceholder />
                  )}
                  <ProductBadges product={product} />
                  <div className="absolute inset-0 bg-primary/0 transition-colors duration-250 group-hover:bg-primary/5" />
                </div>

                <div className="flex flex-1 flex-col gap-1 pt-3">
                  <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-gray-800">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-400">{product.fabric}</p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <p className="text-[11px] text-gray-400">عمده</p>
                    <p className="text-sm font-bold text-primary">{priceInTomans} ت</p>
                  </div>
                </div>
              </Link>
            );
          })}
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
