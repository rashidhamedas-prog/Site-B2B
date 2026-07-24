'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RetailCartItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
  color?: string;
  size?: string;
  variantId?: string;
}

interface RetailCartState {
  items: RetailCartItem[];
  addItem: (item: RetailCartItem) => void;
  updateQty: (productId: string, quantity: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
}

export const useRetailCart = create<RetailCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        set((state) => {
          const idx = state.items.findIndex((i) => i.productId === item.productId && i.variantId === item.variantId);
          if (idx >= 0) {
            const items = [...state.items];
            items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
            return { items };
          }
          return { items: [...state.items, { ...item, quantity: qty }] };
        });
      },
      updateQty: (productId, quantity, variantId) => {
        const q = Math.max(0, Number(quantity) || 0);
        const match = (i: RetailCartItem) =>
          i.productId === productId && (variantId === undefined || i.variantId === variantId);
        set((state) => ({
          items:
            q <= 0
              ? state.items.filter((i) => !match(i))
              : state.items.map((i) => (match(i) ? { ...i, quantity: q } : i)),
        }));
      },
      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) =>
              !(i.productId === productId && (variantId === undefined || i.variantId === variantId)),
          ),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      total: () => get().items.reduce((n, i) => n + i.unitPrice * i.quantity, 0),
    }),
    { name: 'taranom_retail_cart' },
  ),
);

export function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}
