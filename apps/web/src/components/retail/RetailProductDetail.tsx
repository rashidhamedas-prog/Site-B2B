'use client';

import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { Check, Heart, ShoppingBag } from 'lucide-react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { isInWishlist, toggleWishlist } from '@/lib/retail-wishlist';

type Variant = { id: string; color: string; size: string; stock?: number };
type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku?: string;
  retailPrice?: number | null;
  stock?: number;
  sizeGuide?: string | null;
  modelInfo?: string | null;
  isPreOrder?: boolean;
  images?: string[];
  variants?: Variant[];
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export function RetailProductDetail({ product }: { product: Product }) {
  const addItem = useRetailCart((s) => s.addItem);
  const images = product.images?.length ? product.images : [];
  const [activeImg, setActiveImg] = useState(0);
  const [color, setColor] = useState(product.variants?.[0]?.color ?? '');
  const [size, setSize] = useState(product.variants?.[0]?.size ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [wish, setWish] = useState(false);

  useEffect(() => {
    setWish(isInWishlist(product.id));
  }, [product.id]);

  const colors = useMemo(
    () => [...new Set((product.variants ?? []).map((v) => v.color).filter(Boolean))],
    [product.variants],
  );

  const sizeRows = useMemo(() => {
    const map = new Map<string, { size: string; stock: number }>();
    for (const v of product.variants ?? []) {
      if (color && v.color !== color) continue;
      if (!v.size) continue;
      const prev = map.get(v.size)?.stock ?? 0;
      map.set(v.size, { size: v.size, stock: prev + Number(v.stock ?? 0) });
    }
    return [...map.values()];
  }, [product.variants, color]);

  const selectedVariant = (product.variants ?? []).find((v) => v.color === color && v.size === size);
  const price = Number(product.retailPrice ?? 0);
  const variantStock = selectedVariant ? Number(selectedVariant.stock ?? 0) : Number(product.stock ?? 0);
  const stock = product.variants?.length ? variantStock : Number(product.stock ?? 0);
  const main = mediaUrl(images[activeImg] ?? images[0]);

  const onAdd = () => {
    if (price <= 0 || stock <= 0) return;
    addItem({
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? '',
      unitPrice: price,
      quantity: qty,
      imageUrl: main,
      color,
      size,
      variantId: selectedVariant?.id,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const onWish = () => {
    const next = toggleWishlist({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: main,
      price,
    });
    setWish(next);
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-14">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--retail-bg)]">
          {main ? (
            <Image
              src={main}
              alt={product.name}
              fill
              className="object-cover transition duration-300 hover:scale-105"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
            />
          ) : null}
          {product.isPreOrder ? (
            <span className="absolute right-3 top-3 rounded-full bg-[var(--retail-gold)] px-3 py-1 text-xs font-bold text-white">
              پیش‌فروش
            </span>
          ) : null}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {images.map((img, i) => {
              const u = mediaUrl(img);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`relative h-16 w-14 shrink-0 overflow-hidden rounded-md ring-2 ${
                    i === activeImg ? 'ring-[var(--retail-primary)]' : 'ring-transparent'
                  }`}
                >
                  {u ? <Image src={u} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="56px" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{product.name}</h1>
          <button
            type="button"
            onClick={onWish}
            className="rounded-full border border-[var(--retail-border)] p-2"
            aria-label="علاقه‌مندی"
          >
            <Heart className={`h-5 w-5 ${wish ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>
        <p className="mt-3 text-2xl font-extrabold text-[var(--retail-primary)]">
          {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
        </p>
        <p className="mt-2 text-sm text-[var(--retail-muted)]">
          موجودی: {stock > 0 ? `${stock.toLocaleString('fa-IR')} عدد` : 'ناموجود'}
        </p>

        {colors.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-bold">رنگ</p>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    const first = (product.variants ?? []).find(
                      (v) => v.color === c && Number(v.stock ?? 0) > 0,
                    );
                    if (first?.size) setSize(first.size);
                  }}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${
                    color === c
                      ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)] text-white'
                      : 'border-[var(--retail-border)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {sizeRows.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-bold">سایز</p>
            <div className="flex flex-wrap gap-2">
              {sizeRows.map((row) => {
                const unavailable = row.stock <= 0;
                return (
                  <button
                    key={row.size}
                    type="button"
                    disabled={unavailable}
                    onClick={() => setSize(row.size)}
                    className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                      size === row.size
                        ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)]/10 text-[var(--retail-primary)]'
                        : 'border-[var(--retail-border)]'
                    }`}
                  >
                    {row.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-[var(--retail-border)]">
            <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center text-sm font-bold">{qty.toLocaleString('fa-IR')}</span>
            <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
          <button
            type="button"
            disabled={price <= 0 || stock <= 0}
            onClick={onAdd}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--retail-gold)] py-3.5 text-sm font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {added ? 'به سبد اضافه شد' : 'افزودن به سبد'}
          </button>
        </div>

        {product.modelInfo ? (
          <p className="mt-6 rounded-xl bg-[var(--retail-bg)] px-4 py-3 text-sm text-[var(--retail-muted)]">
            {product.modelInfo}
          </p>
        ) : null}

        {product.sizeGuide ? (
          <details className="mt-4 rounded-xl border border-[var(--retail-border)] px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold">جدول راهنمای سایز</summary>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--retail-muted)]">{product.sizeGuide}</pre>
          </details>
        ) : null}

        {product.description ? (
          <div className="prose prose-sm mt-8 max-w-none text-[var(--retail-muted)]">
            <h2 className="text-base font-bold text-[var(--retail-ink)]">توضیحات</h2>
            <p className="leading-8">{product.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
