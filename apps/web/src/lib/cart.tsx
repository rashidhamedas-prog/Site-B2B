'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

const CART_STORAGE_KEY = 'taranom_cart';

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  minOrderQty: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'UPDATE_QTY'; productId: string; quantity: number }
  | { type: 'REMOVE'; productId: string }
  | { type: 'CLEAR' };

function normalizeQty(quantity: number, minOrderQty: number) {
  const step = Math.max(1, Number(minOrderQty) || 1);
  const q = Number(quantity) || 0;
  if (q <= 0) return step;
  const snapped = Math.floor(q / step) * step;
  return Math.max(step, snapped || step);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const idx = state.items.findIndex((i) => i.productId === action.item.productId);
      if (idx >= 0) {
        const items = [...state.items];
        const minOrderQty = action.item.minOrderQty ?? items[idx].minOrderQty ?? 1;
        items[idx] = {
          ...items[idx],
          minOrderQty,
          quantity: normalizeQty(items[idx].quantity + action.item.quantity, minOrderQty),
        };
        return { items };
      }
      return { items: [...state.items, { ...action.item, quantity: normalizeQty(action.item.quantity, action.item.minOrderQty) }] };
    }
    case 'UPDATE_QTY': {
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: normalizeQty(action.quantity, i.minOrderQty) }
            : i
        ),
      };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: CartItem) => void;
  updateQty: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [], count: 0, total: 0,
  addItem: () => {}, updateQty: () => {}, removeItem: () => {}, clear: () => {},
});

function loadInitialCart(): CartState {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? { items: JSON.parse(raw) as CartItem[] } : { items: [] };
  } catch {
    return { items: [] };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadInitialCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const count = state.items.reduce((s, i) => s + i.quantity, 0);
  const total = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items: state.items,
      count,
      total,
      addItem: (item) => dispatch({ type: 'ADD', item }),
      updateQty: (productId, quantity) => dispatch({ type: 'UPDATE_QTY', productId, quantity }),
      removeItem: (productId) => dispatch({ type: 'REMOVE', productId }),
      clear: () => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
