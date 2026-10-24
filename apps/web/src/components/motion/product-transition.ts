type ProductClick = {
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  preventDefault: () => void;
  currentTarget: EventTarget & Element;
};

function clearProductName() {
  document.querySelectorAll<HTMLImageElement>('img').forEach((node) => {
    if (node.style.viewTransitionName === 'tn-product') node.style.viewTransitionName = '';
  });
}

/**
 * Progressive card → product morph. No-ops without the View Transitions API
 * or when the visitor asked for reduced motion. Direct loads never set a
 * view-transition-name, so the product LCP image stays a normal image.
 */
export function beginProductTransition(event: ProductClick, navigate: () => void) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = (document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
  }).startViewTransition;
  if (typeof start !== 'function') return;

  const anchor = event.currentTarget instanceof HTMLAnchorElement
    ? event.currentTarget
    : event.currentTarget.closest('a');
  const img = anchor?.querySelector('img');
  if (!(img instanceof HTMLImageElement) || !anchor) return;

  event.preventDefault();
  img.style.viewTransitionName = 'tn-product';
  const path = new URL(anchor.href, window.location.origin).pathname;

  const transition = start(async () => {
    navigate();
    const begun = performance.now();
    while (performance.now() - begun < 800) {
      const hero = document.querySelector('[data-tn-hero] img');
      if (window.location.pathname === path && hero instanceof HTMLImageElement) {
        hero.style.viewTransitionName = 'tn-product';
        return;
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    }
  });
  void transition.finished.finally(clearProductName);
}
