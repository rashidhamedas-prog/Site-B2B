# رفع ریشه‌ای سرعت / CWV موبایل (تک + عمده)

تاریخ: ۲۰۲۶-۱۰-۱۰  
تسک: `TASK-20261010-003`  
عمق: skill-top **full** · ECC `react-performance` · website-architecture (بازنگری مرز کش/ISR)

## وضعیت داده

| منبع | وضعیت |
|------|--------|
| Windsor `googleanalytics4` | متصل — عمده `547352333`، تکی `547378194` |
| Windsor `searchconsole` | **متصل نیست** — فقط لینک OAuth آماده شد |
| GSC Wizard MCP | نیاز به auth در Cursor |
| PSI عمومی | 429 (rate limit) در این نشست |
| CrUX API بدون کلید | 403 |

برای خواندن مستقیم «سرعت سایت» کنسول باید Search Console را در Windsor وصل کرد:  
https://onboard.windsor.ai/connect?connector=searchconsole&client=CURSOR&next=/searchconsole/authorize

## شواهد زنده قبل از دیپلوی

| بررسی | نتیجه |
|--------|--------|
| `Cache-Control` HTML | `public, s-maxage=60, stale-while-revalidate=86400` (قبلاً درست شده) |
| CF `.ir` | اغلب `DYNAMIC` (HTML لبه‌ای کش نمی‌شد) |
| CF `.com` | گاهی `EXPIRED` / `MISS` |
| Warm timer VPS | `taranom-warm-homes.timer` **active** |
| Origin هوم | TTFB ≈ ۱۵ms |
| Origin `/products` | TTFB ≈ ۷۸ms |
| HTML هوم | ≈ ۲۰۷–۲۲۷KB |
| Lead catalog `_next/image` | `src` با `w=1920` ≈ ۵۶KB؛ همان منبع با `w=640` ≈ ۲۵KB |
| هیرو تکی mobile WebP | ≈ ۷۰KB |

GA4 (۲۸ روز، Windsor): bounce هوم عمده ≈ ۴۲٪؛ landing تکی اغلب `(not set)` (مشکل measurement قبلی / TASK-20261010-002).

## ریشه‌ها (اولویت)

1. **TTFB میدانی:** HTML روی Cloudflare برای `.ir` عملاً edge-HIT نمی‌گرفت؛ وابستگی به warm origin. SWR بلند در origin هست، اما بدون `CDN-Cache-Control` کافی نبود.
2. **LCP کاتالوگ:** fallback `deviceSizes` تا ۱۹۲۰ + کیفیت پیش‌فرض ۷۵ روی کارت ≈ نصف‌عرض موبایل.
3. **کاتالوگ عمده دینامیک:** `generateMetadata({ searchParams })` بدون `force-static` → ISR ضعیف‌تر از تکی.
4. **JS تکی:** `CartProvider` عمده روی root همه کانال‌ها را hydrate می‌کرد.
5. **INP عمده:** `LandingPopups` exit-intent روی touch هم `mouseout` می‌گرفت.

## تغییرات

| فایل | تغییر |
|------|--------|
| `storefront-html-cache.ts` + middleware | `CDN-Cache-Control` / `Cloudflare-CDN-Cache-Control` |
| `next.config.ts` | حذف `1920` از `deviceSizes` (سقف ۱۲۰۰) |
| `(wholesale)/products/page.tsx` | `force-static` + metadata بدون `searchParams` |
| `layout.tsx` / wholesale / `checkout/layout.tsx` | `CartProvider` فقط عمده + چک‌اوت |
| کارت‌های کاتالوگ | `quality=65` + `CATALOG_CARD_IMAGE_SIZES` |
| `LandingPopups.tsx` | exit-intent فقط `pointer: fine`؛ تأخیر موبایل ≥۱۲s |

## تست مشاهده‌شده

| فرمان | نتیجه |
|--------|--------|
| `npx tsx apps/web/src/lib/catalog-performance.spec.ts` | ok |
| `npx tsx --test apps/web/src/lib/storefront-html-cache.spec.ts` | 2 pass |
| `npx tsc --noEmit -p apps/web` | exit 0 |

## Non-goals

- بازطراحی لندینگ (web-sdd)
- فعال‌سازی دوبارهٔ قانون CF «Cache Everything HTML» از داشبورد (جایگزین header)
- Measurement Protocol / GA4 DebugView
- دست زدن به منطق stock فیلتر رنگ (TASK-20261006-001)

## Rollback

Revert commit این تسک؛ warm timer را دست نزنید.
