import { isHomePageKey, resolveHeroImageUrl, resolvePageHeroSlides } from './page-hero-policy.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isHomePageKey('home') === true, 'home key matches');
assert(isHomePageKey(' about ') === false, 'trimmed about is not home');

assert(
  resolveHeroImageUrl('home', '', '/retail/hero-model.webp') === '/retail/hero-model.webp',
  'home may use fallback plate'
);
assert(
  resolveHeroImageUrl('about', '', '/retail/hero-model.webp') === '',
  'about must not steal home plate'
);
assert(
  resolveHeroImageUrl('contact', '/banners/contact.webp', '/retail/hero-model.webp') ===
    '/banners/contact.webp',
  'inner page keeps its own image'
);

const ordered = ['cms-first', 'cms-second'];
const resolved = resolvePageHeroSlides(ordered);
assert(resolved === ordered, 'CMS array identity is preserved');
assert(resolved[0] === 'cms-first' && resolved[1] === 'cms-second', 'CMS order is authoritative');

console.log('page-hero-policy.spec.mts: OK');
