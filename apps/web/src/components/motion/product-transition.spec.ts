/**
 * npx tsx src/components/motion/product-transition.spec.ts
 * (cwd: apps/web)
 */
import assert from 'node:assert/strict';
import { beginProductTransition } from './product-transition.ts';

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

function track(image: ImageEl) {
  images.push(image);
  return image;
}

function installDocument(
  startViewTransition?: (this: unknown, update: Update) => { finished: Promise<void> },
) {
  images.length = 0;
  const hero = track(new ImageEl());
  const doc: Record<string, unknown> & {
    startViewTransition?: (this: unknown, update: Update) => { finished: Promise<void> };
    querySelector: (selector: string) => ImageEl | null;
    querySelectorAll: (selector: string) => ImageEl[];
  } = {
    querySelector(selector: string) {
      return selector === '[data-tn-hero] img' ? hero : null;
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
    };
    HTMLAnchorElement: typeof AnchorEl;
    HTMLImageElement: typeof ImageEl;
    performance: { now: () => number };
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
  };
  g.HTMLAnchorElement = AnchorEl;
  g.HTMLImageElement = ImageEl;
  g.document = doc;
  g.window = {
    matchMedia: () => ({ matches: false }),
    location: { origin: ORIGIN, pathname: HREF },
  };
  g.performance = { now: () => 0 };
  g.requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
  return { doc, hero };
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

/** (a) startViewTransition is invoked with this=document and navigate runs. */
async function whenBoundCallSucceeds() {
  let thisArg: unknown;
  let finished = Promise.resolve();
  const { doc } = installDocument(function (this: unknown, update: Update) {
    thisArg = this;
    if (this !== doc) throw new TypeError('Illegal invocation');
    finished = Promise.resolve(update()).then(() => undefined);
    return { finished };
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
  assert.equal(img.style.viewTransitionName, '', 'card name cleared after finished');
}

/** (b) if startViewTransition throws, navigate still runs and name is cleared. */
function whenStartThrows() {
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

/** (c) ctrl/meta or middle-click must not preventDefault. */
function whenModifierOrMiddleClick() {
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
  let rejectFinished!: (reason?: unknown) => void;
  const finished = new Promise<void>((_, reject) => {
    rejectFinished = reject;
  });
  installDocument(function () {
    // Never invoke the update callback — simulates a failed transition before navigate.
    return { finished };
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

async function main() {
  await whenBoundCallSucceeds();
  whenStartThrows();
  whenModifierOrMiddleClick();
  await whenFinishedRejectsWithoutNavigate();
  console.log('product-transition.spec.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
