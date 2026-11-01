export const CART_ADDED_EVENT = 'taranom:cart-added';

export function notifyCartAdded(name?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT, { detail: { name: name?.trim() ?? '' } }));
}
