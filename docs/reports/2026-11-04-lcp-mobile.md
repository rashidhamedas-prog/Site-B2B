# Mobile LCP — art-directed hero preload (TASK-20261104-lcp-mobile)

Branch `perf/lcp-mobile`. Source brief: `prompt-lcp-mobile.md` (CrUX: mobile LCP group 2.9s, 53 URLs, sample `/`).

## Root cause in code

- Live hero plates are local `/banners/*.webp`. `StorefrontHeroMedia` rendered them as a raw `<img>`, so neither host had any `<link rel="preload" as="image">`.
- For remote plates, Next `priority` preloaded the desktop `src` while phones paint the `(max-width: 767px)` `<source>`.
- Slide 0's layer carried `transition-opacity` / `opacity-100`, the image `scale-[1.02]`, and the copy `animate-fade-in`.
- PDP main image kept `priority` for every gallery item.

## Change

| Area | Change |
| --- | --- |
| `StorefrontHeroMedia` | One `<picture>` for local and remote plates (`getImageProps` srcset for remote). Slide 0 calls `ReactDOM.preload` per plate with `media` that mirrors the sources, `fetchPriority: 'high'`, and `imageSrcSet`/`imageSizes="100vw"` for optimizer plates. Default `decoding` on slide 0. |
| `HeroCarousel` | `hasAdvanced` flag; `heroSlideLayerClass` gives slide 0 a plain layer until the first slide change. Autoplay arms only after `load` + idle. |
| `RetailHero` / `HeroSection` | Use the layer helper; `scale-[1.02]` removed; copy fade only after the carousel moves. |
| PDP (retail + wholesale) | `priority` only for gallery index 0. |
| `next.config` | `images.formats: ['image/avif', 'image/webp']`. |
| CI | `StorefrontHeroMedia.spec.tsx` added to the web unit step. |

Already compliant and unchanged: home product grids (no `imagePriority`), `RetailCategoryBannerGrid` (`fill` + `aspect-[4/5]`, lazy, `fetchPriority="low"`), wholesale category thumbs (48px fixed), blog list/post (one priority each), and hero frame height (CSS `aspect-ratio` + `max-height`).

## Evidence

HTML (local production build, standalone server, mobile UA, `Host:` header):

- `poshaktaranom.com`: 2 image preloads (`(max-width: 767px)` mobile, `(min-width: 768px)` desktop) inside `<head>`; exactly one `<img fetchpriority="high">`.
- `poshaktaranom.ir`: same.
- master: 0 image preloads on both hosts.

Lighthouse 12.8.2, mobile, simulated throttling, Chrome `--disable-gpu` (headless GPU startup on this Windows host delays the first frame by 1.1–1.9s even on a static HTML page), 3 runs per host, real hostnames mapped to the local server:

| Build | Host | LCP (ms) | FCP (ms) | Image load delay (ms) | LCP element |
| --- | --- | --- | --- | --- | --- |
| master | .com | 3963 / 3228 / 4712 | ~2300 | 0–298 | hero mobile plate |
| branch | .com | 3957 / 4116 / 3918 | ~2310 | 0–36 | hero mobile plate |
| master | .ir | 4111 / 4110 / 4115 | ~2300 | 246–431 | hero mobile plate |
| branch | .ir | 4048 / 4105 / 4103 | ~2300 | 88–125 | hero mobile plate |

CLS 0 on all runs. Unit: `StorefrontHeroMedia.spec.tsx` OK, the CI web unit specs OK, `catalog-performance.spec.ts` OK, `tsc --noEmit` exit 0, `next build` exit 0.

## Acceptance status

- Image preload in HTML on both hosts: **met**.
- One `fetchpriority="high"` image: **met**.
- Lighthouse mobile LCP < 2.0s: **not met**. Image discovery is fixed (load delay about 0), but simulated FCP is already about 2.3s on both builds, and LCP cannot be lower than FCP. The remaining LCP is Lantern render delay. The page's early critical path is a 17.5KB (117KB raw) document with inline RSC payload, four render-blocking CSS files (31.5KB), about 200KB of JS fetched before the hero paints, and a 47KB font. Lighthouse flags the main CSS file at about 460–620ms of render-blocking savings.

Next levers (separate task): inline critical CSS or merge the four route CSS files, trim the inline RSC payload on `/`, and keep GTM out of the first 2s.
