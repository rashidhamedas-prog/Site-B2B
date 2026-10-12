import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorefrontHeroMedia } from './StorefrontHeroMedia';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const lcp = renderToStaticMarkup(
  <StorefrontHeroMedia
    src="/banners/outerwear-2026/retail-desktop.webp"
    mobileSrc="/banners/outerwear-2026/retail-mobile.webp"
    alt="مدل با کاپشن زنانه شتری لوزی‌دوزی‌شده پوشاک ترنم"
    className="object-cover"
    priority
  />
);

assert(lcp.includes('loading="eager"'), 'slide 0 must be eager');
assert(lcp.includes('fetchPriority="high"'), 'slide 0 must be high priority');
assert(
  lcp.includes('media="(min-width: 768px)"') &&
    lcp.includes('srcSet="/banners/outerwear-2026/retail-desktop.webp"'),
  'desktop art direction must be a mutually exclusive picture source'
);
assert(
  lcp.includes('src="/banners/outerwear-2026/retail-mobile.webp"'),
  'mobile art direction must be the fallback img source'
);
assert(
  (lcp.match(/rel="preload"/g) || []).length === 0,
  'hero markup must not manually preload a viewport-mismatched asset'
);
assert(lcp.includes('alt="مدل با کاپشن زنانه شتری'), 'descriptive CMS alt must render');

const later = renderToStaticMarkup(
  <StorefrontHeroMedia
    src="/banners/outerwear-2026/wholesale-desktop.webp"
    mobileSrc="/banners/outerwear-2026/wholesale-mobile.webp"
    alt="مدل با کاپشن زنانه قهوه‌ای لوزی‌دوزی‌شده تولیدی پوشاک ترنم"
    className="object-cover"
    priority={false}
  />
);

assert(later.includes('loading="lazy"'), 'slides after 0 must be lazy');
assert(later.includes('fetchPriority="auto"'), 'slides after 0 must not claim high priority');
assert(later.includes('alt="مدل با کاپشن زنانه قهوه‌ای'), 'wholesale CMS alt must render');

console.log('StorefrontHeroMedia.spec.tsx: OK');
