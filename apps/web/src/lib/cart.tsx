'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

const CART_STORAGE_KEY = 'taranom_cart';

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  color: string;
  colorHex?: string;
  size: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'UPDATE_QTY'; variantId: string; size: string; quantity: number }
  | { type: 'REMOVE'; variantId: string; size: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const idx = state.items.findIndex(
        (i) => i.variantId === action.item.variantId && i.size === action.item.size
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = { ...items[idx], quantity: items[idx].quantity + action.item.quantity };
        return { items };
      }
      return { items: [...state.items, action.item] };
    }
    case 'UPDATE_QTY': {
      return {
        items: state.items.map((i) =>
          i.variantId === action.variantId && i.size === action.size
            ? { ...i, quantity: Math.max(1, action.quantity) }
            : i
        ),
      };
    }
    case 'REMOVE':
      return { items: state.items.filter((i) => !(i.variantId === action.variantId && i.size === action.size)) };
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
  updateQty: (variantId: string, size: string, quantity: number) => void;
  removeItem: (variantId: string, size: string) => void;
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
      updateQty: (variantId, size, quantity) => dispatch({ type: 'UPDATE_QTY', variantId, size, quantity }),
      removeItem: (variantId, size) => dispatch({ type: 'REMOVE', variantId, size }),
      clear: () => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
