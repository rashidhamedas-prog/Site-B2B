import React from 'react';
import { renderToString } from 'react-dom/server';
import { HERO_DESKTOP_MEDIA, HERO_MOBILE_MEDIA, StorefrontHeroMedia } from './StorefrontHeroMedia';
import { heroSlideLayerClass } from './HeroCarousel';

// Outside `next build` the loader cannot see next.config remotePatterns; `test` skips that dev-only host check.
(process.env as Record<string, string>).NODE_ENV = 'test';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function renderDocument(node: React.ReactNode): { head: string; body: string } {
  const html = renderToString(
    <html>
      <head />
      <body>{node}</body>
    </html>
  );
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body>'), html.indexOf('</body>'));
  return { head, body };
}

function imagePreloads(head: string): string[] {
  return (head.match(/<link[^>]*rel="preload"[^>]*>/g) || []).filter((l) => l.includes('as="image"'));
}

// ── Slide 0, local pre-optimized plates (live /banners/* path) ─────────────
const lcp = renderDocument(
  <div className={heroSlideLayerClass(true, false)}>
    <StorefrontHeroMedia
      src="/banners/outerwear-2026/retail-desktop.webp"
      mobileSrc="/banners/outerwear-2026/retail-mobile.webp"
      alt="مدل با کاپشن زنانه شتری لوزی‌دوزی‌شده پوشاک ترنم"
      className="object-cover"
      priority
    />
  </div>
);
const lcpPreloads = imagePreloads(lcp.head);

assert(lcpPreloads.length === 2, `slide 0 must preload exactly mobile + desktop plates, got ${lcpPreloads.length}`);
const mobilePreload = lcpPreloads.find((l) => l.includes(`media="${HERO_MOBILE_MEDIA}"`));
const desktopPreload = lcpPreloads.find((l) => l.includes(`media="${HERO_DESKTOP_MEDIA}"`));
assert(
  Boolean(mobilePreload?.includes('href="/banners/outerwear-2026/retail-mobile.webp"')),
  'mobile preload must target the mobile plate under (max-width: 767px)'
);
assert(
  Boolean(desktopPreload?.includes('href="/banners/outerwear-2026/retail-desktop.webp"')),
  'desktop preload must target the desktop plate under (min-width: 768px)'
);
assert(
  lcpPreloads.every((l) => /fetchpriority="high"/i.test(l)),
  'hero preloads must be fetchpriority=high'
);
assert(lcp.body.includes('loading="eager"'), 'slide 0 must be eager');
assert(lcp.body.includes('fetchPriority="high"'), 'slide 0 img must be high priority');
assert(!lcp.body.includes('decoding="async"'), 'slide 0 must use default decoding');
assert(
  lcp.body.includes(`media="${HERO_DESKTOP_MEDIA}"`) &&
    lcp.body.includes('srcSet="/banners/outerwear-2026/retail-desktop.webp"'),
  'desktop art direction must be the (min-width: 768px) picture source'
);
assert(
  lcp.body.includes('src="/banners/outerwear-2026/retail-mobile.webp"'),
  'mobile art direction must be the fallback img source'
);
assert(
  !/opacity-|transition-|scale-|animate-/.test(lcp.body),
  'slide 0 first paint must carry no opacity, transition, transform, or animation classes'
);
assert(lcp.body.includes('alt="مدل با کاپشن زنانه شتری'), 'descriptive CMS alt must render');

// ── Slide 0, remote (optimizer) plates: preloads carry each srcset ──────────
const remote = renderDocument(
  <StorefrontHeroMedia
    src="https://storage.poshaktaranom.com/hero/desktop.jpg"
    mobileSrc="https://storage.poshaktaranom.com/hero/mobile.jpg"
    alt="هیرو"
    className="object-cover"
    priority
  />
);
const remotePreloads = imagePreloads(remote.head);
assert(remotePreloads.length === 2, `remote slide 0 must preload 2 plates, got ${remotePreloads.length}`);
const remoteMobile = remotePreloads.find((l) => l.includes(`media="${HERO_MOBILE_MEDIA}"`)) || '';
assert(
  /imagesrcset="[^"]*mobile\.jpg/i.test(remoteMobile) && /imagesizes="100vw"/i.test(remoteMobile),
  'remote mobile preload must carry the mobile srcset with sizes=100vw'
);
assert(
  /srcSet="[^"]*desktop\.jpg[^"]*"/.test(remote.body) && remote.body.includes(`media="${HERO_DESKTOP_MEDIA}"`),
  'remote desktop srcset must be the (min-width: 768px) picture source'
);

// ── Single plate: one preload, no media split ──────────────────────────────
const single = renderDocument(
  <StorefrontHeroMedia src="/retail/hero-model.webp" alt="" className="object-cover" priority />
);
const singlePreloads = imagePreloads(single.head);
assert(singlePreloads.length === 1 && !singlePreloads[0]!.includes('media='), 'single plate must preload once without media');

// ── Later slides ───────────────────────────────────────────────────────────
const later = renderDocument(
  <StorefrontHeroMedia
    src="/banners/outerwear-2026/wholesale-desktop.webp"
    mobileSrc="/banners/outerwear-2026/wholesale-mobile.webp"
    alt="مدل با کاپشن زنانه قهوه‌ای لوزی‌دوزی‌شده تولیدی پوشاک ترنم"
    className="object-cover"
    priority={false}
  />
);

assert(imagePreloads(later.head).length === 0, 'slides after 0 must not be preloaded');
assert(later.body.includes('loading="lazy"'), 'slides after 0 must be lazy');
assert(later.body.includes('fetchPriority="auto"'), 'slides after 0 must not claim high priority');
assert(later.body.includes('alt="مدل با کاپشن زنانه قهوه‌ای'), 'wholesale CMS alt must render');

assert(
  heroSlideLayerClass(true, true).includes('transition-opacity'),
  'cross-fade must still apply once the carousel has advanced'
);

console.log('StorefrontHeroMedia.spec.tsx: OK');
