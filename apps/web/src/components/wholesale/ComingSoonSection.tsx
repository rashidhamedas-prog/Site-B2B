import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { channelSaleDisplay, toman } from '@/lib/product-display';

interface Product {
  id: string;
  slug?: string;
  name: string;
  fabric?: string;
  wholesalePrice: number;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  status: string;
  isDiscounted?: boolean;
  isNew?: boolean;
  images?: string[];
}

async function fetchComingSoon(): Promise<Product[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/products/coming-soon?limit=8&channel=WHOLESALE`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.data ?? []);
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
      </svg>
    </div>
  );
}

export async function ComingSoonSection({
  eyebrow = 'پیش‌خرید ویژه',
  headline = 'به‌زودی در ترنم',
  body = 'مدل‌های جدید در راه است — پیش‌خرید کنید و جزء اولین بوتیک‌هایی باشید که این مدل‌ها را دریافت می‌کنند',
  callout = 'فرصت محدود برای عمده‌فروشان: با پیش‌خرید محصولات «به‌زودی»، اولویت تأمین و ارسال پس از عرضه را دارید. همین حالا به سبد اضافه کنید و جای خود را رزرو کنید.',
  ctaLabel = 'کاتالوگ کامل',
  ctaHref = '/products',
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  callout?: string;
  ctaLabel?: string;
  ctaHref?: string;
} = {}) {
  const products = await fetchComingSoon();
  if (products.length === 0) return null;

  return (
    <section className="section bg-surface-muted">
      <div className="container-site">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            {eyebrow ? (
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-secondary-dark">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
            ) : null}
            {headline ? <h2 className="section-title mb-2">{headline}</h2> : null}
            {body ? <p className="section-subtitle mb-0 max-w-xl">{body}</p> : null}
          </div>
          {ctaLabel && ctaHref ? (
            <Link href={ctaHref} className="hidden flex-shrink-0 cursor-pointer sm:block">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4 rtl-flip" />}>
                {ctaLabel}
              </Button>
            </Link>
          ) : null}
        </div>

        {callout ? (
          <div className="mb-10 border-r-4 border-secondary bg-white px-5 py-5 sm:px-6">
            <p className="text-sm font-medium leading-relaxed text-gray-800 sm:text-base">{callout}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {products.slice(0, 8).map((product) => {
            const { price, compareAt, discount, active: saleActive } = channelSaleDisplay(
              product.sale,
              product.wholesalePrice,
            );
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
                      sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
                    />
                  ) : (
                    <ProductPlaceholder />
                  )}
                  <div className="absolute top-3 right-3">
                    <span className="rounded bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white">
                      به زودی
                    </span>
                  </div>
                  {saleActive && (
                    <div className="absolute top-3 left-3">
                      <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                        {discount ? `٪${discount.toLocaleString('fa-IR')} تخفیف` : 'تخفیف‌دار'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/0 transition-colors duration-250 group-hover:bg-primary/5" />
                </div>

                <div className="flex flex-1 flex-col gap-1 pt-3">
                  <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-gray-800">
                    {product.name}
                  </h3>
                  {product.fabric && <p className="text-xs text-gray-400">{product.fabric}</p>}
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <p className="text-[11px] font-medium text-secondary-dark">پیش‌خرید</p>
                    <div className="text-left">
                      <p className="text-sm font-bold text-primary">{price > 0 ? `${toman(price)} ت` : '—'}</p>
                      {saleActive && compareAt > price ? (
                        <p className="text-[11px] text-gray-400 line-through">{toman(compareAt)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
