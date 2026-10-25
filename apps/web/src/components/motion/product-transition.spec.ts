/**
 * npx tsx src/components/motion/product-transition.spec.ts
 * (cwd: apps/web)
 */
import assert from 'node:assert/strict';
import {
  PRODUCT_TRANSITION_BUDGET_MS,
  beginProductTransition,
  isProductRouteReady,
  resetProductRouteWarmthForTests,
  warmProductRoute,
} from './product-transition.ts';

const HREF = '/products/yalda-memory-jacket';
const ORIGIN = 'https://www.poshaktaranom.ir';

type Update = () => void | Promise<void>;

class ImageEl {
  style = { viewTransitionName: '' };
}

class AnchorEl {
  href = '';
  img: ImageEl | null = null;
  querySelector(selector: string): ImageEl | null {
    return selector === 'img' ? this.img : null;
  }
  closest(selector: string): AnchorEl | null {
    return selector === 'a' ? this : null;
  }
}

const images: ImageEl[] = [];
let heroVisible = true;
let rafCalls = 0;

function track(image: ImageEl) {
  images.push(image);
  return image;
}

function installDocument(
  startViewTransition?: (this: unknown, update: Update) => {
    finished: Promise<void>;
    skipTransition?: () => void;
  },
) {
  images.length = 0;
  heroVisible = true;
  rafCalls = 0;
  const hero = track(new ImageEl());
  const observers: Array<{ cb: MutationCallback; disconnect: () => void }> = [];

  const doc: Record<string, unknown> & {
    startViewTransition?: (this: unknown, update: Update) => {
      finished: Promise<void>;
      skipTransition?: () => void;
    };
    documentElement: { nodeType: number };
    querySelector: (selector: string) => ImageEl | null;
    querySelectorAll: (selector: string) => ImageEl[];
  } = {
    documentElement: { nodeType: 1 },
    querySelector(selector: string) {
      if (selector === '[data-tn-hero] img') return heroVisible ? hero : null;
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === 'img' ? images : [];
    },
  };
  if (startViewTransition) doc.startViewTransition = startViewTransition;

  const g = globalThis as unknown as {
    document: typeof doc;
    window: {
      matchMedia: (query: string) => { matches: boolean };
      location: { origin: string; pathname: string };
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    };
    HTMLAnchorElement: typeof AnchorEl;
    HTMLImageElement: typeof ImageEl;
    performance: { now: () => number };
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
    MutationObserver: new (cb: MutationCallback) => {
      observe: (target: unknown, options?: MutationObserverInit) => void;
      disconnect: () => void;
    };
  };
  g.HTMLAnchorElement = AnchorEl;
  g.HTMLImageElement = ImageEl;
  g.document = doc;
  g.window = {
    matchMedia: () => ({ matches: false }),
    location: { origin: ORIGIN, pathname: HREF },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
  g.performance = { now: () => Date.now() };
  // Never fire — regression guard: VT update must not hang on rAF.
  g.requestAnimationFrame = () => {
    rafCalls += 1;
    return 0;
  };
  g.MutationObserver = class {
    private cb: MutationCallback;
    constructor(cb: MutationCallback) {
      this.cb = cb;
      observers.push({
        cb,
        disconnect: () => {
          /* noop */
        },
      });
    }
    observe() {
      /* tests drive readiness via heroVisible + timer */
    }
    disconnect() {
      /* noop */
    }
  } as unknown as typeof g.MutationObserver;

  return { doc, hero, getRafCalls: () => rafCalls, setHeroVisible: (v: boolean) => { heroVisible = v; } };
}

function makeEvent(overrides: Partial<{
  metaKey: boolean;
  ctrlKey: boolean;
  button: number;
}> = {}) {
  const img = track(new ImageEl());
  const anchor = new AnchorEl();
  anchor.href = HREF;
  anchor.img = img;
  const event = {
    defaultPrevented: false,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: false,
    altKey: false,
    button: overrides.button ?? 0,
    preventDefault() {
      this.defaultPrevented = true;
    },
    currentTarget: anchor as unknown as EventTarget & Element,
  };
  return { event, img, anchor };
}

async function warmReady() {
  resetProductRouteWarmthForTests();
  warmProductRoute(HREF, async () => undefined);
  for (let i = 0; i < 5 && !isProductRouteReady(HREF); i += 1) {
    await Promise.resolve();
  }
  assert.equal(isProductRouteReady(HREF), true);
}

/** Bound startViewTransition + navigate when route is warm. */
async function whenBoundCallSucceeds() {
  await warmReady();
  let thisArg: unknown;
  let finished = Promise.resolve();
  const { doc, getRafCalls } = installDocument(function (this: unknown, update: Update) {
    thisArg = this;
    if (this !== doc) throw new TypeError('Illegal invocation');
    finished = Promise.resolve(update()).then(() => undefined);
    return { finished, skipTransition() {} };
  });

  const { event, img } = makeEvent();
  let navigated = 0;
  beginProductTransition(event, () => {
    navigated += 1;
  });

  assert.equal(thisArg, doc, 'startViewTransition must run with this=document');
  assert.equal(event.defaultPrevented, true);
  assert.equal(navigated, 1, 'navigate runs inside the transition update');
  await finished;
  await Promise.resolve();
  assert.equal(getRafCalls(), 0, 'update callback must not schedule rAF');
  assert.equal(img.style.viewTransitionName, '', 'card name cleared after finished');
}

/** When rAF never fires and hero is late, update still resolves under 350ms. */
async function whenRafNeverFiresResolvesUnderBudget() {
  await warmReady();
  let updateMs = 0;
  let finished = Promise.resolve();
  const { setHeroVisible, getRafCalls } = installDocument(function (this: unknown, update: Update) {
    setHeroVisible(false);
    const t0 = Date.now();
    finished = Promise.resolve(update()).then(() => {
      updateMs = Date.now() - t0;
    });
    return { finished, skipTransition() {} };
  });

  const { event } = makeEvent();
  beginProductTransition(event, () => undefined);
  await finished;
  assert.equal(getRafCalls(), 0, 'no rAF scheduled');
  assert.ok(
    updateMs <= PRODUCT_TRANSITION_BUDGET_MS + 50,
    `update resolved in ${updateMs}ms (budget ${PRODUCT_TRANSITION_BUDGET_MS}ms)`,
  );
  assert.ok(updateMs < 350, `must resolve under 350ms, got ${updateMs}ms`);
}

/** Cold (not prefetched) route leaves the Link click alone. */
async function whenRouteColdNoPreventDefault() {
  resetProductRouteWarmthForTests();
  installDocument(function () {
    throw new Error('startViewTransition must not run for cold routes');
  });
  const { event } = makeEvent();
  let navigated = 0;
  beginProductTransition(event, () => {
    navigated += 1;
  });
  assert.equal(event.defaultPrevented, false);
  assert.equal(navigated, 0);
}

/** if startViewTransition throws, navigate still runs and name is cleared. */
async function whenStartThrows() {
  await warmReady();
  installDocument(function () {
    throw new TypeError('Illegal invocation');
  });
  const { event, img } = makeEvent();
  let navigated = 0;
  beginProductTransition(event, () => {
    navigated += 1;
  });
  assert.equal(event.defaultPrevented, true, 'preventDefault already ran before start');
  assert.equal(navigated, 1, 'catch path still navigates');
  assert.equal(img.style.viewTransitionName, '', 'name cleared on failure');
}

/** ctrl/meta or middle-click must not preventDefault. */
async function whenModifierOrMiddleClick() {
  await warmReady();
  installDocument(function () {
    throw new Error('startViewTransition must not run for modified clicks');
  });

  for (const overrides of [{ metaKey: true }, { ctrlKey: true }, { button: 1 }] as const) {
    const { event } = makeEvent(overrides);
    let navigated = 0;
    beginProductTransition(event, () => {
      navigated += 1;
    });
    assert.equal(event.defaultPrevented, false, `no preventDefault for ${JSON.stringify(overrides)}`);
    assert.equal(navigated, 0, `no navigate for ${JSON.stringify(overrides)}`);
  }
}

/** finished rejection still navigates if the update never ran. */
async function whenFinishedRejectsWithoutNavigate() {
  await warmReady();
  let rejectFinished!: (reason?: unknown) => void;
  const finished = new Promise<void>((_, reject) => {
    rejectFinished = reject;
  });
  installDocument(function () {
    return { finished, skipTransition() {} };
  });
  const { event } = makeEvent();
  let navigated = 0;
  beginProductTransition(event, () => {
    navigated += 1;
  });
  assert.equal(navigated, 0);
  rejectFinished(new Error('transition aborted'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(navigated, 1, 'finished rejection falls back to navigate');
  assert.equal(event.defaultPrevented, true);
}

/** skipTransition is armed when the 300ms budget elapses. */
async function whenSlowUpdateSkipsTransition() {
  await warmReady();
  let skipped = 0;
  let finished = Promise.resolve();
  const { setHeroVisible } = installDocument(function (this: unknown, update: Update) {
    finished = Promise.resolve(update()).then(() => undefined);
    return {
      finished,
      skipTransition() {
        skipped += 1;
      },
    };
  });
  setHeroVisible(false);

  const { event } = makeEvent();
  beginProductTransition(event, () => undefined);
  await finished;
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(skipped >= 1, 'skipTransition called when budget elapses');
}

async function main() {
  await whenBoundCallSucceeds();
  await whenRafNeverFiresResolvesUnderBudget();
  await whenRouteColdNoPreventDefault();
  await whenStartThrows();
  await whenModifierOrMiddleClick();
  await whenFinishedRejectsWithoutNavigate();
  await whenSlowUpdateSkipsTransition();
  console.log('product-transition.spec.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
