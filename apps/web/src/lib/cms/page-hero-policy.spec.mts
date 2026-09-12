import {
  isHomePageKey,
  resolveHeroImageUrl,
  resolvePageHeroSlides,
  shouldInjectHomeCampaign,
} from './page-hero-policy.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isHomePageKey('home') === true, 'home key matches');
assert(isHomePageKey(' about ') === false, 'trimmed about is not home');
assert(shouldInjectHomeCampaign('home') === true, 'home injects');
assert(shouldInjectHomeCampaign('about') === false, 'about does not inject');
assert(shouldInjectHomeCampaign('contact') === false, 'contact does not inject');
assert(shouldInjectHomeCampaign('wholesale') === false, 'wholesale terms do not inject');
assert(shouldInjectHomeCampaign('blog') === false, 'blog does not inject');
assert(shouldInjectHomeCampaign('') === false, 'missing scope fails closed');
assert(shouldInjectHomeCampaign(undefined) === false, 'undefined scope fails closed');

assert(
  resolveHeroImageUrl('home', '', '/retail/hero-model.webp') === '/retail/hero-model.webp',
  'home may use fallback plate',
);
assert(resolveHeroImageUrl('about', '', '/retail/hero-model.webp') === '', 'about must not steal home plate');
assert(
  resolveHeroImageUrl('contact', '/banners/contact.webp', '/retail/hero-model.webp') === '/banners/contact.webp',
  'inner page keeps its own image',
);

const injected = resolvePageHeroSlides('home', ['page'], (slides) => ['campaign', ...slides]);
assert(injected[0] === 'campaign' && injected[1] === 'page', 'home prepends campaign');

const inner = resolvePageHeroSlides('about', ['page'], (slides) => ['campaign', ...slides]);
assert(inner.length === 1 && inner[0] === 'page', 'about ignores campaign inject fn');

console.log('page-hero-policy.spec.mts: OK');
