# کاهش JS مشترک layout عمده — TASK-20261101-shared-js-reduction

تاریخ: 2026-11-02 · شاخه `perf/TASK-20261101-shared-js-reduction` (پایه `f6af40a7`) · بدون merge/deploy

## نتیجه در یک نگاه

- JS اولیه (gzip، همه chunkهای همگام route) `/about` از **180.8 به 142.7 kB** (−21%)، `/` از 212.2 به 190.3 kB (−10%)، `/products` از 221.1 به 199.9 kB (−10%).
- JS اختصاصی layout عمده (بدون فریم‌ورک React/Next) از حدود **67 به 28.5 kB** رسید.
- TBT موبایل `/` از 275 به **87ms** (−68%)؛ CLS همچنان صفر.
- **معیار پذیرش LCP برآورده نشد**: `/about` 3321→3174ms (−4%) و `/` 3656→3623ms (−1%). دلیل و قدم بعدی پایین آمده است.

## روش اندازه‌گیری

- build: `next build` با env مثل CI (`NEXT_PUBLIC_API_URL=https://api.poshaktaranom.com`، `API_INTERNAL_URL=https://poshaktaranom.com/api/v1`)، اجرای standalone روی `PORT=3100` با `API_INTERNAL_URL=https://api.poshaktaranom.com/v1` (فقط GET واقعی).
- Lighthouse 12.8.2 موبایل، throttling پیش‌فرض (simulated)، `--headless=new --no-proxy-server`، ۳ اجرا، میانه. هر route یک بار قبل از اندازه‌گیری گرم شد.
- اندازه chunkها: gzip سطح ۹ روی فایل‌های `app-build-manifest.json` برای `/layout` + `/(wholesale)/layout` + صفحه؛ نسبت‌دهی ماژول با parse کردن chunkها (acorn) و اثرانگشت رشته‌ها.

## Lighthouse (میانه)

| صفحه | حالت | LCP | CLS | TBT | Score |
| --- | --- | --- | --- | --- | --- |
| `/` | master | 3656ms | 0 | 275ms | 83 |
| `/` | این شاخه | 3623ms | 0 | **87ms** | 89 |
| `/about` | master | 3321ms | 0 | 46ms | 92 |
| `/about` | این شاخه | 3174ms | 0 | 38ms | 93 |

مرجع تکمیلی (DevTools/applied throttling، فقط برای بررسی مدل):

| صفحه | master | این شاخه |
| --- | --- | --- |
| `/` (۳ اجرا) | LCP 2228ms · CLS 0.04 · TBT 493ms | LCP 2167ms · CLS 0.04 · TBT 280ms |
| `/about` (۴ اجرای یک‌درمیان A/B) | LCP 2069ms · CLS 0 · TBT 87ms | LCP 2029ms · CLS 0 · TBT 90ms |

CLS 0.04 در حالت applied روی `/` از قبل روی master هم هست (ربطی به این تغییر ندارد). Production (یک اجرا، simulated): `/` LCP 3003ms، `/about` LCP 3491ms.

## Bundle

First Load JS جدول `next build`: `/` 189→170 kB، `/products` 198→180 kB، `/about` 114→115 kB (این ستون chunkهای layout عمده را کامل حساب نمی‌کند)، shared by all 103→104 kB (+0.14 kB لودر `next/dynamic`).

Chunkهای layout قبل (gzip): `7761` 13.1 kB (`lib/cms/defaults` ۱۱ kB)، `layout` 12.6، `3599` 9.4 (جستجو، product-display، chrome hook، ticker)، `4445` 6.6 (tailwind-merge، root)، `3630` 6.2 (GA4 e-commerce + `lib/google`)، `1120` 6.0 (barrel `components/ui`: Badge/وضعیت سفارش، Input، Alert، Table، GlassButton)، `1575` 4.9 (storyboard همکار، تاریخ شمسی، page keys)، `8944` 4.7 (api/auth/roles/upload)، `1339` 3.3 (next/link).

بعد: `layout` 10.6، `4445` 6.6، `9398` 5.4 (جستجو، اینماد، ticker، chrome hook)، `1339` 3.3، `707` 2.6 (next/dynamic + آیکن‌ها).

## تغییرات

1. `lib/cms/chrome-defaults.ts` و `lib/cms/block-utils.ts`: پیش‌فرض chrome و helperهای خالص جدا شدند؛ `defaults.ts`/`fetch.ts` همان‌ها را re-export می‌کنند (خروجی یکسان، رشته‌ها کلمه‌به‌کلمه منتقل شد).
2. `apiClient` در `useMenus`، `EnamadSeal`، `ThemeRuntime`، `StorefrontSearch` و `cart-heartbeat` با `import()` و فقط هنگام استفاده بار می‌شود (همه فراخوانی‌ها از قبل async بودند). `product-display` در جستجو هنگام رسیدن نتایج.
3. `GoogleAnalytics`/`WebVitalsReporter` (خروجی null، observerها `buffered: true`)، `LandingPopups` (تا تریگر چیزی رندر نمی‌کند)، `FloatingContact` و `ScrollToTop` (fixed overlay) با `next/dynamic` و `ssr:false`. registry اسنپ‌شات سبد، رویداد cart-added و attribute مالک page_view به ماژول‌های کوچک منتقل شدند.
4. import مستقیم `Button`/`Modal`/`Input`/`Badge`/`Alert` به‌جای barrel در Header (فقط خط import)، MobileMenu، LandingPopups، بخش‌های هوم، کاتالوگ و جزئیات محصول.

فایل‌های ادعاشده تسک موازی (`WholesaleCategoryNav.tsx`، `MegaNav.tsx`، `header-nav-cls*`) دست نخوردند.

## رفتار و ریسک

- HTML سرور هدر، لینک‌ها و بالای صفحه بدون تغییر است. FloatingContact و ScrollToTop دیگر در HTML سرور نیستند و بعد از hydration ظاهر می‌شوند؛ هر دو `position: fixed` هستند، پس CLS ندارند (اندازه‌گیری: CLS صفر).
- اولین جستجو/heartbeat/fallback تنظیمات یک chunk کوچک اضافه می‌گیرد (چند ده میلی‌ثانیه روی شبکه کند).
- `LandingPopups` همچنان روی همه مسیرها mount می‌شود (مثل قبل) تا رفتار متغیر `--wholesale-bottom-bar` عوض نشود.

## چرا LCP بیشتر جابه‌جا نشد

LCP شبیه‌سازی‌شده (Lantern) هر درخواستی را که پیش از LCP مشاهده‌شده شروع شده حساب می‌کند. روی localhost کل صفحه، hydration و حتی chunkهای defer‌شده پیش از اولین paint تمام می‌شوند (LCP مشاهده‌شده ≈ FCP ≈ ۲۰۰–۴۴۰ms). روی `/about` حدود ۳۸۳ kB پیش از LCP درخواست می‌شود: JS ۱۵۲ kB (۱۰۱ kB آن فریم‌ورک React/Next و غیرقابل حذف)، CSS render-blocking ۳۱ kB، فونت Vazirmatn ۴۷ kB (preload، VeryHigh) و تصاویر خود `/about` حدود ۱۲۰ kB (poster ویدیو ۲۹ kB با اولویت Medium + سه تصویر پایین‌تر ۶۷ kB که Chrome به‌خاطر فاصله lazy-load زود می‌گیرد). حتی حذف کامل JS اختصاصی layout فقط حدود ۱۰۰–۱۵۰ms از LCP شبیه‌سازی‌شده کم می‌کند.

## پیشنهاد قدم بعد (خارج از دامنه این تسک)

1. `/about` v3: poster ویدیو و تصاویر story/process پایین‌تر از fold را دیرتر بار کنید (مالک about v3).
2. گراف کارت محصول (`WholesaleProductCard` → `WholesaleQuickOrder`، `apiClient`، `retail-analytics`) روی `/` و `/products` هنوز حدود ۱۲ kB همگام بار می‌کند؛ lazy کردن quick-order روی تعامل (کارت پوشش e2e دارد).
3. tailwind-merge (۶.۶ kB) از طریق `cn` در root layout.
4. تقسیم CSS سراسری (۲۵ kB) و بررسی preload فونت در برابر `display: optional`.

## Gateها

- `npx tsc --noEmit` سبز؛ `npm run build` سبز.
- Web unit suite CI (۴ spec) سبز؛ `news-ticker.spec`، `web-vitals-gate.spec` سبز. `retail-analytics.spec` روی master هم با همان assertion (UTM `utm_medium=cpc`) قرمز است و در CI اجرا نمی‌شود.
- e2e (`playwright.product-card.config.ts`، mock API 4110، standalone 3100): ۹ پاس، ۱ skip، ۴ شکست محیطی: کارت‌های retail به `http://localhost.ir:3000` می‌روند؛ CI این هاست را به `/etc/hosts` اضافه می‌کند ولی روی این ویندوز `localhost.ir` به IP عمومی resolve می‌شود و پورت 3000 متعلق به agent دیگری است.
