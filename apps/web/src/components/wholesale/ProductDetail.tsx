'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Phone, Share2, ChevronLeft, Truck, RotateCcw, Shield } from 'lucide-react';
import { Button, Badge, Alert } from '@/components/ui';
import { ProductImage } from '@/components/ui/ProductImage';
import { apiClient } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { cn } from '@/lib/cn';

interface Variant { id: string; color: string; colorHex?: string; size: string; stock: number; sku?: string; }
interface Product {
  id: string;
  name: string;
  slug: string;
  fabric?: string;
  description?: string;
  wholesalePrice: number;
  minOrderQty: number;
  sku?: string;
  images: string[];
  variants: Variant[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SizeGuide() {
  const sizes = [
    { size: '38', chest: '88', waist: '70', hip: '94', length: '90' },
    { size: '40', chest: '92', waist: '74', hip: '98', length: '91' },
    { size: '42', chest: '96', waist: '78', hip: '102', length: '92' },
    { size: '44', chest: '100', waist: '82', hip: '106', length: '93' },
    { size: '46', chest: '104', waist: '86', hip: '110', length: '94' },
    { size: '48', chest: '108', waist: '90', hip: '114', length: '95' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          {['سایز', 'دور سینه', 'دور کمر', 'دور باسن', 'طول'].map((h) => (
            <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-gray-500">{h} (cm)</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {sizes.map((row) => (
            <tr key={row.size} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-bold text-primary">{row.size}</td>
              <td className="py-2 px-3 text-gray-600">{row.chest}</td>
              <td className="py-2 px-3 text-gray-600">{row.waist}</td>
              <td className="py-2 px-3 text-gray-600">{row.hip}</td>
              <td className="py-2 px-3 text-gray-600">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function fetchProduct(slugOrId: string): Promise<Product> {
  if (UUID_RE.test(slugOrId)) {
    return apiClient.get<Product>(`/products/${slugOrId}`);
  }
  return apiClient.get<Product>(`/products/slug/${slugOrId}`);
}

export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { addItem, count } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    fetchProduct(slug)
      .then((p) => {
        setProduct(p);
        if (p.variants.length > 0) setSelectedColor(p.variants[0].color);
        setQuantity(p.minOrderQty || 1);
      })
      .catch(() => router.push('/products'))
      .finally(() => setLoading(false));
  }, [slug, router]);

  const colors = product ? [...new Map(product.variants.map((v) => [v.color, v])).values()] : [];
  const sizesForColor = product ? [...new Set(product.variants.filter((v) => v.color === selectedColor).map((v) => v.size))] : [];
  const selectedVariant = product?.variants.find((v) => v.color === selectedColor && v.size === selectedSize);
  const minOrder = product?.minOrderQty ?? 1;
  const availableStock = selectedVariant?.stock ?? 0;
  const canOrder = !!selectedVariant && availableStock >= minOrder;
  const maxQty = selectedVariant ? Math.max(availableStock, minOrder) : minOrder;

  const handleAddToCart = () => {
    if (!selectedSize || !selectedVariant || !product || !canOrder) return;
    if (quantity > availableStock) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? selectedVariant.sku ?? '',
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      size: selectedVariant.size,
      unitPrice: Number(product.wholesalePrice),
      quantity,
      imageUrl: product.images?.[0],
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-site py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="skeleton aspect-[3/4] rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton h-10 rounded w-3/4" />
            <div className="skeleton h-24 rounded" />
            <div className="skeleton h-20 rounded" />
            <div className="skeleton h-12 rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  if (!product) return null;

  const totalPrice = Math.round(Number(product.wholesalePrice) / 10 * quantity);
  const mainImage = product.images?.[activeImage];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="container-site py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-primary">خانه</Link>
            <ChevronLeft className="h-3 w-3 rtl-flip" />
            <Link href="/products" className="hover:text-primary">محصولات</Link>
            <ChevronLeft className="h-3 w-3 rtl-flip" />
            <span className="text-gray-900 font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container-site py-8">
        <div className="grid gap-8 lg:grid-cols-2 xl:gap-12">
          {/* Image gallery */}
          <div className="space-y-3 max-w-full overflow-hidden">
            <div className="relative aspect-[3/4] w-full max-h-[70vh] rounded-2xl overflow-hidden bg-gradient-to-b from-primary-50 to-primary-100 shadow-card">
              <ProductImage
                src={mainImage}
                alt={product.name}
                priority
                sizes="(max-width:1024px) 100vw, 50vw"
              />
              <button type="button" className="absolute top-3 left-3 z-10 rounded-xl bg-white/90 backdrop-blur-sm p-2 shadow-sm hover:bg-white transition-colors">
                <Share2 className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            {product.images?.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      'relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 transition-colors',
                      activeImage === i ? 'border-primary' : 'border-transparent hover:border-primary-200',
                    )}
                  >
                    <ProductImage src={img} alt="" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-6 min-w-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                {product.fabric && <Badge variant="neutral">{product.fabric}</Badge>}
                {product.sku && <span className="text-sm text-gray-400">کد: {product.sku}</span>}
              </div>
            </div>

            <div className="rounded-2xl bg-primary-50 border border-primary-100 p-4">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-gray-500 mb-1">قیمت عمده (هر عدد)</p>
                  <p className="text-3xl font-extrabold text-primary">
                    {Math.round(Number(product.wholesalePrice) / 10).toLocaleString('fa-IR')}
                    <span className="text-base font-medium mr-1">تومان</span>
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500 mb-1">حداقل سفارش</p>
                  <p className="text-lg font-bold text-gray-700">{minOrder} عدد</p>
                </div>
              </div>
            </div>

            {colors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">رنگ‌بندی</h3>
                  <span className="text-sm text-gray-500">انتخاب شده: <span className="text-gray-900 font-medium">{selectedColor}</span></span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {colors.map((c) => (
                    <button key={c.color} type="button" onClick={() => { setSelectedColor(c.color); setSelectedSize(''); }}
                      title={c.color}
                      className={cn('h-10 w-10 rounded-full transition-all border-2 flex items-center justify-center',
                        selectedColor === c.color ? 'ring-2 ring-primary ring-offset-2 scale-110 border-transparent' : 'border-gray-200 hover:ring-2 hover:ring-gray-300 hover:ring-offset-1')}
                      style={{ backgroundColor: c.colorHex ?? '#ddd' }}>
                      {!c.colorHex && <span className="text-[8px] font-bold text-gray-600">{c.color.slice(0, 2)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">سایز</h3>
                <button type="button" onClick={() => setShowSizeGuide(!showSizeGuide)} className="text-xs text-primary hover:underline">راهنمای سایز</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(sizesForColor.length > 0 ? sizesForColor : ['38', '40', '42', '44', '46', '48']).map((s) => {
                  const v = product.variants.find((vv) => vv.color === selectedColor && vv.size === s);
                  const outOfStock = v && v.stock === 0;
                  return (
                    <button key={s} type="button" onClick={() => !outOfStock && setSelectedSize(s)}
                      disabled={!!outOfStock}
                      className={cn('h-10 w-12 rounded-xl text-sm font-medium border-2 transition-all',
                        selectedSize === s ? 'bg-primary text-white border-primary scale-105'
                          : outOfStock ? 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
                            : 'border-gray-200 text-gray-700 hover:border-primary hover:text-primary')}>
                      {s}
                    </button>
                  );
                })}
              </div>
              {showSizeGuide && <div className="mt-4 card p-4"><h4 className="text-sm font-bold mb-3">راهنمای سایز‌بندی</h4><SizeGuide /></div>}
              {!selectedSize && <p className="mt-2 text-xs text-amber-600">لطفاً سایز را انتخاب کنید</p>}
              {selectedSize && selectedVariant && availableStock < minOrder && (
                <p className="mt-2 text-xs text-error">موجودی این سایز ({availableStock} عدد) کمتر از حداقل سفارش ({minOrder} عدد) است</p>
              )}
              {selectedSize && selectedVariant && availableStock >= minOrder && (
                <p className="mt-2 text-xs text-gray-500">موجودی: {availableStock} عدد</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">تعداد</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setQuantity(Math.max(minOrder, quantity - 1))}
                    disabled={quantity <= minOrder}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium disabled:opacity-40">−</button>
                  <span className="w-12 text-center font-bold text-gray-900">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    disabled={quantity >= availableStock}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium disabled:opacity-40">+</button>
                </div>
                <span className="text-sm text-gray-500">
                  جمع: <span className="font-bold text-gray-900">{totalPrice.toLocaleString('fa-IR')} تومان</span>
                </span>
              </div>
            </div>

            {addedToCart && (
              <Alert variant="success" dismissible>
                به سبد اضافه شد!{' '}
                <Link href="/checkout" className="font-bold underline">تکمیل سفارش ({count} کالا)</Link>
              </Alert>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button size="lg" variant="primary" fullWidth disabled={!selectedSize || !canOrder} onClick={handleAddToCart}
                rightIcon={<ShoppingCart className="h-5 w-5" />}>
                افزودن به سبد خرید
              </Button>
              <a href="tel:09152424624">
                <Button size="lg" variant="outline" rightIcon={<Phone className="h-5 w-5" />}>تماس</Button>
              </a>
            </div>

            {count > 0 && (
              <Link href="/checkout"
                className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-primary text-primary font-bold py-3 hover:bg-primary hover:text-white transition-colors">
                <ShoppingCart className="h-5 w-5" />مشاهده سبد خرید ({count} کالا)
              </Link>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
              {[
                { icon: <Truck className="h-4 w-4" />, label: 'ارسال چاپار' },
                { icon: <RotateCcw className="h-4 w-4" />, label: 'مرجوعی ۷ روزه' },
                { icon: <Shield className="h-4 w-4" />, label: 'ضمانت کیفیت' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="text-primary">{item.icon}</div>
                  <span className="text-xs text-gray-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {product.description && (
          <div className="mt-10 card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">توضیحات محصول</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
