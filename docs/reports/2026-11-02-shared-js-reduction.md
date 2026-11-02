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

## دور دوم: حمله مستقیم به LCP (تصمیم حامد: فعلاً merge نشود)

**نتیجه: هیچ تغییر کدی نگه داشته نشد؛ معیار پذیرش LCP بدون تغییر طراحی/رفتار قابل دستیابی نیست.** دلیل با عدد پایین آمده است.

### میانه‌ها (۳ اجرا، simulated، همان setup)

| صفحه | baseline دور اول (`f6af40a7`) | master فعلی (`39fd1b2d`، با #157) | این شاخه (`82d0423b`) | هدف |
| --- | --- | --- | --- | --- |
| `/` LCP | 3656ms | 3644ms | 3664ms | ≤ 2925ms |
| `/` TBT / CLS | 275ms / 0 | 173ms / 0 | 134ms / 0 | |
| `/about` LCP | 3321ms | 3324ms | 3222ms | ≤ 2657ms |
| `/about` TBT / CLS | 46ms / 0 | 53ms / 0 | 39ms / 0 | |

### عنصر LCP و تفکیک فازها (اجرای میانه)

| صفحه | عنصر LCP | TTFB | Load Delay | Load Time | Render Delay |
| --- | --- | --- | --- | --- | --- |
| `/` master | `img` اسلاید اول هیرو (`wholesale-mobile-*.webp`، ۲۸ kB، `fetchpriority=high`، eager) | 457 | 0 | 0 | **3187** |
| `/` شاخه | همان | 456 | 0 | 0 | **3208** |
| `/about` master | `img.av3-hero-img` (`/_next/image` w=750، ۱۶ kB، `fetchpriority=high`) | 455 | 70 | 125 | **2674** |
| `/about` شاخه | همان | 455 | 61 | 142 | **2563** |

تصویر LCP در هر دو صفحه درست است: یک `priority`، eager، بدون lazy، بدون background CSS، و در ~۴۰ms اول درخواست می‌شود (همراه CSS). فاز غالب **Render Delay** است. CSS render-blocking در هر دو صفحه ۴ فایل و ۳۰ kB gzip است (`44194651` ۲۴.۹ kB سراسری). فونت preload نمی‌شود (در production هم preload ندارد) و `display: optional` است. هیرو در SSR بدون opacity صفر رندر می‌شود (فقط متن `animate-fade-in` دارد که عنصر LCP نیست).

### چرا Render Delay این‌قدر بزرگ است

- در trace محلی، فریم اول با تصویر هیرو حدود ۱۴۸ms آماده است، ولی swap فریم در Chrome headless ویندوز تا ~۲۹۲ms طول می‌کشد (`StartDrawToSwapStart` ≈ ۱۴۴ms). پس LCP مشاهده‌شده ۲۲۱–۳۵۶ms است، یعنی بعد از دانلود و اجرای همه chunkهای همگام، بعد از `load`، و حتی بعد از درخواست favicon/آیکن manifest.
- Lantern هر درخواست شبکه‌ای را که پیش از LCP مشاهده‌شده تمام شده (به‌جز تصاویر Low) و هر اسکریپتی را که پیش از آن evaluate شده در گراف LCP می‌گذارد (`LargestContentfulPaint.getOptimisticGraph`/`getPessimisticGraph` در `@paulirish/trace_engine`). در نتیجه LCP شبیه‌سازی‌شده ≈ زمان دانلود کل doc (۳۴–۳۹ kB) + CSS (۳۰) + JS (۱۵۲–۲۱۴) + فونت (۴۷) + تصاویر غیر Low، به‌علاوه CPU ×۴.
- اولین Layout روی این ماشین ۷۳–۸۹ms است (فقط ~۵۰۰–۶۰۰ آبجکت؛ هزینه اولیه font fallback ویندوز)، که در شبیه‌سازی ×۴ می‌شود.

### حساسیت (اجرای مجدد Lantern روی artifactهای ذخیره‌شده با حذف درخواست)

| حذف آزمایشی | `/` | `/about` |
| --- | --- | --- |
| هیچ (پایه همین artifact) | 3721 | 3207 |
| فونت Vazirmatn (۴۷ kB) | −180 | −229 |
| همه JS غیر فریم‌ورک | −1014 | −298 |
| chunkهای dynamic بعد از hydration (GA، popups، floating، scroll-top) | −240 | ~0 (بعد از LCP بار می‌شوند) |
| `icon-192.png` (آیکن manifest، درخواست خود Chrome بعد از load) | −155 | 0 |
| poster ویدیو | — | −79 |
| لوگوی هدر | −135 | −75 |
| هر chunk تکی ~۵ kB | ~−25 | — |

**سقف‌ها:** `/about` حتی با حذف کامل poster، لوگو و **همه** JS غیر فریم‌ورک = 2682ms (> 2657). `/` با بهترین حذف‌های ممکن (chunkهای dynamic، آیکن‌ها، لوگو، گراف کارت محصول) = 3152ms، و با حذف فونت هم 3002ms (> 2925).

### تغییرهای بررسی‌شده و کنارگذاشته (زیر ۳٪ یا تغییر رفتار)

- بازفشرده‌سازی بی‌اتلاف `icon-192.png` (palette، بدون تغییر پیکسل، ۲۰→۱۳.۹ kB): حدود −۴۵ms (~۱٪).
- defer کردن `LandingPopups` تا بعد از load: در شبیه‌سازی ۰.
- defer کردن GA تا بعد از load: −۱۵ تا −۱۷۰ms (فقط همراه بقیه)، ولی زمان‌بندی page_view عوض می‌شود (کد صریحاً می‌گوید page_view دیر = لندینگ خالی). رد شد.
- favicon به‌صورت data URI: Google Search favicon را از URL قابل crawl می‌خواند. رد شد.
- preload فونت: فونت را زودتر وارد گراف می‌کند (بدتر).
- AVIF هیرو / کوچک‌کردن srcset کارت‌ها: کمتر از ۲٪ و پیکسل‌ها عوض می‌شوند.
- تقسیم CSS سراسری بین storefront/admin: Lighthouse ۲۰ kB «استفاده‌نشده در load» می‌بیند ولی بیشترش hover/responsive/مسیرهای دیگر است. بازدهی واقعی حدود ۵–۸ kB (~۱.۵٪) با ریسک بالای استایل admin.

### برای رسیدن به هدف چه لازم است (همه خارج از «بدون تغییر طراحی/رفتار»)

1. حذف یا دیرکرد فونت Vazirmatn در بازدید اول (تایپوگرافی عوض می‌شود): −۱۸۰ تا −۲۳۰ms.
2. بار کردن GA و همه islandها بعد از `load`/idle (زمان page_view و نمایش دکمه تماس عوض می‌شود): حدود −۲۴۰ms روی `/`.
3. برداشتن `icon-192` از manifest یا کوچک‌کردن شدید آن (روی نصب PWA اثر دارد): −۱۵۵ms روی `/`.
4. یا تغییر روش سنجش: اجرای Lighthouse روی Linux/CI یا PSI/داده میدانی. آنجا فریم اول نزدیک لحظه آماده‌شدن present می‌شود و اسکریپت‌هایی که بعد از paint اجرا شده‌اند از گراف LCP بیرون می‌مانند. فقط (1)+(2)+(3) با هم هدف `/` را نزدیک می‌کنند. `/about` حتی با این‌ها هم بدون حذف JS رفتاری به ≤2657 نمی‌رسد.

## Gateها

- `npx tsc --noEmit` سبز؛ `npm run build` سبز.
- Web unit suite CI (۴ spec) سبز؛ `news-ticker.spec`، `web-vitals-gate.spec` سبز. `retail-analytics.spec` روی master هم با همان assertion (UTM `utm_medium=cpc`) قرمز است و در CI اجرا نمی‌شود.
- e2e (`playwright.product-card.config.ts`، mock API 4110، standalone 3100): ۹ پاس، ۱ skip، ۴ شکست محیطی: کارت‌های retail به `http://localhost.ir:3000` می‌روند؛ CI این هاست را به `/etc/hosts` اضافه می‌کند ولی روی این ویندوز `localhost.ir` به IP عمومی resolve می‌شود و پورت 3000 متعلق به agent دیگری است.
