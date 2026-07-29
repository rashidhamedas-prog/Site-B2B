'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

const CART_STORAGE_KEY = 'taranom_cart';

export interface CartItem {
  productId: string;
  productVariantId?: string;
  color?: string;
  size?: string;
  productName: string;
  sku: string;
  unitPrice: number;
  minOrderQty: number;
  /** Piece count (legacy) OR pack-set count when packMode */
  quantity: number;
  imageUrl?: string;
  /** Wholesale pack matrix: quantity = pack sets; expands color×size×packQty on order */
  packMode?: boolean;
  selectedColors?: string[];
  packQty?: number;
  sizeCount?: number;
}

/** Total billable pieces for a cart line (pack mode expands color×size×packQty). */
export function cartItemPieces(item: CartItem): number {
  if (item.packMode && item.packQty && item.packQty > 0) {
    const colors = Math.max(1, item.selectedColors?.length || 1);
    const sizes = Math.max(1, item.sizeCount || 1);
    return Math.max(1, item.quantity) * item.packQty * colors * sizes;
  }
  return Math.max(0, item.quantity);
}

export function cartLineKey(
  item: Pick<CartItem, 'productId' | 'productVariantId' | 'color' | 'size' | 'packMode' | 'selectedColors'>,
) {
  if (item.productVariantId) return `${item.productId}:${item.productVariantId}`;
  if (item.packMode) {
    const colors = [...(item.selectedColors ?? [])].map((c) => c.trim()).filter(Boolean).sort().join(',');
    return `${item.productId}:pack:${colors || 'all'}`;
  }
  const meta = [item.color, item.size].filter(Boolean).join('|');
  return meta ? `${item.productId}:${meta}` : item.productId;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'UPDATE_QTY'; lineKey: string; quantity: number }
  | { type: 'REMOVE'; lineKey: string }
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
      const key = cartLineKey(action.item);
      const idx = state.items.findIndex((i) => cartLineKey(i) === key);
      if (idx >= 0) {
        const items = [...state.items];
        const minOrderQty = action.item.minOrderQty ?? items[idx].minOrderQty ?? 1;
        items[idx] = {
          ...items[idx],
          ...action.item,
          minOrderQty,
          quantity: normalizeQty(items[idx].quantity + action.item.quantity, minOrderQty),
        };
        return { items };
      }
      return {
        items: [
          ...state.items,
          { ...action.item, quantity: normalizeQty(action.item.quantity, action.item.minOrderQty) },
        ],
      };
    }
    case 'UPDATE_QTY': {
      return {
        items: state.items.map((i) =>
          cartLineKey(i) === action.lineKey
            ? { ...i, quantity: normalizeQty(action.quantity, i.minOrderQty) }
            : i,
        ),
      };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => cartLineKey(i) !== action.lineKey) };
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
  updateQty: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
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

  const count = state.items.reduce((s, i) => s + cartItemPieces(i), 0);
  const total = state.items.reduce((s, i) => s + i.unitPrice * cartItemPieces(i), 0);

  return (
    <CartContext.Provider value={{
      items: state.items,
      count,
      total,
      addItem: (item) => dispatch({ type: 'ADD', item }),
      updateQty: (lineKey, quantity) => dispatch({ type: 'UPDATE_QTY', lineKey, quantity }),
      removeItem: (lineKey) => dispatch({ type: 'REMOVE', lineKey }),
      clear: () => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
