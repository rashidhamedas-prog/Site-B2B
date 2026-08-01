# Worklog — پلتفرم ترنم B2B

> **قانون پروژه:** بعد از هر تغییر معنادار (با Cursor یا Claude Code)، یک ورودی در این فایل و در صورت نیاز یک گزارش جلسه در `docs/reports/` اضافه شود. سپس commit در git.

## 2026-08-01 — API همگام‌سازی سفارش ترب (JSON)

### خلاصه

- پیاده‌سازی `GET /torob/v1/orders` طبق Torob-Sync (JWT EdDSA + JSON)
- ذخیره `torob_clid` از کوئری/کوکی ۷روزه روی سفارش تکی
- تمایز واضح فید XML محصولات vs API JSON سفارش در ادمین و docs
- کلید `torobOrderSyncEnabled` در تنظیمات مارکتینگ

---

## 2026-08-01 — دسته‌بندی لوکس صفحه اصلی تکی

### خلاصه

- بنر لوکس برای ۱۰ دسته (WebP) در `/banners/category-luxury-2026/`
- بلوک `categoryBanners` بلافاصله بعد از هیرو؛ لینک مستقیم `/products?categoryId=`
- نمایش همه محصولات در هوم (limit 200 / newest)
- به‌روزرسانی CMS منتشرشده روی سرور

---

## 2026-08-01 — اینماد در تنظیمات عمده و تکی

### خلاصه

- تنظیمات کسب‌وکار: بخش اینماد جدا برای عمده و تکی (enabled، id، Code، لینک، آپلود تصویر، HTML snippet)
- چسباندن HTML پنل → استخراج خودکار id/Code؛ رندر امن ساختاریافته در فوتر
- ذخیره business با merge تا فیلدهای اینماد از بین نرود
- API `business.enamadWholesale` / `enamadRetail` در admin و public
- نمایش نشان در فوتر عمده و تکی (`EnamadSeal`) + پیش‌نمایش در ادمین
- چک‌لیست Owner در `docs/USER-ACTIONS-B2C.md`

---

## 2026-07-31 — Hardening جزئی (Tasks 1–4 کد + handoff)

### خلاصه

- پلن `cursor-project-hardening-plan.md` به‌صورت جزئی اجرا شد (بدون rotate/history rewrite/deploy)
- OTP → Redis+hash، fail-closed در production، IDOR و DTO برای auth/order/payment
- Checkout: shipping فقط سرور، موجودی/کیف‌پول/تخفیف atomic، idempotencyKey، state guard
- Payment: مبلغ از DB، match authority، sync order/invoice، unique indexes
- UX: حذف محصولات ساختگی retail؛ Modal با focus trap
- Handoff کامل برای ChatGPT: `docs/chatgpt-hardening-handoff.md`
- گزارش: `docs/reports/2026-07-31-hardening-partial.md`

### تست

- API `tsc --noEmit` OK
- `auth.otp.logic.spec.ts` OK

### باقی‌مانده

- Task 1 ops (rotate + filter-repo) با تأیید مالک
- QueryRunner واحد کامل، Company Account، Playwright، observability، backup

---

## 2026-07-31 — فاز ۲ سرعت: SSR تکی + list بدون variants + chunk کانال

### خلاصه

- `RetailProductGrid` و `RetailCategoryBannerGrid` از client waterfall به SSR (`revalidate: 300`) تبدیل شدند
- `GET /products` عمومی: بدون join variants (ادمین با `status=ALL` همچنان variants دارد) + Cache-Control
- `SiteBlocksRenderer` با dynamic import جداگانهٔ `RetailBlocksRenderer` / `WholesaleBlocksRenderer`
- فاز ۱ روی VPS تأیید/rebuild شد (`a1e3351`)

### hotfix (همان روز)

- Cache-Control با `res.setHeader` روی Fastify باعث `500` روی `/products` و `/settings/public` شد
- اصلاح به `FastifyReply.header(...)` در product / settings / category controllers

---

## 2026-07-30 — متن پیامک قابل‌ویرایش + بهینه‌سازی سرعت (فاز ۱)

### SMS

- همه متن‌های پیامک رویدادها در ادمین → تنظیمات → پیامک قابل ویرایش
- پیش‌فرض‌ها همان متن‌های فعلی production + دکمه بازگردانی پیش‌فرض
- Placeholderها: `{orderNumber}` `{trackingLine}` `{amountToman}` `{refId}` `{customerName}` `{phone}` `{site}` `{greet}` `{code}` …

### Performance (فاز ۱)

- هیرو/بنر دسته: PNG چندمگابایتی → WebP (~10–85KB) + PNG فشرده
- هیرو عمده: `next/image`؛ فقط اسلایدهای مجاور
- هیرو تکی: حذف opacity gate؛ فقط اسلایدهای مجاور
- فونت: preload فقط Regular+Bold
- `/settings/public` Cache-Control + TTL ۶۰ث؛ GSC `revalidate: 3600`
- پیکسل‌های تکی با تأخیر idle

### باقی‌مانده

- SSR گرید تکی، chunk split کانال، Brotli، list بدون variants، Lighthouse CI

---

## 2026-07-30 — بازیابی لیست محصولات (ستون viewCount)

### علت

- Deploy کد با فیلد `viewCount` روی entity، ولی ستون در Postgres ساخته نشده بود (`DB_SYNC=false`)
- API لیست محصولات خطا می‌داد → ادمین صفر نشان می‌داد؛ داده‌ها حذف نشده بودند (۵۱ فعال در DB)

### رفع

- `ALTER TABLE products ADD COLUMN "viewCount"` (+ index) و `categories.bannerUrl` روی VPS
- اسکریپت `apply-production-schema.sql` و `auto-deploy.sh` به‌روز شد تا بعد از هر deploy ستون‌ها اعمال شوند

---

## 2026-07-30 — Deploy خودکار + CRM/پربازدید/بنر دسته روی تولید

### خلاصه

- قانون: بعد از هر تغییر معنادار → WORKLOG + commit + push + auto-deploy روی VPS
- ثبت در `docs/conventions.md`، `CLAUDE.md`، `.cursor/rules/auto-deploy.mdc`
- فیچر CRM فعال‌سازی مجدد، viewCount، ۱۲ پربازدید، categoryBanners ۳×۳
- **Deploy تولید:** `adbcad5` روی VPS — API health ok، `.com` و `.ir` HTTP 200

---

## 2026-07-30 — CRM فعال‌سازی مجدد + پربازدید + بنر دسته

### خلاصه

- CRM: دکمه «فعال کردن» برای مشتری `INACTIVE` در لیست مشتریان
- محصول: ستون `viewCount` + `POST /products/:id/view` + مرتب‌سازی `sort=views`
- صفحه اصلی تکی: بلوک محصولات پیش‌فرض ۱۲ پربازدید؛ بلوک جدید `categoryBanners` شبکه ۳×۳
- دسته: فیلد `bannerUrl` در ادمین دسته‌ها؛ بنرهای نمونه در `/banners/category-2026/`
- قانون پروژه: هر تغییر ویترین باید در ادمین (site-content / settings / entity) قابل ویرایش باشد

### فایل‌های کلیدی

- `AdminCustomers.tsx`, `product.entity.ts`, `product.service.ts`, `RetailProductDetail.tsx`
- `RetailProductGrid.tsx`, `RetailCategoryBannerGrid.tsx`, `AdminCategories.tsx`, CMS types/defaults/editor
- `docs/conventions.md`, `docs/B2C.md`, `docs/brand-guidelines.md`

---

## 2026-07-30 — آماده‌سازی زیرساخت طراحی بنر هیرو

### خلاصه

- `docs/brand-guidelines.md` از توکن‌های قفل‌شده برند ساخته شد
- پوشه intake عکس: `assets/banners/hero-intake/` (+ lifestyle / products / refs)
- لوگوها کپی به `assets/brand/`
- fal MCP به `FAL_KEY` وابسته است (لاگین OAuth در چت ندارد)

---

## 2026-07-30 — پرداخت تکی: هدایت به باز کردن حساب به‌جای پیام خطا

### خلاصه

- اگر کاربر حساب نداشته باشد / `customerId` نداشته باشد، با زدن پرداخت بدون پیام خطا به `/account?redirect=/checkout` می‌رود
- اگر حساب کامل باشد، مستقیم سفارش/پرداخت ادامه می‌یابد

### فایل

- `apps/web/src/app/retail/checkout/page.tsx`

---

## 2026-07-29 — تنظیمات ارسال جدا برای تکی/عمده + متن قابل‌ویرایش

### خلاصه

- جزئیات محاسبه هزینه ارسال در ادمین قابل شخصی‌سازی (textarea جدا برای تکی و عمده)
- فیلدهای عددی کارمزد/آستانه از هم جدا شدند: `shipping.retail` و `shipping.wholesale`
- quote تکی از retail؛ سفارش و checkout عمده از wholesale
- سازگاری با فیلدهای تخت قدیمی (آینه retail)

### فایل‌ها

- `settings.service.ts`, `settings.controller.ts`, `shipping.service.ts`, `order.service.ts`
- `AdminSettings.tsx`, `checkout/page.tsx`

### Deploy

- Commit `06636a5` روی `master` + push
- VPS `/opt/taranom`: pull + rebuild `api`/`web` — health API ok / web 200

---

## 2026-07-29 — پیامک اعلان per-site + دیپلوی production

### خلاصه

- شماره اعلان ادمین جدا برای عمده/تک‌فروشی (تا ۲ شماره، دومی اختیاری)
- SMS ادمین روی ثبت سفارش؛ SMS ادمین روی ثبت‌نام عمده؛ SMS مشتری روی تأیید عمده
- پیامک کد رهگیری هنگام ذخیره ارسال در جزئیات سفارش (از قبل؛ hint در UI)

### Deploy

- Commit `4e4770c` روی `master` + push
- VPS `/opt/taranom`: `server-force-redeploy.sh` + force-recreate `api`
- Health: API ok / web 200 — کد `adminPhoneWholesale2` و `orderRegisteredAdmin` در ایمیج تأیید شد

---

## 2026-07-29 — کاروسل ۳ اسلاید هیرو تکی و عمده

### خلاصه

- هیرو تکی و عمده از تک‌بلوک به کاروسل ۳ اسلایدی با عکس محصول واقعی ارتقا یافت
- سه مفهوم مشترک (لینن / رویه فصل / ست) با کپی و CTA جدا برای RETAIL و WHOLESALE
- `normalizeHeroSlides` با fallback از props تخت قدیمی؛ ادمین ویرایشگر لیست اسلاید + autoplay
- فایل‌ها: `hero-slides.ts`, `HeroCarousel.tsx`, `RetailHero`, `HeroSection`, `defaults.ts`, `AdminBlockEditor`, `SiteBlocksRenderer`

---

## 2026-07-29 — اصلاح فرمول پک عمده = رنگ × سایز

### خلاصه

- فرمول پک: **تعداد رنگ × تعداد سایز** (از هر ترکیب ۱ عدد در هر پک)
- حذف ضریب اشتباه `specs.packQty` از محاسبه سفارش/سبد
- PDP و checkout عمده متن و جمع را با فرمول جدید نشان می‌دهند

---

## 2026-07-29 — هزینه ارسال تکی در تنظیمات + فاکتور پک عمده + انتخاب رنگ

### خلاصه

- **ارسال تکی:** توضیح فرمول وزن‌محور در تب «روش‌های ارسال» تنظیمات؛ فیلد قابل‌ویرایش `kgPerPiece`؛ افشای `perKgFee`/`kgPerPiece` در public settings
- **فاکتور عمده:** اگر `specs.packQty` ست باشد، سفارش به ازای هر رنگ×سایز با تعداد پک ثبت می‌شود (`quantity` = تعداد پک)
- **محصول:** `allowWholesaleColorSelect` + `minWholesaleColors` در فرم ایجاد/ویرایش؛ PDP عمده انتخاب رنگ و محاسبه پک

### Deploy

- Merge به `master` (`e0824df`) + push GitHub
- VPS `/opt/taranom`: reset به `origin/master`، schema SQL، rebuild `api`/`web` — health 200

### SQL

- `apps/api/src/database/sql/20260729-wholesale-color-select.sql`
- `scripts/apply-production-schema.sql` (ستون‌های جدید)

---

## 2026-07-29 — موجودی per سایز + SEO جدا + مودال فول‌اسکرین + fix 404 تکی

### خلاصه

- **موجودی:** برای هر رنگ، موجودی عمده/تکی جداگانه به ازای هر سایز؛ API `PUT .../color-stock` با آرایه `sizes[]`
- **404 تکی:** نرمال‌سازی `getServerApiBase()` به `/v1` + SSR با `fetchProductBySlug`؛ لینک گرید تکی به `/products/{slug}`
- **SEO:** فیلدهای جدا برای عمده و تکی در فرم محصول (`wholesale*` / `retail*` داخل `seoMeta`)
- **UI:** پنجره افزودن/ویرایش محصول فول‌اسکرین

---

## 2026-07-29 — رنگ + عکس در فرم محصول + سینک تکی‌فروشی

### خلاصه

- واریانت/رنگ داخل مودال افزودن/ویرایش محصول (`ColorVariantsEditor`)؛ آپلود عکس اختیاری per رنگ
- ستون `imageUrl` روی `product_variants` و snapshot روی `order_items`
- فروشگاه تکی: انتخاب رنگ ↔ گالری ↔ سبد/چک‌اوت/فاکتور ادمین با عکس همان رنگ
- موجودی همچنان یک‌بار per رنگ روی همه سایزها

### SQL

- `apps/api/src/database/sql/20260729-variant-color-image.sql`

---

## 2026-07-29 — موجودی رنگ‌محور + رنگ نمایشی عمده + fix checkout customerId

### خلاصه

- ادمین واریانت: ثبت موجودی یک‌بار به ازای هر رنگ روی همه سایزها (بدون تکرار در جمع آمار)
- API: `createVariant` بدون size همه سایزها را می‌سازد؛ `PUT .../color-stock` و حذف بر اساس رنگ
- ویترین عمده: رنگ فقط نمایشی؛ سفارش از موجودی کل محصول؛ بدون پین variant/color
- Checkout 500: `null customerId` — تزریق اجباری از JWT/کاربر + ارسال `customerId` از فرانت + JWT شامل customerId

---

## 2026-07-28 — GTM رسمی در layout (Next.js)

### خلاصه

- اسنیپت رسمی Google Tag Manager (`GTM-M3LQFGZV`) در `app/layout.tsx`: اسکریپت داخل `<head>` و `noscript` بلافاصله بعد از `<body>`
- جلوگیری از دوبار لود شدن در `GoogleAnalytics`
- دامنه تکی فقط اگر `NEXT_PUBLIC_GTM_RETAIL_ID` ست شود GTM می‌گیرد

---

## 2026-07-28 — CMS کامل صفحات (عمده + تکی)

### خلاصه

- بلوک‌های جدید: announcement، chrome، stats، features، process، testimonials، comingSoon، contact، links
- ویرایشگر ادمین «تنظیمات محتوای سایت» با CRUD آیتم‌ها + بارگذاری پیش‌فرض
- استورفرانت عمده/تکی از `site_contents` می‌خواند؛ بدون محتوا از پیش‌فرض‌های کد استفاده می‌شود
- هدر، فوتر، شناور تماس از صفحه `chrome` قابل ویرایش‌اند
- لینک از تنظیمات سیستم به محتوای صفحات

---

## 2026-07-28 — Google Analytics 4 + Search Console (عمده و تکی)

### خلاصه

- فیلدهای GA4 / GTM / GSC جدا برای عمده و تکی در تنظیمات marketing + public API
- تزریق gtag/GTM per-channel؛ verification meta از env یا ادمین
- رویداد purchase تکی برای GA4؛ sitemap با `?channel=`
- راهنمای مالک: `docs/GOOGLE-SETUP.md`

---

## 2026-07-28 — رفع باگ موجودی عمده در checkout (جمع واریانت‌ها)

### خلاصه

- سفارش با `productId` بدون واریانت: جمع موجودی کانال روی واریانت‌های منطبق (رنگ/سایز) و تخصیص حریصانه به چند `OrderItem`
- PDP عمده: انتخاب رنگ/سایز و ارسال `productVariantId` + color/size به سبد و checkout
- سبد: کلید خط بر اساس productId+variantId (یا color|size)
- `findBySlug` / `findOne` / لیست: `?channel=` و `withBadges` برای stock تکی/عمده روی محصول و واریانت‌ها
- فروشگاه تکی: پاس دادن `channel=RETAIL` در fetch محصول و کاتالوگ

---

## 2026-07-28 — اصلاحات موجودی/CMS/نشان‌ها/ارسال رایگان

### خلاصه

- ارسال رایگان: فیلد قابل تنظیم در تنظیمات ارسال + اعمال روی چک‌اوت عمده از `freeThreshold`
- موجودی عمده: تخصیص سفارش روی چند واریانت وقتی cart فقط productId دارد؛ انتخاب رنگ/سایز در PDP عمده
- PDP تکی: رفع کرش `sizeGuide` (آرایه) + موجودی retailStock
- نمایش کانال محصول: `showOnWholesale` / `showOnRetail`
- نشان محدود/جدید: ضریب و روزها از تنظیمات
- MemoryChips: دکمه حذف؛ موجودی کالا فقط جمع واریانت‌ها
- CMS: آپلود تصویر + راهنمای ابعاد

---

### خلاصه

- لیست رنگ ذخیره‌شده با افزودن/حذف برای انتخاب سریع در واریانت‌ها
- هر رنگ: سایز قابل انتخاب + موجودی عمده و تکی؛ مجموع خودکار روی موجودی کالا
- حذف واریانت هم موجودی محصول را دوباره جمع می‌زند
- داشبورد زنده (polling ۱۵ثانیه) و حذف سفارش‌های DELETED از آمار/لیست اخیر (عمده و تکی)

---

## 2026-07-27 — کانال عمده/تکی در انبار، CMS و فیلترهای ادمین

### خلاصه

- موجودی کانال‌محور: `wholesaleStock` / `retailStock` روی محصول و واریانت؛ legacy `stock` = عمده
- انبار: CRUD + پیش‌فرض «انبار عمده» / «انبار تکی»؛ حذف تاریخچه تحرک بدون برگشت موجودی
- سفارش: کسر/برگشت موجودی بر اساس کانال سفارش
- CMS: فیلتر کانال + Site Content CRUD و GET عمومی؛ ادمین صفحات با بلوک‌های محتوا
- جداسازی تنظیمات ادمین: منوها، صفحات، وبلاگ، مشتریان، سفارش‌ها، فاکتورها، گزارش‌ها، کالکشن‌ها، تخفیف‌ها، انبار
- حذف «تاریخچه رنگ‌ها» از مودال واریانت‌ها
- اسلاید خلاصه: `docs/reports/2026-07-27-admin-channel-split-slides.html`
- **Deploy روی VPS `5.75.200.102`:** SQL `20260727-channel-split.sql` + rebuild `api`/`web` — health 200

---

## 2026-07-25 — حذف/ویرایش سفارش با معکوس‌سازی اثرات

### خلاصه

- `DELETE /v1/orders/:id` حذف نرم: وضعیت `DELETED`، ردیف در ادمین می‌ماند و جزئیات دیده می‌شود
- معکوس: موجودی واریانت، کیف‌پول، usedCount کد تخفیف، پرداخت‌های PENDING، پست‌بک افیلیت
- `PATCH /v1/orders/:id` ویرایش ادمین (آدرس/یادداشت/روش ارسال/تعداد اقلام با همگام موجودی)
- UI ادمین: دکمه‌های حذف و ویرایش در لیست و جزئیات
- SQL: `apps/api/src/database/sql/20260725-order-void.sql`

---

## 2026-07-25 — اتصال مارکت‌پلیس و افیلیت فروشگاه تکی

### خلاصه

- فید تورب غنی‌تر + فید بام CSV/XML + `GET /v1/feeds` فهرست URLها
- پیکسل‌های Adro / Affer / Afsona / Takhfifan / Yektanet / Meta از تنظیمات ادمین در `<head>`
- گرفتن click id چندشبکه‌ای (`?yn=` `?affer=` `?afsona=` `?takhfifan=` `?aff=`)
- رویداد خرید کلاینت (`RetailConversion`) + پست‌بک S2S پس از verify پرداخت و COD
- ماژول باسلام: وضعیت، sync موجودی، catalog-export
- **درگاه زرین‌پال جدا برای تکی:** `retailMerchantId` / sandbox / callback در ادمین → تنظیمات → پرداخت
- چک‌لیست Owner در `docs/USER-ACTIONS-B2C.md` برای ثبت در پنل‌های خارجی

---

## 2026-07-24 — تکمیل کامل تک‌فروشی (مسیر پول تا RMA)

### خلاصه

- چک‌اوت تکی: آدرس ساخت‌یافته، هزینه ارسال زنده، کیف‌پول، `paymentUrl` زرین‌پال پس از `ONLINE`
- موجودی در سطح variant کسر/بازگردانی (کنسلی + RMA تأییدشده) + sync به `product.stock`
- فیلدهای محصول: pre-order / modelInfo / videoUrl + ماژول Collection
- PLP فیلتر+بارگذاری بیشتر؛ PDP زوم/ویدیو/جدول سایز/کراس‌سل؛ مگامنوی دسته‌ها
- حساب: کیف‌پول؛ مرجوعی با انتخاب قلم؛ ادمین `/admin/rma`؛ پیکسل یکتانت؛ `?aff=`؛ فید بدون old_price جعلی
- ادمین محصول: فیلدهای تکی + `/admin/collections`؛ آدرس‌های اخیر در حساب/چک‌اوت

---

## 2026-07-24 — حذف فاکتور + آمار واقعی ادمین + تکمیل B2C

### خلاصه

- `DELETE /v1/invoices/:id` (soft-delete): ادمین همه؛ مشتری فقط DRAFT/SENT بدون پرداخت — UI ادمین + پورتال عمده + تب فاکتور حساب تکی
- اعلان‌های فیک هدر ادمین حذف؛ از `/dashboard` زنده
- B2C: سبد کشویی، علاقه‌مندی، سایز ناموجود خاکستری، داشبورد حساب (سفارش+تایم‌لاین+فاکتور)، لینک‌های تمیز بدون `/retail`

---

## 2026-07-24 — سئوی کامل عمده (.com) + تکی (.ir)

### خلاصه

- `robots.ts` / `sitemap.ts` بر اساس Host: دامنه درست + بلاگ در sitemap عمده + PDPها در هر دو
- اسکیما کانال‌محور: ClothingStore / OnlineStore، WebSite+SearchAction، FAQ، BlogPosting، Product+Breadcrumb
- متای انسانی + canonical برای صفحات عمومی هر دو کانال؛ checkout/account = noindex
- OG واقعی: `og-wholesale.jpg` / `og-retail.jpg`
- FAQ روی خانه عمده و تکی؛ لینک متقابل فوتر

### تصمیم

- بدون hreflang بین .com و .ir (مخاطب عمده ≠ تکی)

---

### خلاصه

- هدر/هیرو/گرید محصول مطابق موکاپ (سبز جنگلی، طلایی، کرم، مدل هیرو)
- سند انتقال: `docs/MIGRATE-FROM-WEBZI.md` (nic → Cloudflare → سرور `5.75.200.102`)
- دارایی‌ها: `public/retail/hero-model.png`, `mockup-reference.png`

---

## 2026-07-23 — فید توروب/بام + RMA + پیش‌نمایش

### خلاصه

- `GET /v1/feeds/torob.xml` و `/v1/feeds/bam.csv`
- ماژول RMA: ثبت مرجوعی/تعویض + اعتبار کیف پول (+۵٪)
- صفحه `/retail/returns` و پیش‌نمایش `public/retail-preview.html`
- چک‌لیست کارهای مالک: `docs/USER-ACTIONS-B2C.md`

---

## 2026-07-23 — تکمیل فاز بعدی B2C (OTP + فیلتر + ادمین)

### خلاصه

- ورود تکی با OTP: `POST /auth/retail/otp/request|verify` + UI `/retail/account`
- سفارش تکی: بدون تخفیف عمده، هزینه ارسال خرده‌فروشی، type=`RETAIL_WEBSITE`
- PLP تکی با فیلتر جستجو/پارچه/رنگ/سایز
- ادمین سفارش‌ها: فیلتر کانال عمده/تکی + ستون کانال
- ریدایرکت 401 مسیر `/retail` به ورود OTP

---

## 2026-07-23 — شروع ویترین B2C داخل monorepo

### خلاصه

- کانال تکی روی دامنه `www.poshaktaranom.ir` داخل همین repo (نه پروژه جدا)
- مسیر `/retail/*` + middleware بازنویسی هاست `.ir`
- UI فروشگاهی: هیرو، PLP، PDP، سبد Zustand، چک‌اوت تکی
- API سفارش: `type=RETAIL_WEBSITE` → قیمت `retailPrice`، بدون MOQ عمده، موجودی مشترک
- دیزاین: `design-system/b2c/MASTER.md` — برند سبز+طلایی
- nginx: بلاک سرور `.ir` آماده (نیاز به DNS + SSL)
- نقشه: `skill site b2c.md` و `docs/B2C.md`

### پیش‌نمایش

- لوکال: `/retail`
- هنوز: OTP، RMA، فید توروب، کیف پول

---

## 2026-07-23 — حذف آمار دمو از پنل ادمین

### خلاصه

- صفحه گزارش‌ها/آنالیتیکس از دادهٔ ساختگی به `GET /v1/dashboard/reports` (KPI، روند درآمد، شهر، سگمنت، پارچه، پرفروش‌ها) وصل شد
- قیف وضعیت سفارش در داشبورد از درصدهای ساختگی به شمارش واقعی `ordersByStatus` تغییر کرد
- اسپارک‌لاین‌های جعلی KPI و دکمه‌های بی‌اثر فیلتر/Excel حذف شدند

### فایل‌های کلیدی

- `apps/api/src/modules/dashboard/*`
- `apps/web/src/components/admin/AdminReports.tsx`, `AdminDashboard.tsx`

---

## 2026-07-22 — فازهای ۲–۵ siteup + تم 21st

### خلاصه

- منوی داینامیک (main/footer/mobile/legal) + مگا‌منو شیشه‌ای + دکمه کلکسیون لینن
- صفحه `/linen-collection` و `/workshop` + فیلتر SEO `/products/fabric/[fabric]`
- فیلتر پارچه/سایز/رنگ با sync URL و عنوان پویا
- فیلدهای ساخت‌یافته PDP + پنل SEO محصول + Schema Product/Breadcrumb/Organization
- تم 21st: https://21st.dev/community/themes/taranom-emerald-gold-1784716637053

---

## 2026-07-22 — فاز ۱ siteup: شیشه‌ای Soft UI + تنظیمات تم

### خلاصه

- توکن‌های glass (`--glass-blur` و …) روی پالت سبز+طلایی قفل‌شده
- Modal / WhyTaranom / CtaBanner با سطوح شیشه‌ای؛ variant دکمه `glass`
- گروه تنظیمات `theme` در API (رنگ، حالت نمایش، blur، پاپ‌آپ بوتیک/خبرنامه)
- تب «تنظیمات تم ترنم» در ادمین + `ThemeRuntime` روی سایت عمومی

### فایل‌های کلیدی

- `apps/web/src/app/globals.css`, `components/wholesale/Theme*.tsx`, `LandingPopups.tsx`
- `apps/api/src/modules/settings/*`
- `apps/web/src/components/admin/AdminSettings.tsx`
- پلن: `docs/.plans/260722-1351-siteup-redesign/SUMMARY.md`

---

## 2026-07-21 — fix checkout 500 + پرداخت آنلاین زرین‌پال در checkout

### علت خطای Internal server error

- entityهای `TieredDiscount` / `SideDiscount` / `ProductSpecMemory` در `database.config.ts` ثبت نشده بودند

### اصلاح و قابلیت جدید

- ثبت entityهای گم‌شده در TypeORM
- روش پرداخت `ONLINE` در سفارش + گزینه «پرداخت آنلاین (زرین‌پال)» در checkout
- پس از ثبت سفارش آنلاین → redirect به درگاه؛ callback به `/payment/callback`
- `settings/public` پرچم `payment.enabled` را (بدون secret) برمی‌گرداند

### Deploy

- `poshaktaranom.com` — api + web

---

## 2026-07-20 — hotfix: نام migration موجودی سطح محصول

- TypeORM کلاس `ProductLevelStock20260720001` را رد می‌کرد (timestamp باید JS millis باشد)
- تغییر به `ProductLevelStock1784486400001`؛ schema از قبل با safety-net روی prod اعمال شده بود
- `CRM_API_KEY` روی سرور اضافه شد؛ rebuild --no-cache برای api/web

---

## 2026-07-21 — بازطراحی UI سایت عمومی + نصب ui-ux-pro-max

### خلاصه

- نصب skill `ui-ux-pro-max` در `.cursor/skills/` (CLI: `uipro init --ai cursor`)
- Design system ترنم در `design-system/default/` با پالت سبز+طلایی قفل‌شده (نه navy پیشنهادی خام skill)
- بازطراحی سایت عمومی: Hero full-bleed، trust strip، Why/How/Testimonials/CTA، کارت محصول editorial
- هم‌راستاسازی Header/Footer، محصولات، درباره، تماس، عمده، وبلاگ، صفحات حقوقی
- توکن‌های motion/surface در `globals.css` + `tailwind.config.ts`؛ `prefers-reduced-motion`

### فایل‌های کلیدی

- `design-system/default/MASTER.md`, `pages/home.md`
- `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`
- `apps/web/src/components/layout/*`, `components/wholesale/*`
- `apps/web/src/app/(wholesale)/**`
- گزارش: `docs/reports/2026-07-21-ui-redesign.md`

### خارج از دامنه

- پنل ادمین و پورتال مشتری (بدون تغییر layout اختصاصی)

---

## 2026-07-20 — موجودی سطح محصول + CRM API + PDP سایز/پالت

### خلاصه

- موجودی در سطح محصول (جدا از رنگ/واریانت)، مضرب حداقل سفارش
- مودال جداگانه «موجودی» در ادمین محصولات؛ واریانت‌ها فقط رنگ
- CRM API با `CRM_API_KEY` برای sync لحظه‌ای موجودی
- PDP: پالت رنگ کنار نام؛ راهنمای سایز پیش‌فرض باز و برجسته

### API

- `PATCH /products/:id/stock`, `POST /inventory/product/set`
- `GET|PUT /crm/inventory`, `GET|PUT /crm/inventory/:sku`

---

## 2026-07-20 — رفع خطای ثبت‌نام عمده‌فروش

### خلاصه

- placeholder شهر (`تهران`) شبیه مقدار پرشده بود و باعث خطای «فیلدهای ستاره‌دار» بدون ارسال API می‌شد
- اعتبارسنجی فیلدبه‌فیلد + نرمال‌سازی ارقام فارسی/عربی موبایل
- ثبت‌نام تراکنشی با پشتیبانی soft-deleted user/customer؛ کاربر جدید `isActive=false` تا تأیید ادمین
- همگام‌سازی `user.isActive` با تغییر وضعیت مشتری در ادمین؛ پیام ورود برای حساب PENDING

### فایل‌ها

- `apps/web/src/components/portal/RegisterForm.tsx`, `apps/web/src/lib/api.ts`
- `apps/api/src/modules/auth/auth.service.ts`, `dto/register.dto.ts`
- `apps/api/src/modules/customer/customer.service.ts`

---

## 2026-07-20 — جداسازی کامل موجودی از رنگ در ثبت محصول

### خلاصه

- مودال «رنگ‌بندی» فقط تعریف رنگ/بارکد؛ بدون فیلد یا ویرایش موجودی
- موجودی فقط از «مدیریت انبار» (`POST /inventory/set` + اعتبارسنجی مضرب MOQ)
- API: `createVariant` همیشه stock=0؛ `updateVariant` تغییر stock را رد می‌کند

### فایل‌ها

- `apps/web/src/components/admin/AdminProducts.tsx`, `AdminInventory.tsx`
- `apps/api/src/modules/product/*`, `inventory/*`

---

## 2026-07-20 — Deploy جداسازی موجودی/رنگ + ثبت‌نام روی production

### خلاصه

- سرور روی commit قدیمی `f8600e5` بود؛ به `1785365` (origin/master) به‌روز شد
- شامل PR #8 (جداسازی موجودی از رنگ) و PR #9 (migration نام‌گذاری stock)

### Deploy

- `scripts/server-force-redeploy.sh` روی VPS (SSH پورت 2222)
- Health: API ok، web 200

---

## 2026-07-18 — تکمیل gapهای سند (تخفیف واقعی، فاکتور ارسال، Jalali ساعت)

### خلاصه

- اعمال تخفیف کد + طبقاتی + جانبی در `order.create` و نمایش در checkout (`quote-discounts`)
- فیلدهای هزینه ارسال روی فاکتور: حمل درون‌شهری / هر کیلو / رایگان
- تاریخ شمسی با ساعت برای شروع/انقضای تخفیف
- SEO description در `generateMetadata` صفحه محصول
- حذف fallback دمو از FeaturedProducts

---

## 2026-07-18 — رفع CI برای deploy خودکار + اسکریپت‌های سرور

### خلاصه

- SSH از IP فعلی به VPS قطع/ریست می‌شود (احتمالاً fail2ban)
- CI قبلاً روی `turbo lint` / `next lint` می‌شکست و job deploy اجرا نمی‌شد
- workflow به typecheck + build تغییر کرد؛ اسکریپت deploy شامل pull/build و ALTER schema لازم برای site.docx
- اسکریپت‌های `scripts/server-*.sh` هم commit شد

### Deploy

- مسیر اصلی: GitHub Actions → SSH از runner (IP متفاوت از ویندوز لوکال)
- اگر secrets (`VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY`) تنظیم نباشد، deploy اکشن fail می‌شود و باید از کنسول هتزنر دستی اجرا شود

---

## 2026-07-17 — اعمال تغییرات site.docx (محصول، تخفیف، اقساط، ارسال، آمار)

### خلاصه

پیاده‌سازی کامل درخواست‌های سند `site.docx` روی ادمین + API + فروشگاه:

**محصولات**

- حذف فیلدهای ترکیب/جنس پارچه از فرم؛ افزودن `specs` (توضیحات محصول) با حافظه مقادیر
- `description` فقط SEO؛ وضعیت `COMING_SOON` + سکشن پیش‌خرید در صفحه اصلی
- برچسب «جدید» خودکار ۷ روز؛ «تخفیف‌دار» دستی؛ «موجودی محدود» وقتی موجودی ≤ ۲× MOQ
- `sizeType` (۲/۳/فری سایز) + راهنمای سایز روی PDP

**واریانت‌ها**

- رنگ با پالت + تاریخچه؛ موجودی مضرب MOQ؛ سایز از `sizeType` محصول

**تخفیف‌ها**

- تاریخ شروع/انقضا شمسی برای کد؛ تخفیف طبقاتی و جانبی (CRUD API + UI تب‌دار)
- بازاریابی تکراری → redirect به `/admin/discounts`

**اقساط / ارسال**

- چند قانون اقساط با دسته؛ شرط ≥۲ فاکتور فعال + اخطار در checkout
- حذف هزینه‌های ارسال از تنظیمات؛ ثبت هزینه باربری + رسید روی سفارش؛ نمایش در پورتال

**آمار**

- داشبورد بدون داده دمو؛ سری ماهانه واقعی از API

### فایل‌های کلیدی

- `apps/api/src/modules/product/*`, migration `20260717-001-*`
- `apps/api/src/modules/discount/*`
- `apps/api/src/modules/order/*`, `settings.service.ts`, `dashboard.service.ts`
- `apps/web/src/components/admin/AdminProducts.tsx`, `AdminMarketing.tsx`, `AdminSettings.tsx`, `AdminOrderDetail.tsx`, `AdminDashboard.tsx`
- `apps/web/src/components/wholesale/ProductDetail.tsx`, `ComingSoonSection.tsx`
- `apps/web/src/app/checkout/page.tsx`

### تست

- `npx tsc --noEmit` در `apps/api` و `apps/web` — بدون خطا

### خارج از محدوده

- بخش «مشتریان» سند ناقص بود و اعمال نشد

---

## 2026-07-13 — شروع ارتقای Wholesale Ordering (baseline قبل از تغییرات)

### Scope / Baseline

- **صفحه محصول (انتخاب رنگ/سایز + variant-based cart)**: `apps/web/src/components/wholesale/ProductDetail.tsx`
- **سبد خرید (localStorage)**: `apps/web/src/lib/cart.tsx`
- **checkout (تک‌صفحه‌ای + روش ارسال/پرداخت هاردکد)**: `apps/web/src/app/checkout/page.tsx`
  - Shipping: `CHAPAR`, `TIPAX`, `POST`, `IN_PERSON`
  - Payment: `CREDIT`, `BANK_TRANSFER`, `CHECK`, `CASH`
  - ارسال سفارش: `POST /orders` با `productVariantId`, `color`, `size`
- **API سفارش (تنها چک stock؛ بدون enforce MOQ سمت سرور)**: `apps/api/src/modules/order/order.service.ts`
- **مدل variant (color/size رشته‌ای + stock روی variant)**: `apps/api/src/modules/product/entities/product-variant.entity.ts`
- **Settings (ذخیره در `app_settings` JSONB)**: `apps/api/src/modules/settings/settings.service.ts`
  - Shipping methods فعلی در settings فقط enable-flag دارد (لیست شرکت‌ها dynamic نیست)

### یادداشت اجرای پروژه

- از این نقطه به بعد هر فاز: update `docs/WORKLOG.md` + در صورت نیاز report + commit جدا.

---

## 2026-07-13 — فاز 2: روش‌های ارسال/پرداخت + قوانین اقساط

### خلاصه

- Shipping از حالت ثابت خارج شد و **لیست شرکت‌های حمل قابل مدیریت** از پنل ادمین شد (ذخیره در `app_settings.shipping.companies`).
- Checkout روش‌های ارسال را از API می‌گیرد (`GET /shipping/methods`).
- روش‌های پرداخت checkout فقط:
  - `CASH` (نقدی)
  - `INSTALLMENT` (اقساطی)
- قوانین اقساط از پنل ادمین قابل تنظیم شد:
  - حداقل پیش‌پرداخت درصدی / مبلغی
  - حداکثر ماه اقساط
- اعتبارسنجی اقساط در **فرانت** و **API** اضافه شد.

### فایل‌های کلیدی

- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/shipping/shipping.service.ts`
- `apps/api/src/modules/order/order.service.ts`
- `apps/web/src/components/admin/AdminSettings.tsx`
- `apps/web/src/app/checkout/page.tsx`

---

## 2026-07-13 — فاز 3: دسته‌بندی + تولید خودکار SKU

### خلاصه

- اضافه شدن `CategoryEntity` با:
  - `skuPrefix` (مثل `LINEN-`)
  - `nextSequence` برای تولید SKU یکتا و مقاوم در برابر همزمانی
- افزودن `products.categoryId` و migration مربوطه.
- تولید SKU هنگام ایجاد محصول (اگر `sku` ارسال نشود و `categoryId` موجود باشد).
- UI ادمین:
  - صفحه `/admin/categories` برای CRUD دسته‌بندی‌ها
  - انتخاب دسته‌بندی در فرم محصول و امکان خالی گذاشتن SKU برای تولید خودکار

### فایل‌های کلیدی

- `apps/api/src/modules/category/*`
- `apps/api/src/database/migrations/20260713-001-create-categories.ts`
- `apps/api/src/modules/product/product.service.ts`
- `apps/web/src/components/admin/AdminCategories.tsx`
- `apps/web/src/components/admin/AdminProducts.tsx`
- `apps/web/src/components/admin/AdminSidebar.tsx`

---

## 2026-07-13 — رفع دفرمه شدن پنل ادمین + deploy

### خلاصه

- رفع layout ادمین: حذف `sticky` دوبل‌کاری سایدبار + `mr-64` تکراری
- import گم‌شده `Layers` در سایدبار (باعث خطای رندر می‌شد)
- مخفی کردن FloatingContact در مسیر `/admin`
- جلوگیری از overflow افقی در جداول ادمین

### Deploy

- push به GitHub + rebuild روی سرور

---

## 2026-07-11 — سایت down — redeploy کامل سرور

**گزارش:** [reports/2026-07-11-server-redeploy.md](./reports/2026-07-11-server-redeploy.md)

### خلاصه

- علت: پوشه `/opt/taranom` و همه containerهای ترنم از سرور حذف شده بودند
- redeploy از GitHub + SSL + docker compose up
- دیتابیس و MinIO volume جدید → داده‌های قبلی (محصولات/عکس‌ها) از بین رفته
- schema bootstrap + seed ادمین انجام شد
- سایت: `https://poshaktaranom.com` → HTTP 200

### ادمین

- `/admin/login` — `09152424624` / `Admin@1234` (رمز را عوض کنید)

### اقدام لازم

- محصولات را دوباره از پنل ادمین اضافه کنید
- backup منظم postgres + minio

---

## 2026-07-09 — تصاویر محصول، صفحه جزئیات، مسیر خرید، deploy

**گزارش کامل:** [reports/2026-07-09-product-images-checkout-deploy.md](./reports/2026-07-09-product-images-checkout-deploy.md)

### خلاصه

- رفع باگ ذخیره نشدن عکس محصول در پنل ادمین
- ریسایز خودکار عکس با sharp (WebP، ۳:۴، ۱۲۰۰×۱۶۰۰)
- رفع دفرمه شدن گالری صفحه محصول
- تکمیل مسیر سبد → checkout → ثبت سفارش
- رفع باگ بحرانی JWT (`sub` / `customerId`) در ثبت سفارش
- deploy روی `poshaktaranom.com` و تست E2E موفق

### Deploy

- سرور: `/opt/taranom` — `ssh -p 2222 wholesale-admin@5.75.200.102`
- آخرین rebuild: api + web (۲۰۲۶-۰۷-۰۹)

### تست E2E

- اسکریپت: `scripts/e2e-purchase-test.sh`
- نتیجه: `ORD-2026-00002` — `PENDING_REVIEW`

### باقی‌مانده

- عکس‌های قدیمی (قبل از sharp) نیاز به آپلود مجدد دارند
- پرداخت آنلاین زرین‌پال فقط از پنل مشتری (فاکتورها)
- migrationهای واقعی DB

---

<!-- الگوی ورودی بعدی:

## YYYY-MM-DD — عنوان

**گزارش:** [reports/...](...)

### خلاصه
- ...

-->

---

## 2026-07-31 — اتمیک‌سازی checkout و مهار deploy خودکار

**گزارش:** [reports/2026-07-31-checkout-transaction-hardening.md](./reports/2026-07-31-checkout-transaction-hardening.md)

### خلاصه

- کاهش موجودی، کسر کیف پول و مصرف کد تخفیف به همان تراکنش ایجاد سفارش منتقل شد.
- در صورت شکست هر اثر مالی یا موجودی، سفارش و آیتم‌ها نیز به‌طور کامل rollback می‌شوند.
- حافظهٔ tracked دارای credential از HEAD حذف و با حافظهٔ امن `.Codex` جایگزین شد.
- deploy مستقیم پس از push غیرفعال و به اجرای دستی در environment تولید محدود شد.
- type-check، تست منطق OTP و build API با موفقیت اجرا شدند؛ deploy انجام نشد.

---

## 2026-07-31 — تدوین برنامه جامع اصلاح و ارتقای پروژه برای Cursor

### خلاصه

- ممیزی کامل امنیت، بک‌اند، فرانت‌اند، UX، B2B، GitHub و DevOps به یک برنامه اجرایی ده‌مرحله‌ای تبدیل شد.
- ترتیب اصلاحات از مهار افشای اسرار و امنیت مالی تا تکمیل B2B، تست، CI/CD، UX، SEO و پایش production مشخص شد.
- برای هر task معیار پذیرش و verification مستقل تعریف شد.
- قانون اجباری ثبت هر تغییر در WORKLOG، گزارش جلسه، ADR و `.Codex/memory.json` داخل برنامه درج شد.

### فایل

- `cursor-project-hardening-plan.md`

### تغییر کد محصول

- انجام نشد؛ این جلسه فقط مستندات برنامه‌ریزی را اضافه کرد.

---

## 2026-07-31 — بارگذاری شش بنر Hero عمده و تک‌فروشی

**گزارش:** [reports/2026-07-31-hero-campaign-banners.md](./reports/2026-07-31-hero-campaign-banners.md)

### خلاصه

- کلاژ کاربر به سه بنر WHOLESALE و سه بنر RETAIL تفکیک و به WebP کم‌حجم تبدیل شد.
- برای هر اسلاید نسخه desktop `1536×680` و mobile `600×800` ساخته شد.
- حالت `artwork` به schema/CMS و editor هیرو اضافه شد تا بنرهای دارای متن بدون overlay تکراری نمایش داده شوند.
- H1، متن معادل، alt و CTA واقعی HTML برای SEO و accessibility حفظ شدند.
- autoplay دارای کنترل توقف/ادامه شد و semantics کنترل‌های carousel اصلاح شد.
- defaults هر دو کانال و migration برگشت‌پذیر CMS production اضافه شدند؛ deploy اجرا نشد.

### محدودیت

- منبع یک کلاژ کم‌رزولوشن بود؛ برای Retina ایده‌آل باید شش source مستقل حداقل `1920×800` دریافت شود.

---

## 2026-07-31 — بازطراحی Human-centered هیروهای تکی و عمده

**گزارش:** [reports/2026-07-31-human-centered-hero-redesign.md](./reports/2026-07-31-human-centered-hero-redesign.md)

### خلاصه

- نسخه کلاژی دارای متن حک‌شده از حالت نهایی کنار گذاشته شد.
- شش تصویر انسانی اصلی پروژه، بدون نوشته و CTA تصویری، به WebP دسکتاپ و موبایل تبدیل شدند.
- copy هر کانال بازنویسی شد تا کوتاه، صادقانه، قابل اسکن و متناسب با B2B/B2C باشد.
- یک H1 پایدار برای هر صفحه و H2 برای اسلایدهای متغیر تعریف شد.
- defaults و migration برگشت‌پذیر CMS برای نسخه Human-centered اضافه شدند.
- دارایی‌ها به سرویس خارجی ارسال نشدند؛ Canva نیازمند تأیید جداگانه بود و Adobe پاسخ 403 داد.

### باقی‌مانده پیشنهادی

- دریافت یک عکس واقعی انسانی از کارگاه، رگال سفارش یا تیم بسته‌بندی برای جایگزینی یکی از اسلایدهای مدل‌محور عمده.

### تحویل و SSH

- کلید production در مسیر استاندارد خارج از repository یعنی `C:\Users\DayaTech\.ssh\wholesale_server` حفظ شد.
- alias امن `wholesale-vps` برای `wholesale-admin@5.75.200.102:2222` در SSH config ثبت و اتصال non-interactive تأیید شد.
- type-check و build وب/API و `git diff --check` موفق بودند.
- lint/test سراسری به‌علت نبود executableهای `eslint` و `jest` در وابستگی‌های API متوقف شدند؛ جزئیات در گزارش Cursor ثبت شد.
- commit `ed612da` به `origin/master` push و با سرویس استاندارد `taranom-autodeploy` روی production منتشر شد.
- migrationهای Hero در جدول `migrations` ثبت شدند؛ API health موفق بود.
- دامنه‌های `poshaktaranom.com` و `www.poshaktaranom.ir` در دسکتاپ و موبایل بررسی شدند: تصاویر جدید بارگذاری شدند، H1 واحد و بدون overflow افقی.
- hotfix نمایشگرهای عریض/high-DPR: درخواست Next Image با `w=3840` روی production پاسخ 400 می‌داد؛ فقط WebPهای ازپیش‌بهینه‌شده `hero-human-2026` مستقیم سرو می‌شوند تا تصویر در هیچ DPR حذف نشود.

---

## 2026-07-31 — کمپین Hero محصول‌محور V2

**گزارش:** [reports/2026-07-31-product-campaign-hero-v2.md](./reports/2026-07-31-product-campaign-hero-v2.md)

- شش بنر اختصاصی با Image Generation و مرجع لباس‌های واقعی کاتالوگ ترنم ساخته شدند.
- پنج بنر بدون انسان/مانکن و بنر آخر تکی با یک مدل انسانی و کت آلیس طراحی شد.
- خروجی WebP مستقل دسکتاپ و موبایل، defaults جدید و migration برگشت‌پذیر CMS اضافه شدند.
- مسیر جدید `hero-product-2026-v2` نیز مستقیم سرو می‌شود تا خطای optimizer در high-DPR تکرار نشود.
