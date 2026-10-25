/**
 * npx ts-node --transpile-only src/components/motion/product-transition.spec.ts
 *
 * Click contract of the product cards (Retail / Wholesale / Boutique):
 * the Next Link onClick calls beginProductTransition, then Link navigates
 * itself unless preventDefault already ran.
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

function installDocument(startViewTransition?: (this: unknown, update: Update) => { finished: Promise<void> }) {
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
  };
  g.HTMLAnchorElement = AnchorEl;
  g.HTMLImageElement = ImageEl;
  g.document = doc;
  g.window = {
    matchMedia: () => ({ matches: false }),
    location: { origin: ORIGIN, pathname: HREF },
  };
  return { doc, hero };
}

function clickCard() {
  const img = track(new ImageEl());
  const anchor = new AnchorEl();
  anchor.href = HREF;
  anchor.img = img;
  const event = {
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    preventDefault() {
      this.defaultPrevented = true;
    },
    currentTarget: anchor,
  };
  const visits: string[] = [];
  beginProductTransition(event, () => {
    visits.push(`transition:${HREF}`);
  });
  if (!event.defaultPrevented) visits.push(`link:${HREF}`);
  return { event, img, visits };
}

async function whenApiExists() {
  let sawHeroName = false;
  let finished = Promise.resolve();
  const { doc, hero } = installDocument(function (this: unknown, update: Update) {
    if (this !== doc) throw new TypeError('Illegal invocation');
    const pending = update();
    sawHeroName = hero.style.viewTransitionName === 'tn-product';
    finished = Promise.resolve(pending).then(() => undefined);
    return { finished };
  });

  const extracted = doc.startViewTransition;
  assert.equal(typeof extracted, 'function');
  assert.throws(() => extracted!(() => undefined), /Illegal invocation/);

  const { event, img, visits } = clickCard();
  assert.equal(event.defaultPrevented, true, 'successful start owns the click');
  assert.deepEqual(visits, [`transition:${HREF}`], 'router.push runs once; Link does not also navigate');
  assert.equal(sawHeroName, true, 'hero shares the product transition name');
  await finished;
  await Promise.resolve();
  assert.equal(img.style.viewTransitionName, '', 'card name cleared after the transition');
  assert.equal(hero.style.viewTransitionName, '', 'hero name cleared after the transition');
}

function whenApiAbsent() {
  installDocument();
  const { event, img, visits } = clickCard();
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(visits, [`link:${HREF}`]);
  assert.equal(img.style.viewTransitionName, '');
}

function whenApiThrows() {
  let nameAtThrow = '';
  installDocument(function () {
    nameAtThrow = images
      .map((node) => node.style.viewTransitionName)
      .filter(Boolean)
      .join(',');
    throw new TypeError('Illegal invocation');
  });
  const { event, img, visits } = clickCard();
  assert.equal(nameAtThrow, 'tn-product', 'snapshot name is set before start');
  assert.equal(event.defaultPrevented, false, 'failed start must not cancel the link');
  assert.deepEqual(visits, [`link:${HREF}`]);
  assert.equal(img.style.viewTransitionName, '', 'name set for the snapshot is cleared when start throws');
}

async function main() {
  await whenApiExists();
  whenApiAbsent();
  whenApiThrows();
  console.log('product-transition.spec.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
