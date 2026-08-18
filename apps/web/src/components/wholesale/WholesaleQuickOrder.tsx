'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { mediaUrl, toman } from '@/lib/product-display';
import {
  defaultWholesaleColors,
  wholesaleMoq,
  wholesaleOrderSummary,
  type WholesaleOrderProduct,
} from '@/lib/wholesale-order';

export function WholesaleQuickOrder({
  product: initial,
  open,
  onClose,
}: {
  product: WholesaleOrderProduct;
  open: boolean;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [product, setProduct] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(() => wholesaleMoq(initial));
  const [selectedColors, setSelectedColors] = useState(() => defaultWholesaleColors(initial));
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProduct(initial);
    setQuantity(wholesaleMoq(initial));
    setSelectedColors(defaultWholesaleColors(initial));
    const needsFetch = !(initial.variants && initial.variants.length);
    if (!needsFetch || !initial.slug) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<WholesaleOrderProduct>(`/products/slug/${initial.slug}?channel=WHOLESALE`)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        setQuantity(wholesaleMoq(p));
        setSelectedColors(defaultWholesaleColors(p));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initial]);

  const summary = useMemo(
    () => wholesaleOrderSummary(product, selectedColors, quantity),
    [product, selectedColors, quantity],
  );
  const image = mediaUrl(product.images?.[0]);
  const priceHidden = !(summary.unitPrice > 0);

  const toggleColor = (name: string) => {
    setSelectedColors((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const onAdd = () => {
    if (!summary.canOrder || priceHidden) return;
    const qty = Math.max(summary.minOrder, quantity);
    if (summary.packMode) {
      addItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? '',
        unitPrice: summary.unitPrice,
        minOrderQty: summary.minOrder,
        quantity: qty,
        imageUrl: image,
        packMode: true,
        packQty: summary.piecesPerPack,
        sizeCount: Math.max(1, summary.availableSizes.length),
        selectedColors: summary.allowColorSelect ? [...selectedColors] : summary.availableColors.map((c) => c.name),
      });
    } else {
      addItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? '',
        unitPrice: summary.unitPrice,
        minOrderQty: summary.minOrder,
        quantity: qty,
        imageUrl: image,
      });
    }
    setAdded(true);
    window.setTimeout(() => {
      setAdded(false);
      onClose();
    }, 900);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wholesale-quick-order-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--brand-border)] bg-[var(--brand-ivory)] md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--brand-border)] p-4">
          <div className="flex items-center gap-3">
            {image ? (
              <span className="relative h-16 w-16 overflow-hidden rounded-md border border-[var(--brand-border)]">
                <Image src={image} alt="" fill className="object-cover" sizes="64px" />
              </span>
            ) : (
              <div className="h-16 w-16 rounded-md bg-[var(--brand-card)]" />
            )}
            <div>
              <h2 id="wholesale-quick-order-title" className="text-base font-bold text-[var(--brand-ink)]">
                {product.name}
              </h2>
              {product.sku ? <p className="text-xs text-[var(--brand-muted)]">کد: {product.sku}</p> : null}
              <p className="mt-1 text-xs font-bold text-[var(--brand-green)]">
                {summary.isComingSoon ? 'به‌زودی' : summary.totalStock > 0 ? 'موجودی کافی' : 'ناموجود'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <p className="py-8 text-center text-sm text-[var(--brand-muted)]">در حال بارگذاری…</p> : null}

          {summary.allowColorSelect && summary.availableColors.length > 0 ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-bold">
                انتخاب رنگ — حداقل {summary.minColors.toLocaleString('fa-IR')} رنگ
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.availableColors.map((c) => {
                  const selected = selectedColors.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => toggleColor(c.name)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        selected
                          ? 'border-[var(--brand-green)] bg-[var(--brand-green)] text-white'
                          : 'border-[var(--brand-border)] bg-white'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : summary.availableColors.length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {summary.availableColors.map((c) => (
                <div key={c.name} className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] bg-white p-2">
                  <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: c.hex }} />
                  <span className="text-sm">{c.name}</span>
                </div>
              ))}
            </div>
          ) : null}

          {summary.packMode && summary.availableSizes.length > 0 ? (
            <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--brand-gold)]/30">
              <table className="w-full text-center text-xs">
                <thead className="bg-white">
                  <tr>
                    <th className="p-2 font-medium text-[var(--brand-muted)]">رنگ / سایز</th>
                    {summary.availableSizes.map((s) => (
                      <th key={s} className="p-2 font-medium">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.availableColors.map((c) => (
                    <tr key={c.name} className="border-t border-[var(--brand-border)]">
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                          {c.name}
                        </span>
                      </td>
                      {summary.availableSizes.map((s) => {
                        const v = (product.variants ?? []).find((x) => x.color === c.name && x.size === s);
                        const stock = v ? Number(v.wholesaleStock ?? v.stock ?? 0) : 0;
                        return (
                          <td key={s} className="p-2 text-[var(--brand-muted)]">
                            {stock > 0 ? stock.toLocaleString('fa-IR') : 'ناموجود'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand-green)]/20 bg-[var(--brand-green)]/5 p-3">
            <div>
              <p className="text-xs text-[var(--brand-muted)]">
                {summary.packMode ? 'تعداد پک' : 'تعداد'} — حداقل {summary.minOrder.toLocaleString('fa-IR')}
              </p>
              <div className="mt-2 flex items-center border border-[var(--brand-border)] bg-white">
                <button
                  type="button"
                  className="h-10 w-10"
                  onClick={() => setQuantity((q) => Math.max(summary.minOrder, q - 1))}
                >
                  −
                </button>
                <span className="w-10 text-center font-bold">{quantity.toLocaleString('fa-IR')}</span>
                <button type="button" className="h-10 w-10" onClick={() => setQuantity((q) => q + 1)}>
                  +
                </button>
              </div>
            </div>
            <div className="text-left">
              <p className="text-xs text-[var(--brand-muted)]">جمع</p>
              <p className="text-lg font-black text-[var(--brand-green)]">
                {priceHidden ? 'پس از ورود' : `${toman(summary.unitPrice * summary.totalPieces)} تومان`}
              </p>
              {!priceHidden && summary.saleActive && summary.compareAt > summary.unitPrice ? (
                <p className="text-[11px] text-[var(--brand-muted)] line-through">
                  {toman(summary.compareAt * summary.totalPieces)}
                </p>
              ) : null}
              {summary.packMode ? (
                <p className="text-[11px] text-[var(--brand-muted)]">
                  {summary.totalPieces.toLocaleString('fa-IR')} عدد
                </p>
              ) : null}
            </div>
          </div>

          {!summary.canOrder && !summary.isComingSoon ? (
            <p className="mt-3 text-xs text-[var(--brand-error)]">
              موجودی یا حداقل سفارش برای ثبت کافی نیست.
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-[var(--brand-border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-full border border-[var(--brand-border)] text-sm font-bold"
          >
            بستن
          </button>
          <button
            type="button"
            disabled={!summary.canOrder || priceHidden}
            onClick={onAdd}
            className="h-12 flex-[2] rounded-full bg-[var(--brand-green)] text-sm font-bold text-white disabled:opacity-50"
          >
            {added ? 'به سبد اضافه شد' : priceHidden ? 'ورود برای سفارش' : 'افزودن به سبد خرید'}
          </button>
        </div>
      </div>
    </div>
  );
}
