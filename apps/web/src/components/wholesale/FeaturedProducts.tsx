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
  isFeatured: boolean;
  isNew: boolean;
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

const FALLBACK: Product[] = [
  { id: '1', name: 'مانتو شومیزی لینن مدل بهار', fabric: 'لینن', wholesalePrice: 8500000, status: 'ACTIVE', isFeatured: true, isNew: false },
  { id: '2', name: 'مانتو کتان مدل نسیم', fabric: 'کتان', wholesalePrice: 7200000, status: 'ACTIVE', isFeatured: false, isNew: true },
  { id: '3', name: 'مانتو شومیزی اسپرت مدل آفتاب', fabric: 'لینن کتان', wholesalePrice: 9400000, status: 'ACTIVE', isFeatured: true, isNew: false },
  { id: '4', name: 'مانتو لینن مدل پریسا', fabric: 'لینن', wholesalePrice: 7800000, status: 'ACTIVE', isFeatured: false, isNew: false },
  { id: '5', name: 'مانتو کتان مدل شکوفه', fabric: 'کتان', wholesalePrice: 8100000, status: 'ACTIVE', isFeatured: false, isNew: true },
  { id: '6', name: 'مانتو اسپرت مدل رویا', fabric: 'لینن', wholesalePrice: 8600000, status: 'ACTIVE', isFeatured: false, isNew: false },
];

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

export async function FeaturedProducts() {
  const products = await fetchFeatured();
  const items = products.length > 0 ? products : FALLBACK;

  return (
    <section className="section">
      <div className="container-site">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="section-title">محصولات برتر</h2>
            <p className="section-subtitle mb-0">پرفروش‌ترین و جدیدترین مدل‌های فصل</p>
          </div>
          <Link href="/products" className="flex-shrink-0">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4 rtl-flip" />}>
              همه محصولات
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {items.slice(0, 6).map((product) => {
            const priceInTomans = Math.round(product.wholesalePrice / 10).toLocaleString('fa-IR');
            const tag = product.isNew ? 'جدید' : product.isFeatured ? 'پرفروش' : '';
            const imageUrl = product.images?.[0];
            return (
              <Link
                key={product.id}
                href={`/products/${product.slug ?? product.id}`}
                className="group card-hover overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[3/4] bg-gradient-to-b from-primary-50 to-primary-100 overflow-hidden">
                  {imageUrl ? (
                    <ProductImage
                      src={imageUrl}
                      alt={product.name}
                      sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 16vw"
                    />
                  ) : (
                    <ProductPlaceholder />
                  )}
                  {tag && (
                    <div className="absolute top-2 right-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        tag === 'جدید' ? 'bg-secondary text-white' : 'bg-primary text-white'
                      }`}>
                        {tag}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-200" />
                </div>

                <div className="p-3 flex flex-col gap-1 flex-1">
                  <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-400">{product.fabric}</p>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <p className="text-xs text-gray-400">عمده</p>
                    <p className="text-sm font-bold text-primary">{priceInTomans} ت</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-primary-50 border border-primary-100 p-6 text-center">
          <p className="text-sm font-medium text-primary mb-3">
            برای مشاهده قیمت‌های عمده و ثبت سفارش آنلاین، ابتدا وارد پنل مشتری شوید
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/portal/login">
              <Button variant="primary" size="sm">ورود به پنل</Button>
            </Link>
            <Link href="/portal/register">
              <Button variant="outline" size="sm">ثبت‌نام عمده‌فروش</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
