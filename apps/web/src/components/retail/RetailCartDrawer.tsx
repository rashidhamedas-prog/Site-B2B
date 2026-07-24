'use client';

import Image from 'next/image';
import Link from 'next/link';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { toman, useRetailCart } from '@/lib/retail-cart';

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export function RetailCartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useRetailCart((s) => s.items);
  const updateQty = useRetailCart((s) => s.updateQty);
  const removeItem = useRetailCart((s) => s.removeItem);
  const total = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--retail-border)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-extrabold">
            <ShoppingBag className="h-5 w-5" />
            سبد خرید
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--retail-muted)]">سبد خالی است.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => {
                const img = mediaUrl(item.imageUrl);
                return (
                  <li key={`${item.productId}-${item.variantId ?? ''}-${item.size}-${item.color}`} className="flex gap-3">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--retail-bg)]">
                      {img ? <Image src={img} alt={item.productName} fill className="object-cover" sizes="64px" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.productName}</p>
                      <p className="mt-0.5 text-xs text-[var(--retail-muted)]">
                        {[item.color, item.size].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-[var(--retail-primary)]">
                        {toman(item.unitPrice)} ت
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border p-1"
                          onClick={() => updateQty(item.productId, item.quantity - 1, item.variantId)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity.toLocaleString('fa-IR')}</span>
                        <button
                          type="button"
                          className="rounded border p-1"
                          onClick={() => updateQty(item.productId, item.quantity + 1, item.variantId)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="mr-auto text-xs text-red-500"
                          onClick={() => removeItem(item.productId, item.variantId)}
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {items.length > 0 ? (
            <div className="mt-8 rounded-xl bg-[var(--retail-bg)] p-4">
              <p className="text-sm font-bold text-[var(--retail-ink)]">ست کامل‌تر؟</p>
              <p className="mt-1 text-xs leading-6 text-[var(--retail-muted)]">
                شومیز و مانتوهای هم‌جنس را در فروشگاه ببینید تا استایل‌تان یکدست شود.
              </p>
              <Link
                href="/products"
                onClick={onClose}
                className="mt-3 inline-block text-xs font-bold text-[var(--retail-primary)]"
              >
                مشاهده محصولات مرتبط
              </Link>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--retail-border)] px-5 py-4">
          <div className="mb-3 flex justify-between text-sm">
            <span>جمع</span>
            <span className="font-extrabold">{toman(total)} تومان</span>
          </div>
          <Link
            href="/checkout"
            onClick={onClose}
            className={`block rounded-full py-3 text-center text-sm font-extrabold text-white ${
              items.length ? 'bg-[var(--retail-gold)]' : 'pointer-events-none bg-gray-300'
            }`}
          >
            تسویه حساب
          </Link>
        </div>
      </aside>
    </div>
  );
}
