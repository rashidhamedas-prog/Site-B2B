'use client';

/** Local wishlist for retail storefront (skill B2C). */
const KEY = 'taranom-retail-wishlist';

export type WishlistItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl?: string;
  price?: number;
};

function read(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: WishlistItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('taranom-wishlist'));
}

export function getWishlist(): WishlistItem[] {
  return read();
}

export function isInWishlist(productId: string): boolean {
  return read().some((i) => i.productId === productId);
}

export function toggleWishlist(item: WishlistItem): boolean {
  const cur = read();
  const exists = cur.some((i) => i.productId === item.productId);
  const next = exists ? cur.filter((i) => i.productId !== item.productId) : [...cur, item];
  write(next);
  return !exists;
}
