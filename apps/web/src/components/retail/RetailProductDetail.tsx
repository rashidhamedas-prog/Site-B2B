'use client';

import Image from 'next/image';
import { useMemo, useState, useEffect } from 'react';
import { Check, Heart, ShoppingBag, Truck, X, ZoomIn } from 'lucide-react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { isInWishlist, toggleWishlist } from '@/lib/retail-wishlist';
import { apiClient } from '@/lib/api';
import { discountPercent, mediaUrl as toMediaUrl } from '@/lib/product-display';
import { RetailProductCard } from './RetailProductCard';

type Related = {
  id: string;
  name: string;
  slug: string;
  retailPrice?: number | null;
  images?: string[];
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
};

type Variant = {
  id: string;
  color: string;
  colorHex?: string;
  size: string;
  stock?: number;
  retailStock?: number;
  wholesaleStock?: number;
  imageUrl?: string | null;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku?: string;
  retailPrice?: number | null;
  retailCompareAtPrice?: number | null;
  fullContent?: string | null;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  relatedProducts?: Related[];
  stock?: number;
  retailStock?: number;
  sizeGuide?: string | string[] | null;
  modelInfo?: string | null;
  videoUrl?: string | null;
  isPreOrder?: boolean;
  preOrderDate?: string | null;
  images?: string[];
  variants?: Variant[];
  categoryId?: string;
  fabric?: string;
};

function mediaUrl(url?: string | null) {
  return toMediaUrl(url);
}

function parseSizeGuide(raw?: string | string[] | null): string[][] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((line) => String(line ?? '').trim())
      .filter(Boolean)
      .map((line) => line.split(/[|\t,،]/).map((c) => c.trim()).filter(Boolean));
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
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
  const [color, setColor] = useState(product.variants?.[0]?.color ?? '');
  const [size, setSize] = useState(product.variants?.[0]?.size ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [wish, setWish] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [related, setRelated] = useState<Related[]>([]);

  const colorMeta = useMemo(() => {
    const map = new Map<string, { hex?: string; imageUrl?: string }>();
    for (const v of product.variants ?? []) {
      if (!v.color) continue;
      const prev = map.get(v.color) ?? {};
      map.set(v.color, {
        hex: prev.hex || v.colorHex,
        imageUrl: prev.imageUrl || v.imageUrl || undefined,
      });
    }
    return map;
  }, [product.variants]);

  const colors = useMemo(() => [...colorMeta.keys()], [colorMeta]);

  /** Gallery: color images first (unique), then other product images */
  const gallery = useMemo(() => {
    const colorImgs = colors
      .map((c) => colorMeta.get(c)?.imageUrl)
      .filter((u): u is string => !!u);
    const rest = (product.images ?? []).filter((u) => !colorImgs.includes(u));
    const merged = [...new Set([...colorImgs, ...rest])];
    return merged.length ? merged : (product.images ?? []);
  }, [colors, colorMeta, product.images]);

  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    setWish(isInWishlist(product.id));
  }, [product.id]);

  useEffect(() => {
    if (!product.id) return;
    const key = `retail_view_${product.id}`;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
      sessionStorage?.setItem(key, '1');
    } catch {
      /* ignore */
    }
    apiClient.post(`/products/${product.id}/view`, {}).catch(() => undefined);
  }, [product.id]);

  useEffect(() => {
    const curated = (product.relatedProducts ?? []).filter((p) => p?.id && p?.slug);
    if (curated.length) {
      setRelated(curated.slice(0, 12));
      return;
    }
    apiClient
      .get<{ data: Related[] }>(`/products?relatedTo=${encodeURIComponent(product.id)}&limit=4&channel=RETAIL`)
      .then((r) => setRelated(r.data ?? []))
      .catch(() => setRelated([]));
  }, [product.id, product.relatedProducts]);

  // Sync gallery when color changes
  useEffect(() => {
    const url = colorMeta.get(color)?.imageUrl;
    if (!url) return;
    const idx = gallery.findIndex((g) => g === url);
    if (idx >= 0) setActiveImg(idx);
  }, [color, colorMeta, gallery]);

  const variantUnits = (v: Variant) => Number(v.retailStock ?? v.stock ?? 0);

  const sizeRows = useMemo(() => {
    const map = new Map<string, { size: string; stock: number }>();
    for (const v of product.variants ?? []) {
      if (color && v.color !== color) continue;
      if (!v.size) continue;
      const prev = map.get(v.size)?.stock ?? 0;
      map.set(v.size, { size: v.size, stock: prev + variantUnits(v) });
    }
    return [...map.values()];
  }, [product.variants, color]);

  const sizeTable = useMemo(() => parseSizeGuide(product.sizeGuide), [product.sizeGuide]);
  const selectedVariant = (product.variants ?? []).find((v) => v.color === color && v.size === size);
  const sale = product.sale;
  const price = Number(sale?.payable ?? product.retailPrice ?? 0);
  const compareAt = sale?.active
    ? Number(sale.original ?? 0)
    : sale
      ? 0
      : Number(product.retailCompareAtPrice ?? 0);
  const discount = sale
    ? sale.active
      ? Number(sale.badgePercent || 0)
      : 0
    : discountPercent(price, compareAt);
  const body = product.fullContent || product.description;
  const productRetailStock = Number(product.retailStock ?? product.stock ?? 0);
  const variantStock = selectedVariant ? variantUnits(selectedVariant) : productRetailStock;
  const stock = product.variants?.length ? variantStock : productRetailStock;
  const colorImage = mediaUrl(colorMeta.get(color)?.imageUrl);
  const main = colorImage || mediaUrl(gallery[activeImg] ?? gallery[0]);
  const canBuy = product.isPreOrder || (price > 0 && stock > 0);

  const selectColor = (c: string) => {
    setColor(c);
    const first = (product.variants ?? []).find(
      (v) => v.color === c && variantUnits(v) > 0,
    ) ?? (product.variants ?? []).find((v) => v.color === c);
    if (first?.size) setSize(first.size);
  };

  const selectGalleryImage = (i: number) => {
    setActiveImg(i);
    const url = gallery[i];
    if (!url) return;
    for (const [c, meta] of colorMeta.entries()) {
      if (meta.imageUrl === url) {
        selectColor(c);
        break;
      }
    }
  };

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

  const addButton = (
    <button
      type="button"
      disabled={!canBuy || price <= 0}
      onClick={onAdd}
      className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--retail-primary)] px-4 text-sm font-extrabold text-white transition hover:bg-[var(--retail-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      {added ? 'به سبد اضافه شد' : product.isPreOrder ? 'پیش‌خرید' : 'افزودن به سبد'}
    </button>
  );

  return (
    <div className="bg-[var(--retail-bg)] pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-14">
        <div className="lg:col-span-7">
          <button
            type="button"
            className="relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-lg bg-[var(--retail-card)]"
            onClick={() => setZoomOpen(true)}
          >
            {main ? (
              <Image
                src={main}
                alt={color ? `${product.name} — ${color}` : product.name}
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
            {color ? (
              <span className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--retail-ink)]">
                {color}
              </span>
            ) : null}
          </button>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.map((img, i) => {
                const u = mediaUrl(img);
                const linkedColor = [...colorMeta.entries()].find(([, m]) => m.imageUrl === img)?.[0];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectGalleryImage(i)}
                    title={linkedColor || undefined}
                    className={`relative h-16 w-14 shrink-0 overflow-hidden rounded-md ring-2 ${
                      (colorImage ? mediaUrl(gallery[i]) === colorImage : i === activeImg)
                        ? 'ring-[var(--retail-primary)]'
                        : 'ring-transparent'
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

        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{product.name}</h1>
            <button
              type="button"
              onClick={onWish}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--retail-border)] bg-white"
              aria-label={wish ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
              aria-pressed={wish}
            >
              <Heart className={`h-5 w-5 ${wish ? 'fill-[var(--retail-primary)] text-[var(--retail-primary)]' : ''}`} />
            </button>
          </div>
          {product.sku ? (
            <p className="mt-1 text-xs text-[var(--retail-muted)]">کد: {product.sku}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-end gap-3 border-y border-[var(--retail-border)] py-4">
            <p className="text-2xl font-extrabold text-[var(--retail-primary)]">
              {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
            </p>
            {discount ? (
              <>
                <p className="text-sm text-[var(--retail-muted)] line-through">{toman(compareAt)}</p>
                <span className="rounded-full bg-[var(--retail-gold)] px-2 py-0.5 text-[11px] font-bold text-[var(--retail-primary-dark)]">
                  ٪{discount.toLocaleString('fa-IR')} تخفیف
                </span>
              </>
            ) : null}
          </div>
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
                {colors.map((c) => {
                  const meta = colorMeta.get(c);
                  const thumb = mediaUrl(meta?.imageUrl);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectColor(c)}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        color === c
                          ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)] text-white'
                          : 'border-[var(--retail-border)]'
                      }`}
                    >
                      {thumb ? (
                        <span className="relative h-6 w-6 overflow-hidden rounded-full ring-1 ring-black/10">
                          <Image src={thumb} alt={c} fill className="object-cover" sizes="24px" />
                        </span>
                      ) : (
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: meta?.hex || '#ccc' }}
                        />
                      )}
                      {c}
                    </button>
                  );
                })}
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

          <div className="mt-8 hidden items-center gap-3 lg:flex">
            <div className="flex items-center rounded-lg border border-[var(--retail-border)] bg-white">
              <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="w-8 text-center text-sm font-bold">{qty.toLocaleString('fa-IR')}</span>
              <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
            {addButton}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--retail-border)] pt-4 text-xs text-[var(--retail-muted)]">
            <span className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-[var(--retail-gold)]" aria-hidden />
              ارسال چاپار
            </span>
            <span>مرجوعی ۷ روزه</span>
          </div>

          <div className="mt-6 divide-y divide-[var(--retail-border)] border-y border-[var(--retail-border)]">
            {body ? (
              <details className="group py-4" open>
                <summary className="cursor-pointer list-none text-sm font-bold text-[var(--retail-ink)]">
                  مشخصات و توضیحات
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-8 text-[var(--retail-muted)]">{body}</p>
              </details>
            ) : null}
            {product.modelInfo ? (
              <details className="group py-4">
                <summary className="cursor-pointer list-none text-sm font-bold text-[var(--retail-ink)]">
                  اطلاعات مدل و فیت
                </summary>
                <p className="mt-3 text-sm text-[var(--retail-muted)]">{product.modelInfo}</p>
              </details>
            ) : null}
            <details className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-bold text-[var(--retail-ink)]">
                ارسال و بازگشت کالا
              </summary>
              <p className="mt-3 text-sm text-[var(--retail-muted)]">
                ارسال با چاپار. امکان بازگشت تا ۷ روز در صورت عدم استفاده.
              </p>
            </details>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--retail-border)] bg-[var(--retail-bg)]/95 p-3 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex items-center rounded-lg border border-[var(--retail-border)] bg-white">
            <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center text-sm font-bold">{qty.toLocaleString('fa-IR')}</span>
            <button type="button" className="cursor-pointer px-3 py-2" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
          {addButton}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="text-xl font-extrabold">محصولات مرتبط</h2>
          <p className="mt-1 text-sm text-[var(--retail-muted)]">مدل‌هایی که ممکن است دوست داشته باشید</p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => (
              <RetailProductCard key={r.id} product={r} compact />
            ))}
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
