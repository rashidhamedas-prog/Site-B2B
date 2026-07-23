'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { toman, useRetailCart } from '@/lib/retail-cart';

export function RetailCartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useRetailCart((s) => s.items);
  const updateQty = useRetailCart((s) => s.updateQty);
  const removeItem = useRetailCart((s) => s.removeItem);
  const total = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="بستن سبد" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300">
        <div className="flex items-center justify-between border-b border-[var(--retail-border)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--retail-ink)]">سبد خرید</h2>
          <button type="button" className="cursor-pointer rounded-lg p-2 hover:bg-[var(--retail-bg)]" onClick={onClose} aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-[var(--retail-muted)]">سبد شما خالی است</p>
              <Link
                href="/retail/products"
                onClick={onClose}
                className="cursor-pointer rounded-full bg-[var(--retail-primary)] px-5 py-2.5 text-sm font-bold text-white"
              >
                مشاهده محصولات
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-3 border-b border-[var(--retail-border)] pb-4">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--retail-bg)]">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="64px" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--retail-ink)]">{item.productName}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--retail-primary)]">{toman(item.unitPrice)} تومان</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer rounded border p-1"
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        aria-label="کاهش"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity.toLocaleString('fa-IR')}</span>
                      <button
                        type="button"
                        className="cursor-pointer rounded border p-1"
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        aria-label="افزایش"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="mr-auto cursor-pointer p-1 text-red-500"
                        onClick={() => removeItem(item.productId)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[var(--retail-border)] p-5">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-[var(--retail-muted)]">جمع سبد</span>
              <span className="text-lg font-extrabold text-[var(--retail-ink)]">{toman(total)} تومان</span>
            </div>
            <p className="mb-3 text-xs text-[var(--retail-muted)]">ست کامل کن — پیشنهاد مکمل به‌زودی</p>
            <Link
              href="/retail/checkout"
              onClick={onClose}
              className="flex w-full cursor-pointer items-center justify-center rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white transition hover:brightness-95"
            >
              ادامه خرید
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
