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

type ViewTransitionLike = {
  finished: Promise<void>;
  skipTransition?: () => void;
};

/** Hard cap for the VT update callback — never wait on rAF (paused during the update). */
export const PRODUCT_TRANSITION_BUDGET_MS = 300;

const readyPaths = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function normalizePath(href: string): string {
  try {
    return new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://local').pathname;
  } catch {
    return href.split(/[?#]/)[0] || href;
  }
}

/** Mark a product route as warm after Next.js `router.prefetch` resolves. */
export function warmProductRoute(
  href: string,
  prefetch: (href: string) => void | Promise<unknown>,
): void {
  const path = normalizePath(href);
  if (readyPaths.has(path) || inflight.has(path)) return;
  const task = Promise.resolve()
    .then(() => prefetch(href))
    .then(() => {
      readyPaths.add(path);
    })
    .catch(() => {
      /* leave cold — click will navigate without a morph */
    })
    .finally(() => {
      inflight.delete(path);
    });
  inflight.set(path, task);
}

export function isProductRouteReady(href: string): boolean {
  return readyPaths.has(normalizePath(href));
}

/** Test-only: reset warm-route bookkeeping. */
export function resetProductRouteWarmthForTests(): void {
  readyPaths.clear();
  inflight.clear();
}

function clearProductName() {
  document.querySelectorAll<HTMLImageElement>('img').forEach((node) => {
    if (node.style.viewTransitionName === 'tn-product') node.style.viewTransitionName = '';
  });
}

/**
 * Wait for the PDP hero without requestAnimationFrame.
 * Browsers pause rAF for the duration of the View Transition update callback,
 * so an rAF poll hangs until Chrome's ~4s VT timeout.
 * Uses MutationObserver + a hard setTimeout budget instead.
 */
/** Resolves true when the PDP hero was named for the morph; false on budget timeout. */
function waitForProductHero(path: string, budgetMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let observer: MutationObserver | null = null;
    let timer = 0;

    const finish = (attached: boolean) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
      resolve(attached);
    };

    const tryAttach = (): boolean => {
      if (window.location.pathname !== path) return false;
      const hero = document.querySelector('[data-tn-hero] img');
      if (!(hero instanceof HTMLImageElement)) return false;
      hero.style.viewTransitionName = 'tn-product';
      return true;
    };

    if (tryAttach()) {
      finish(true);
      return;
    }

    observer = new MutationObserver(() => {
      if (tryAttach()) finish(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = window.setTimeout(() => finish(false), budgetMs);
  });
}

/**
 * Progressive card → product morph. No-ops without the View Transitions API
 * or when the visitor asked for reduced motion. Direct loads never set a
 * view-transition-name, so the product LCP image stays a normal image.
 *
 * startViewTransition must run with `this === document`. An unbound call throws
 * Illegal invocation in Chromium/WebKit; if that happens after preventDefault,
 * navigation would be lost — so failures always fall back to navigate().
 *
 * The update callback must not await requestAnimationFrame (rAF is paused during
 * the update). Hero attach uses MutationObserver with a 300ms setTimeout ceiling.
 * Morph only runs when the destination was prefetched (`warmProductRoute`);
 * otherwise the click falls through to default Link navigation.
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
    startViewTransition?: (cb: () => void | Promise<void>) => ViewTransitionLike;
  }).startViewTransition;
  if (typeof start !== 'function') return;

  const anchor = event.currentTarget instanceof HTMLAnchorElement
    ? event.currentTarget
    : event.currentTarget.closest('a');
  const img = anchor?.querySelector('img');
  if (!(img instanceof HTMLImageElement) || !anchor) return;

  const path = new URL(anchor.href, window.location.origin).pathname;

  // Cold route → leave the click alone so Next <Link> navigates without a morph.
  if (!readyPaths.has(path)) return;

  event.preventDefault();
  img.style.viewTransitionName = 'tn-product';

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate();
  };

  try {
    let transition!: ViewTransitionLike;
    transition = start.call(document, async () => {
      go();
      const attached = await waitForProductHero(path, PRODUCT_TRANSITION_BUDGET_MS);
      // Budget exceeded without a hero — drop the morph so the new page paints immediately.
      if (!attached) {
        try {
          transition.skipTransition?.();
        } catch {
          /* older engines */
        }
      }
    });

    // Safety: if the update somehow stalls past the budget, skip anyway.
    const skipTimer = window.setTimeout(() => {
      try {
        transition.skipTransition?.();
      } catch {
        /* older engines */
      }
    }, PRODUCT_TRANSITION_BUDGET_MS + 50);

    void transition.finished
      .catch(() => {
        if (!navigated) go();
      })
      .finally(() => {
        window.clearTimeout(skipTimer);
        clearProductName();
      });
  } catch {
    img.style.viewTransitionName = '';
    go();
  }
}
