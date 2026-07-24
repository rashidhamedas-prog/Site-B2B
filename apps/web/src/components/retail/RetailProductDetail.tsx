'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { Check, Heart, ShoppingBag, X, ZoomIn } from 'lucide-react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { isInWishlist, toggleWishlist } from '@/lib/retail-wishlist';
import { apiClient } from '@/lib/api';

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
  videoUrl?: string | null;
  isPreOrder?: boolean;
  preOrderDate?: string | null;
  images?: string[];
  variants?: Variant[];
  categoryId?: string;
  fabric?: string;
};

type Related = {
  id: string;
  name: string;
  slug: string;
  retailPrice?: number | null;
  images?: string[];
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function parseSizeGuide(raw?: string | null): string[][] {
  if (!raw?.trim()) return [];
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => line.split(/[|\t,،]/).map((c) => c.trim()).filter(Boolean));
}

function PreOrderCountdown({ date }: { date: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(date).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('به‌زودی موجود');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setLabel(`${d.toLocaleString('fa-IR')} روز و ${h.toLocaleString('fa-IR')} ساعت تا عرضه`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [date]);
  return <p className="mt-2 text-sm font-bold text-[var(--retail-gold)]">{label}</p>;
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
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [related, setRelated] = useState<Related[]>([]);

  useEffect(() => {
    setWish(isInWishlist(product.id));
  }, [product.id]);

  useEffect(() => {
    apiClient
      .get<{ data: Related[] }>(`/products?relatedTo=${encodeURIComponent(product.id)}&limit=4`)
      .then((r) => setRelated(r.data ?? []))
      .catch(() => setRelated([]));
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

  const sizeTable = useMemo(() => parseSizeGuide(product.sizeGuide), [product.sizeGuide]);
  const selectedVariant = (product.variants ?? []).find((v) => v.color === color && v.size === size);
  const price = Number(product.retailPrice ?? 0);
  const variantStock = selectedVariant ? Number(selectedVariant.stock ?? 0) : Number(product.stock ?? 0);
  const stock = product.variants?.length ? variantStock : Number(product.stock ?? 0);
  const main = mediaUrl(images[activeImg] ?? images[0]);
  const canBuy = product.isPreOrder || (price > 0 && stock > 0);

  const onAdd = () => {
    if (price <= 0 || (!product.isPreOrder && stock <= 0)) return;
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
    <div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-14">
        <div>
          <button
            type="button"
            className="relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-[var(--retail-bg)]"
            onClick={() => setZoomOpen(true)}
          >
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
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
              <ZoomIn className="h-3.5 w-3.5" /> بزرگنمایی
            </span>
            {product.isPreOrder ? (
              <span className="absolute right-3 top-3 rounded-full bg-[var(--retail-gold)] px-3 py-1 text-xs font-bold text-white">
                پیش‌فروش
              </span>
            ) : null}
          </button>
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
          {product.videoUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl bg-black">
              <video
                src={product.videoUrl}
                controls
                className="aspect-video w-full"
                poster={main}
              />
            </div>
          ) : null}
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
          {product.isPreOrder && product.preOrderDate ? (
            <PreOrderCountdown date={product.preOrderDate} />
          ) : (
            <p className="mt-2 text-sm text-[var(--retail-muted)]">
              موجودی: {stock > 0 ? `${stock.toLocaleString('fa-IR')} عدد` : 'ناموجود'}
            </p>
          )}

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
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">سایز</p>
                <button
                  type="button"
                  className="text-xs font-bold text-[var(--retail-primary)]"
                  onClick={() => setSizeOpen(true)}
                >
                  جدول سایز
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizeRows.map((row) => {
                  const unavailable = !product.isPreOrder && row.stock <= 0;
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
              disabled={!canBuy || price <= 0}
              onClick={onAdd}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--retail-gold)] py-3.5 text-sm font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {added ? 'به سبد اضافه شد' : product.isPreOrder ? 'پیش‌خرید' : 'افزودن به سبد'}
            </button>
          </div>

          {product.modelInfo ? (
            <p className="mt-6 rounded-xl bg-[var(--retail-bg)] px-4 py-3 text-sm text-[var(--retail-muted)]">
              {product.modelInfo}
            </p>
          ) : null}

          {product.description ? (
            <div className="prose prose-sm mt-8 max-w-none text-[var(--retail-muted)]">
              <h2 className="text-base font-bold text-[var(--retail-ink)]">توضیحات</h2>
              <p className="leading-8">{product.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="text-xl font-extrabold">پیشنهادهای مشابه</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => {
              const img = mediaUrl(r.images?.[0]);
              const rp = Number(r.retailPrice ?? 0);
              return (
                <Link key={r.id} href={`/products/${r.slug}`} className="overflow-hidden rounded-xl bg-white ring-1 ring-[var(--retail-border)]">
                  <div className="relative aspect-[3/4] bg-[var(--retail-bg)]">
                    {img ? <Image src={img} alt={r.name} fill className="object-cover" sizes="25vw" /> : null}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold">{r.name}</p>
                    {rp > 0 ? (
                      <p className="mt-1 text-sm font-bold text-[var(--retail-primary)]">{toman(rp)} ت</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {zoomOpen && main ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <button type="button" className="absolute inset-0" aria-label="بستن" onClick={() => setZoomOpen(false)} />
          <button
            type="button"
            className="absolute left-4 top-4 rounded-full bg-white/90 p-2"
            onClick={() => setZoomOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-10 h-[min(90vh,900px)] w-full max-w-4xl">
            <Image src={main} alt={product.name} fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}

      {sizeOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="بستن" onClick={() => setSizeOpen(false)} />
          <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">جدول راهنمای سایز</h3>
              <button type="button" onClick={() => setSizeOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {sizeTable.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {sizeTable.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--retail-border)]">
                      {row.map((cell, j) => (
                        <td key={j} className={`px-2 py-2 ${i === 0 ? 'font-bold' : ''}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-[var(--retail-muted)]">
                {product.sizeGuide || 'جدول سایز برای این محصول ثبت نشده است.'}
              </pre>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
