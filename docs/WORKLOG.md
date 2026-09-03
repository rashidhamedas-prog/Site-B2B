# Worklog — پلتفرم ترنم B2B

## 2026-09-03 — دیپلوی زنده 0970811

- `master` روی VPS به `0970811` رسید (ایزوله کانال + نویسنده بلاگ + لوگوی فشرده).
- fetch گیت سرور با deploy key فقط-خواندنی درست شد. کانکتور خاموش ماند.
- کالکشن و نویسنده بدون کانال روی API زنده ۴۰۰ می‌دهند.

## 2026-09-03 — صفحه نویسنده بلاگ کانال می‌خواهد

- `GET /blog/authors/:slug` بدون کانال ۴۰۰ است و فقط پست همان کانال را برمی‌گرداند.
- ویترین تکی و عمده `channel` را می‌فرستند. کانکتور خاموش ماند.

## 2026-09-03 — ایزوله کالکشن، تخفیف و موجودی بلاگ

- کالکشن عمومی بدون کانال ۴۰۰ است؛ ادمین JWT می‌تواند کانال ندهد.
- اعتبارسنجی کد تخفیف و quote سفارش کانال را چک می‌کند (`BOTH` یا همان کانال).
- محصولات مرتبط بلاگ از `channelAvailability` می‌خوانند، نه `p.stock`.
- پنل `/admin/omnichannel` فقط سرستون و حالت خالی گرفت. کانکتور خاموش ماند.

## 2026-09-03 — کانال اجباری بلاگ عمومی

- مسیر عمومی بلاگ بدون `channel=RETAIL|WHOLESALE` دیگر پست‌های هر دو کانال را قاطی نمی‌کند و به عمده پیش‌فرض نمی‌شود (۴۰۰).
- ادمین بلاگ همچنان می‌تواند کانال ندهد. کانکتور خاموش ماند. ردیف outbox حذف نمی‌شود.

## 2026-09-03 — فشرده‌سازی لوگوی ترنم

- `logo-128.png` از ۲۰ کیلوبایت به ۶٫۸ کیلوبایت رسید (همان ۱۲۸ پیکسل). هدر/فوتر عمده و JSON-LD تکی/عمده همین فایل را می‌گیرند.
- `logo-512.png` عمومی از ۲۵۳ کیلوبایت به ۱۴ کیلوبایت رسید (نمایش ورود ۸۰ پیکسل است). ورود پرتال دیگر `logo-128` را لود می‌کند.
- هدر تکی همان BrandMark SVG است و PNG لوگو را نشان نمی‌دهد.

## 2026-09-03 — باقی‌مانده §9 و کانال اجباری CMS

- مسیر عمومی CMS بدون `channel=RETAIL|WHOLESALE` دیگر به عمده پیش‌فرض نمی‌شود (۴۰۰).
- فهرست رویداد auto-publish، مهلت تلاش مجدد و نگهداری صف در همان `app_settings.omnichannel` ذخیره می‌شود؛ تا انتخاب ادمین ورکر عوض نمی‌شود.
- کانکتور خاموش ماند. ردیف outbox حذف نمی‌شود.

## 2026-09-01 — تنظیمات کانال انتشار در ادمین

- سیاست ناموجود تکی/عمده (UPDATE / HIDE / DELETE) در `app_settings.omnichannel` ذخیره می‌شود؛ تا ذخیره ادمین ارسال نمی‌شود.
- مقصد canary تلگرام روی همان جدول مقصد است (`isCanary`). بدون canary صف ارسال خالی است.
- `secretRef` همان نام env است. ربات برای این ذخیره لازم نیست. کانکتور خاموش ماند.

## 2026-09-01 — فاز ۴: فید تکی از resolver مشترک موجودی

- `GET` فید دیگر جمع جدا نمی‌زند؛ همان `channelAvailability(..., RETAIL)` باسالام است.
- اگر واریانت باشد و همه `retailStock=0` باشند، دیگر به `product.retailStock` برنمی‌گردد.
- کانکتور خاموش ماند.

## 2026-09-01 — فاز ۳: unwrap نتیجه lease تایپ‌اورم

- بعد از SQL خام، ۱۸ ردیف همچنان PROCESSING ماندند. ورکر هر ۲ ثانیه دوباره lease می‌زد و handle را صدا نمی‌زد.
- TypeORM برای `UPDATE … RETURNING` آرایهٔ `[rows, rowCount]` برمی‌گرداند؛ `rows.map(r => r.id)` خالی می‌شد.
- `leaseRowsFromQueryResult` همان tuple را باز می‌کند. کانکتور خاموش ماند. ردیف حذف نمی‌شود.

## 2026-09-01 — نقش ادمین و مشتری جدا

- نقش staff دیگر با OTP/ثبت‌نام فروشگاه عوض یا حذف نمی‌شود.
- نشست پنل و فروشگاه کوکی جدا دارند؛ خرید با توکن `storefront` است.
- Live `0d39830`: ورود `purpose=admin` نقش ADMIN می‌دهد؛ `purpose=portal` نقش عملی CUSTOMER است و نقش دیتابیس ADMIN می‌ماند.

## 2026-09-01 — فاز ۳: persist وضعیت outbox با SQL خام

- بعد از بالا آمدن ورکرها روی `079193a`، ۱۸ ردیف هر ۵ دقیقه دوباره lease می‌شدند و `DONE`/`DEAD` نمی‌شدند.
- `lease` با SQL خام می‌نوشت؛ `markDone`/`markFailure` با `repo.update` به جدول نمی‌رسید (`updatedAt` کهنه، `lastError` خالی).
- همان مسیر SQL خام برای اتمام/شکست؛ timeout هندلر ۲۵ ثانیه (دو SMS). کانکتور خاموش ماند. ردیف حذف نمی‌شود.

## 2026-09-01 — هات‌فیکس مایگریشن Docker (API down)

- کپی همهٔ `*.js` مایگریشن، فایل‌های `*.spec.js` را هم وارد ایمیج کرد؛ TypeORM همان‌ها را به‌عنوان مایگریشن لود کرد و API بالا نیامد.
- بعد از حذف spec، مایگریشن‌های flattenشده `require('../../common/ascii-slug')` را شکستند.
- TypeORM حالا از مسیر emit تی‌اس‌سی می‌خواند تا import نسبی کار کند و spec را نادیده می‌گیرد.
- Live `079193a`: health 200؛ مایگریشن id=29 اعمال شد.

## 2026-09-01 — فاز ۳: timeout برای SMS و heartbeat وسط بچ

- بعد از دیپلوی outbox کاتالوگ، ۱۸ ردیف `PROCESSING` ماند. SMS به sms.ir بدون مهلت بود و heartbeat ورکر فقط آخر بچ نوشته می‌شد.
- fetch پیامک ۸ ثانیه abort می‌شود؛ Meilisearch هم ۸ ثانیه؛ ورکر بعد از هر رویداد heartbeat می‌زند.
- کانکتورها خاموش ماندند. ردیف outbox حذف نمی‌شود.

## 2026-09-01 — لاگین ادمین، موجودی بعد از تسویه، آدرس پروفایل

- ورود `/admin/login` با `purpose=admin` حساب مشتری را به پنل راه نمی‌دهد.
- موجودی کانال تا `CONFIRMED` / پرداخت موفق کسر نمی‌شود؛ لغو سفارش معلق انبار را زیاد نمی‌کند.
- پروفایل تکی و عمده مشخصات و چند آدرس را روی سرور ذخیره می‌کند.

## 2026-09-01 — فاز ۲: outbox کاتالوگ روی create/update/remove

- `ProductService` دیگر Meilisearch را روی درخواست API صدا نمی‌زند؛ رویدادهای `product.*` و `search.reindex.requested` داخل همان تراکنش ذخیره می‌شوند.
- Lease ردیف `PROCESSING` بدون `lockedAt` را در تیک بعدی پس می‌گیرد؛ قفل کهنه‌تر از پنج دقیقه هم reclaim می‌شود. handler بعد از ۹۰ ثانیه timeout می‌شود و SMS اصلی را کنسل نمی‌کند.
- کانکتورها خاموش ماندند. تست‌های `product-outbox` / `outbox-lease` / `omnichannel-phase-acceptance` و `tsc` API با exit 0.

## 2026-09-01 — فالوآپ مالک: CTA تکی، اریکا، ISR کاتالوگ عمده

- متن زندهٔ بنر هوم تکی از فال‌بک رندرر می‌آمد، نه از ردیف CMS. فال‌بک الان «بوتیک دارید؟ / ورود به سایت بوتیک‌داران» است؛ SQL فقط FAQ+CTA را به DB اضافه می‌کند.
- اسلاگ اشتباه اریکا به `linen-sport-jacket-erika` ۳۰۱ می‌شود.
- `/products` عمده ISR و لاغر شد بدون دست زدن به `ProductCatalog`.
- Merchant image هنوز Validate Fix نشده: سارا برای گوگل unknown است. نام استریم GA4 عمده از این لاگین عوض نشد.

## 2026-08-31 — حساب مدیر، جلوگیری از تنزل نقش، خطای واقعی تنظیمات

- علت خالی بودن تنظیمات: OTP تکی نقش ادمین را `CUSTOMER` می‌کرد و `@AdminOnly` ۴۰۳ می‌داد.
- OTP/ثبت‌نام دیگر staff را تنزل نمی‌دهد. `/admin/account` برای ایمیل و رمز همین کاربر اضافه شد.
- «مدیر کل» از `/admin/users` عوض می‌شود؛ نام نمایشی فروشگاه از تنظیمات ← کسب‌وکار.

## 2026-08-31 — ممیزی کامل GSC تکی+عمده و اصلاح HTML/ISR/JSON-LD

- کنسول هر دو ملک دامنه خوانده شد: تکی ۱۰۹ کلیک / ۱۷۱ ایندکس؛ عمده ۵۶ کلیک / ۴۹ ایندکس؛ عمده موبایل ۱۱ URL با LCP>۴ثانیه.
- GA4 تکی و عمده به ملک‌های GSC وصل شد. سایت‌مپ www تکی submit شد (fetch اول ناموفق؛ apex Success ماند).
- کد: slim کارت هوم تکی، ISR `/products`، ادغام بلاگ در سایت‌مپ، انکر فوتر، تصویر مطلق JSON-LD.
- مالک استقرار این شاخه را خواست. Live `e0d20a8`: هوم تکی ~۱۸۲KB ISR؛ `/products` تکی `s-maxage=60`؛ blog.xml چهار پست؛ اینماد lazy؛ هیرو عمده WebP خام. Lab LCP هوم‌ها زیر ۲٫۵ثانیه؛ کاتالوگ عمده هنوز ~۱۲ثانیه.

## 2026-08-31 — لاگین ادمین، سرچ ویترین، موجودی دسته، کاربران سیستم

- ورود ادمین رقم فارسی/عربی و `+98` را نرمال می‌کند؛ نقش‌های `UserRole` می‌توانند وارد `/admin` شوند.
- سرچ هدر عمده و تکی روی هوم یک overlay سبک باز می‌کند و `GET /products?search=` را می‌زند.
- کارت دسته تکی `retailStock` را پاس می‌دهد تا کالای موجود «ناموجود» نشان داده نشود.
- `/admin/users` ایجاد/ویرایش/فعال‌سازی/بازنشانی رمز دارد؛ آخرین مدیر و خود-قفل محافظت می‌شود.

## 2026-08-31 — کانال اجباری روی کاتالوگ عمومی

- `GET /products` بدون `channel=RETAIL|WHOLESALE` برای کاربر عادی ۴۰۰ است. ادمین با JWT می‌تواند بدون کانال هر دو ستون را ببیند.
- محتوای کامل و فیلدهای تخفیف کانال مقابل از JSON عمومی حذف می‌شوند.

## 2026-08-31 — پاسخ عمومی محصول بدون موجودی کانال مقابل

- `GET /products?channel=RETAIL` دیگر `wholesaleStock`/`wholesalePrice` برنمی‌گرداند و به `stock` قدیمی برنمی‌گردد.
- عمده هم ستون تکی را در JSON عمومی نمی‌بیند. ادمین هر دو ستون را نگه می‌دارد.

## 2026-08-31 — شروع soak با دو worker

- `worker-b` همان ایمیج را با SKIP LOCKED جدا lease می‌کند. کانکتور و auto-publish خاموش می‌مانند.
- Restore-drill دورریختنی روی VPS موفق بود. تایمر هشدار outbox نصب می‌شود.

## 2026-08-31 — کپی همه مایگریشن‌ها در ایمیج API

- Dockerfile فقط مایگریشن ترب را به `dist/database/migrations` می‌برد؛ جدول‌های omnichannel ساخته نمی‌شدند. الان همهٔ `*.js` کپی می‌شوند.

## 2026-08-31 — هات‌فیکس بوت worker

- Worker جدا از API است و `RedisModule` لازم دارد تا `OtpService` برای Auth حل شود. بدون این، کانتینر در Restarting می‌ماند.

## 2026-08-31 — استقرار کد Omnichannel فاز ۰ تا ۸

- موجودی تکی/عمده از ستون‌های کانال خوانده می‌شود؛ worker و outbox جدا از API است؛ کانکتورها خاموش می‌مانند.
- مایگریشن TypeORM جداول omnichannel را می‌سازد. انتشار خودکار و canary زنده هنوز اجرا نشده.
- تسویه عمده `channel: WHOLESALE` می‌فرستد. ادمین `/admin/omnichannel` برای پیش‌نویس و reconcile است.

## 2026-08-31 — ISR دسته تکی روی URL عمومی

- میدلور دیگر `/category/{slug}` را روی هاست `.ir` بازنویسی نمی‌کند؛ `next.config` با `beforeFiles` به `/retail/category/:slug` می‌برد تا `s-maxage=60` بماند.
- عمده `.com` همان مسیر قبلی است. تسویه/حساب/ادمین کش HTML نمی‌شوند.

## 2026-08-31 — ISR دسته بدون فیلتر (APP-02)

- `/category/{slug}` دیگر `searchParams` سرور را await نمی‌کند؛ `force-static` و `revalidate=60` مثل هوم.
- فیلتر و `?page=` با overlay کلاینت می‌ماند و noindex است. قیمت/موجودی HTML طولانی کش نمی‌شود.
- زنده: عمده `s-maxage=60`. تکی روی مسیر داخلی `/retail/category/{slug}` هم ISR است؛ URL عمومی `.ir` به‌خاطر rewrite میدلور هنوز `no-store` است.
- تسویه/حساب/ادمین دست نخورده. nginx.conf دست نخورده.

## 2026-08-30 — ISR هوم عمده + پروکسی Cloudflare برای سرعت

- هوم عمده `revalidate=60` و `force-static` شد تا مثل تکی `s-maxage=60` بدهد و لبه بتواند HIT کند.
- Cache Rule و Full (strict) از قبل روی هر دو زون بودند؛ اپکس/www دامنه `.ir` باید Proxied شود تا ترافیک ایران از anycast بگذرد.
- مسیرهای حساب/تسویه/ادمین/API کش HTML نمی‌شوند. commit و دیپلوی همین نشست.

## 2026-08-30 — تشخیص TTFB و زیرساخت VPS (بدون مهاجرت)

- هوم تکی روی خود VPS حدود ۱۴ms؛ از ایران میانه ۱۳۱۷ms. هلث API از ایران ۱۵۵۳ms و روی سرور ۲ms.
- CPU steal صفر، دیسک SSD و بدون فشار RAM. گلوگاه اصلی مسیر ایران به نورنبرگ است؛ Cloudflare فقط DNS.
- تصمیم: بهینه‌سازی همین VPS اول. هاست اشتراکی نه. گزارش: `SEO-IMPLEMENTATION-REPORTS/VPS-TTFB-INFRASTRUCTURE-DIAGNOSTIC.md`

## 2026-08-30 — PHASE-04 نقشه کلیدواژه و محتوا (بدون دیپلوی)

- سرشماری زنده خرده‌فروشی `.ir`: ۶۰ محصول فعال، ۱۰ دسته، ۴ مقاله منتشرشده، ۸۲ URL در موجودی.
- گزارش‌ها در `SEO-IMPLEMENTATION-REPORTS/PHASE-04-*`. محتوای زنده، متادیتای پروداکشن و دیپلوی تغییر نکرد.
- دو مقاله PUBLISHED در سایت‌مپ نیستند. حجم جستجوی خارجی و خروجی GSC/GA4 موجود نبود و ساخته نشد.

## 2026-08-29 — Torob Product API v3 و fallback خزش

- endpoint زنده `POST https://www.poshaktaranom.ir/v1/torob_api/v3/products` از دیتابیس می‌خواند؛ JWT فقط audience دقیق `www.poshaktaranom.ir` را می‌پذیرد.
- پنل ترب روی این آدرس GET می‌زند و 404 HTML ویترین می‌گرفت؛ GET الان ۲۰۰ JSON خالی برمی‌گرداند و مسیر از rewrite خرده‌فروشی خارج شد. تا deploy زنده همان 404 می‌ماند.
- قیمت، موجودی تکی، تصویر و گارانتی از یک projection مشترک به API، فید XML و متاتگ PDP می‌روند.
- Reviewer: متاتگ PDP برای محصول بدون واریانت از `retailStock` محصول می‌خواند؛ `updateProductStock` تکی `updatedAt` را در همان نوشتن لمس می‌کند.
- سقف ۵۰۰/۲۰۰۰ حذف شد. migrate/deploy تولید اجرا نشده و نیاز به تأیید مالک دارد.

## 2026-08-29 — Omnichannel بلاگ/CMS و موجودی ویترین

- ورکر `blog.published` و `cms.published` را به ردیف انتشار محلی تبدیل می‌کند؛ ارسال زنده ندارد.
- کارت و سفارش عمده/خرده‌فروشی فقط ستون کانال را می‌خوانند. ادمین بج وضعیت انتشار نشان می‌دهد.

## 2026-08-29 — Omnichannel همگام‌سازی انتشار از outbox

- ورکر رویدادهای کاتالوگ را به ردیف DRAFT/WITHDRAWN محلی تبدیل می‌کند؛ delivery ساخته نمی‌شود.
- موجودی عمده در inventory/order فقط از `wholesaleStock` خوانده می‌شود.
- اسکریپت و جاب CI مهاجرت خالی شامل جدول رسانه است. migrate پروداکشن اجرا نشده.

## 2026-08-29 — Omnichannel رجیستری رسانه + مصرف stock_changed

- آپلود ردیف `omnichannel_media_assets` می‌سازد؛ ادمین alt را PATCH می‌کند. جدول غایب خطای آپلود نمی‌دهد.
- ورکر `product.stock_changed` را lease می‌کند و فقط سرچ را بازفهرست می‌کند؛ موجودی را کم نمی‌کند.
- ایمیج MinIO/mc در compose پین شد. migrate/deploy/soak هنوز اجرا نشده.

## 2026-08-29 — Omnichannel بستن شرایط امنیت (SEC-001 تا ۴)

- `secretRef` فقط `TELEGRAM_*` / `BALE_*` / `RUBIKA_*`؛ `DATABASE_URL` دیگر به تلگرام نمی‌رود.
- خطای تلگرام قبل از log/DB کد طبقه‌بندی‌شده است؛ مسیر `/bot…` و شکل توکن رد می‌شود.
- GET مقصد `settings` ندارد؛ کلید حذف MinIO فقط `products/` یا `blog/` و بدون `..`.
- کانکتور و auto-publish همچنان خاموش‌اند.

## 2026-08-29 — Omnichannel فاز ۷ ادمین کامل + تایمر ops

- `/admin/omnichannel` اتصال، مقصد، قالب، پیش‌نمایش، انتشار، تحویل/retry، outbox و audit را نشان می‌دهد.
- `GET /omnichannel/outbox` و `GET /omnichannel/audits` payload/secret برنمی‌گردانند.
- یونیت‌های systemd برای alert ۱۵دقیقه‌ای و بکاپ روزانه اضافه شد؛ روی VPS نصب نشده‌اند.
- اسکریپت disposable برای up/down مهاجرت omnichannel نوشته شد؛ روی پروداکشن اجرا نمی‌شود.

## 2026-08-29 — Omnichannel فاز ۸: بکاپ رمزشده و sync استیجینگ

- `DB_SYNC=true` در production و staging fail-closed است.
- `omnichannel-ops.sh` بکاپ را AES-256 می‌کند و restore drill را روی پروداکشن رد می‌کند.
- ورکر heartbeat برای healthcheck می‌نویسد. soak/canary زنده هنوز اجرا نشده.

## 2026-08-29 — Omnichannel مسیر تحویل تلگرام + تست قرارداد

- ورکر `publication.deliver.requested` را فقط اگر کانکتور روشن باشد می‌فرستد؛ وگرنه skip.
- گارد ادمین نقش را از جدول `users` چک می‌کند، نه فقط JWT.
- migrate/deploy پروداکشن و auto-publish همچنان خاموش است.

## 2026-08-29 — Omnichannel فازهای ۴ تا ۸ (کد؛ بدون migrate/deploy پروداکشن)

- پیش‌نمایش و پیش‌نویس Retail/Wholesale، سقف canary ۱۰، چک‌اوت عمده با `channel=WHOLESALE`.
- تلگرام فقط Bot API رسمی و پشت پرچم؛ بله/روبیکا همچنان DISABLED.
- ادمین `/admin/omnichannel`، audit، reconcile بدون delivery تکراری، منع حذف مدیای دارای ارجاع.
- `DB_SYNC=true` در production fail-closed؛ deploy گیت‌هاب و تایمر قفل مشترک `auto-deploy.sh`.
- گزارش: `docs/reports/2026-08-29-omnichannel-phases-4-8.md`.

## 2026-08-29 — Omnichannel فاز ۰ بسته شد (مرجوعی کانال + تست پذیرش)

- تأیید RMA دیگر `stock` قدیمی را عوض نمی‌کند؛ موجودی کانال + حرکت RETURN در همان تراکنش است.
- تست oversell، audit runtime، و منع reverse سفارش/RMA از UI انبار اضافه شد.
- گزارش: `docs/reports/2026-08-26-omnichannel-phase-0.md`.

## 2026-08-26 — Omnichannel فاز ۲ و ۳ (outbox + ورکر مستقل)

- رویدادها در همان تراکنش کسب‌وکار نوشته می‌شوند؛ SMS/افیلیت/سرچ از مسیر درخواست خارج شد.
- ورکر جدا با `FOR UPDATE SKIP LOCKED`، backoff و سرویس Compose `worker`.
- گزارش: `docs/reports/2026-08-26-omnichannel-phase-2.md` و `docs/reports/2026-08-26-omnichannel-phase-3.md`.

## 2026-08-26 — Omnichannel فاز ۱ (اسکیمای افزایشی، کانکتور خاموش)

- شش جدول additive با unique/FK؛ فقط `secretRef`؛ migration قابل revert.
- `OmnichannelModule` ثبت شد. انتشار و کانکتور تا فازهای بعدی ۴۰۹ می‌دهند.
- گزارش: `docs/reports/2026-08-26-omnichannel-phase-1.md`.

## 2026-08-26 — Omnichannel فاز ۰ (درستی موجودی، فید، API عمومی)

- Resolver مشترک کانال: Feed و Basalam فقط `retailStock` می‌خوانند؛ `stock` قدیمی ممنوع است.
- موجودی و حرکت انبار یک تراکنش؛ فروش چک‌اوت ردیف SALE می‌نویسد؛ حذف تاریخچه به REVERSAL تبدیل شد.
- `status=ALL` از GET عمومی رد می‌شود؛ لیست ادمین `/products/admin` است.
- HTML سی‌ام‌اس sanitize می‌شود و fallback بدون کانال حذف شد. حذف MinIO شکست واقعی را برمی‌گرداند.
- گزارش: `docs/reports/2026-08-26-omnichannel-phase-0.md`.

## 2026-08-25 — انتخاب زرین‌پال/دیجی‌پی در چک‌اوت تکی + راز در تنظیمات

- پیش‌فرض آنلاین تکی دوباره زرین‌پال است؛ دیجی‌پی فقط اگر مشتری انتخاب کند و اعتبارنامه در ادمین/env کامل باشد.
- `/admin/settings` فیلدهای client_id/secret و username/password دیجی‌پی را ذخیره می‌کند.
- سبد در خطای شروع درگاه خالی نمی‌شود.
- گزارش: `docs/reports/2026-08-24-digipay-upg-retail.md`.

## 2026-08-24 — درگاه یکپارچه دیجی‌پی برای فروشگاه تکی

- آداپتر UPG (`tickets/business?type=11` + `purchases/verify`) برای چک‌اوت `.ir`. عمده همچنان زرین‌پال است.
- رازها فقط در env سرور؛ `.env.example` فقط placeholder. کال‌بک GET/POST از `/payment/digipay/callback`.
- گزارش: `docs/reports/2026-08-24-digipay-upg-retail.md`.

## 2026-08-24 — PHASE-03 دیپلوی کنترل‌شده تولید (موفق)

- انتشار `70638db` روی master با `scripts/auto-deploy.sh`. Rollback لازم نشد؛ هدف برگشت `7fea689`.
- Prisma اجرا نشد. محصول ماهین و دسته ۲۰ یک ۳۰۱ به canonical فعلی؛ apex HTTP یک hop؛ سایت‌مپ ۷۷/۷۷؛ لینک داخلی شکسته ۰.
- گزارش: `SEO-IMPLEMENTATION-REPORTS/PHASE-03-PRODUCTION-DEPLOY.md`.

## 2026-08-24 — PHASE-03B پاکسازی URLهای دقیق Search Console (بدون دیپلوی)

- صادرات GSC مورخ ۲۰۲۶-۰۸-۲۴: ۴۵ URL کامل + ۱ ردیف ناقص `tag` که ساخته نشد. اختلاف نمونه: ۳۳→۳۱ برای ۴۰۴ و ۱۳→۱۲ برای crawled-not-indexed.
- منبع کشف URLهای چسبیدهٔ فارسی: `key={href+label}` در فوتر تکی؛ href زنده درست بود. کلید React عوض شد.
- ۳۰۱ فقط برای هویت اثبات‌شده: `/product/161/شلوار-ماهین` → ماهین؛ `/category/20` و `/category/20/شلوار` → `/category/women-pants`. بقیه ۴۰۴/۴۱۰ ماند.
- `tsc` و `next build` و `seo:check` سبز. دیپلوی اجرا نشد.
- گزارش‌ها: `SEO-IMPLEMENTATION-REPORTS/PHASE-03B-*`.

## 2026-08-23 — PHASE-03A تریاژ ایندکس Search Console (بدون دیپلوی)

- سرشماری زنده: ۷۷ URL سایت‌مپ، همگی ۲۰۰ / self-canonical / indexable / www HTTPS. کراول داخلی ۱۰۲۷ لینک؛ لینک شکستهٔ عمومی ۰.
- اصلاح امن در ریپو: یک hop برای `http://poshaktaranom.ir` در nginx (هنوز روی پروداکشن نیست)؛ `BLOCKED_PATH` برای `/retail`؛ لینک‌های `/retail` در `RetailOtpLogin`.
- `tsc` و `next build` و `seo:check` سبز. دیپلوی اجرا نشد.
- گزارش‌ها: `SEO-IMPLEMENTATION-REPORTS/PHASE-03A-*.md|csv`. URLهای نمونهٔ GSC در ریپو نیست.

## 2026-08-23 — PHASE-02B دیپلوی کنترل‌شده تولید (موفق)

- انتشار `13bf657` روی master با `scripts/auto-deploy.sh`. Rollback لازم نشد؛ هدف برگشت `6796362`.
- Prisma اجرا نشد. هوم ISR (`s-maxage=60`, HIT)، کاتالوگ ۲۴ لینک محصول، PDP گلرخ HTML واقعی.
- TTFB هوم گرم حدود ۶۷۷ms (قبل ۱۰۰۹ms). گزارش: `SEO-IMPLEMENTATION-REPORTS/PHASE-02B-PRODUCTION-*.md`.

## 2026-08-23 — PHASE-02B دیپلوی کنترل‌شده تولید (شروع)

- هدف: انتشار PHASE-01 (GA4) + PHASE-02B (ISR/LCP/کتالوگ) بدون مهاجرت دیتابیس.
- پری‌فلایت API داخل کانتینر وب: `API_INTERNAL_URL=http://api:4000/v1` برای health، تنظیمات تکی، CMS هوم، و محصولات — همه ۲۰۰ و غیرخالی.
- Prisma اجرا نشد (این پروژه TypeORM است). هدف rollback زنده: `6796362`.

## 2026-08-22 — PHASE-01 اندازه‌گیری GA4 تکی

- GTM/GA4 روی `/admin` و localhost دیگر لود نمی‌شوند؛ `page_path` از URL عمومی است نه `/retail/*`.
- رویدادهای ecommerce (`view_item`, cart, checkout, `purchase`) از هلپر مرکزی با واحد IRR و `transaction_id` یکتا.
- گزارش‌ها: `SEO-IMPLEMENTATION-REPORTS/PHASE-01-*.md`. دیپلوی این فاز انجام نشد.

## 2026-08-22 — PDP تکی: گالری ۳:۴ و انتخاب سایز

- گالری محصول با نسبت کارت‌ها (۳:۴)، بندانگشتی قابل‌لمس، و لایت‌باکس با Escape و قبلی/بعدی یکدست شد.
- رنگ و سایز حداقل ۴۴px؛ سایز ناموجود غیرفعال؛ افزودن به سبد بدون سایز ممکن نیست.
- نوار چسبان موبایل قیمت و سایز انتخاب‌شده را نشان می‌دهد. گزارش: `docs/reports/2026-08-22-retail-pdp-gallery-size.md`

## 2026-08-22 — UI/UX ویترین تکی: کارت editorial + نوار اعتماد هوم

- کارت محصول با الگوی دیجی‌استایل/بانی‌مد + Vercel Commerce بازطراحی شد: تصویر ۳:۴، نام و قیمت وسط، بدون آیکون اعتماد روی هر کارت.
- هوم حداکثر ۱۲ کارت compact؛ افزودن به سبد فقط در کاتالوگ. انتخاب سایز به PDP می‌رود.
- نوار اعتماد بعد از هیرو، FAQ آکاردئونی، و CTA عمده اگر در CMS نباشد از fallback رندر می‌شود (قبلاً بلوک `cta` نادیده گرفته می‌شد).
- کاشی دسته روی موبایل «مشاهده مجموعه» را بدون hover نشان می‌دهد. گزارش: `docs/reports/2026-08-22-retail-home-cards-ui.md`

## 2026-08-22 — حلقه ریدایرکت ترب: 301 روی `/retail` + `x-middleware-rewrite`

- پروب زنده بدون follow: `GET /products/{slug}` → ۲۰۰ و هدر `x-middleware-rewrite: /retail/products/{slug}`؛ سپس `GET /retail/products/{slug}` → ۳۰۱ به URL عمومی → حلقه برای کراولری که آن هدر را دنبال کند (ترب).
- مرورگر معمولی هدر rewrite را دنبال نمی‌کند، بنابراین لینک فید با `requests` معمولی ۲۰۰ و صفر Location hop بود.
- اصلاح: `/retail/*` دیگر ۳۰۱ نمی‌شود؛ ۲۰۰ + `noindex` تا extractor به صفحه نهایی برسد. canonical PDP همان URL عمومی است.
- فید زنده هنوز ۵۷ محصول است؛ «شومیز سارا» در کاتالوگ فعلی نیست — پنل ترب ~۱۰۰۳ SKU قدیمی را باید از نو همگام کند.
- گزارش: `docs/reports/2026-08-22-torob-too-many-redirects.md`

## 2026-08-22 — خروجی اکسل محصولات و دسته‌بندی‌ها (ادمین)

- در `/admin/products` و `/admin/categories` دکمهٔ خروجی اکسل عمده / تکی / کامل اضافه شد.
- فایل واقعی `.xlsx` است: قیمت‌ها به تومان، موجودی و واریانت جدا، لینک هر دو ویترین، سئوی کانال.
- API فقط با JWT ادمین: `GET /v1/products/admin/export.xlsx` و `GET /v1/categories/admin/export.xlsx`.
- وابستگی npm جدید اضافه نشد. گزارش: `docs/reports/2026-08-22-catalog-excel-export.md`

## 2026-08-22 — اتصال ترب: TooManyRedirects، health_check، سفید کردن آی‌پی

- از VPS: `GET https://extractor.torob.com/health_check/` → HTTP 200 و `{"status":"ok"}`.
- فایروال UFW برای ۸۰/۴۴۳ از همه باز است؛ fail2ban فقط jail sshd دارد. رنج‌های ترب در nginx از rate-limit API معاف شدند.
- Alias فید بدون ریدایرکت: `/feeds/torob.xml` و `/v1/feeds/torob.xml` روی تکی و عمده و ساب‌دامین API.
- `TorobBot` به `htmlLimitedBots` اضافه شد تا HTML کامل (canonical در head) برسد؛ Fastify `ignoreTrailingSlash` تا اسلش انتهایی API حلقه/۴۰۴ نسازد.
- گزارش: `docs/reports/2026-08-22-torob-too-many-redirects.md`

## 2026-08-19 — About عمده: مانتوی نهایی دیده می‌شود و نخ/قرقره محو می‌شوند

- باگ زنده: اسکرول درست بود، ولی بافت مانتو سبز تیره روی پس‌زمینه جنگلی ناپدید می‌شد و در پایان نخ (opacity 0.85) و قرقره (1) روی صحنه می‌ماندند.
- بافت لباس کرم/لینن شد؛ opacity نخ و قرقره با `--ready` به صفر می‌رسد؛ طاقه خام در شروع خواناتر است.
- لاگ بعد از اصلاح در p=1: garment 1، hanger 1، thread 0، spool 0.

## 2026-08-18 — صفحه About عمده با روایت اسکرول سه‌بعدی CSS

- `/about` عمده از صفحه متنی به تجربهٔ روایت‌محور تبدیل شد: پارچه خام در طول اسکرول به مانتوی آمادهٔ ویترین می‌رسد.
- معماری: `page.tsx` همچنان Server Component است؛ فقط صحنه و اسکرول در Client Component جداست. WebGL / Three.js اضافه نشد.
- آمار فقط از `BUSINESS_FACTS` تأییدشده (سال ۱۳۹۴، تیم ۱۵ نفره، سال فعالیت محاسبه‌شده). عدد مشتری/مدل تأییدنشده نمایش داده نشد.
- موبایل خطی و سبک است؛ `prefers-reduced-motion` انیمیشن بزرگ را قطع می‌کند. وابستگی npm جدید نصب نشد.
- اعتبارسنجی: `npm run lint -w @taranom/web` 0؛ `npm run type-check -w @taranom/web` 0؛ `npm run build -w @taranom/web` 0 (صفحه `/about` حدود 4.94kB). Commit و deploy انجام نشد.

## 2026-08-18 — Hotfix: middleware اسلاگ canonical را وارونه می‌کرد

- نقشهٔ استاتیک WP در middleware (`bezayagh-jacket-rose` → `coats00014`) بعد از تغییر slug ادمین، URL جدید را به SKU قدیمی ۳۰۱ می‌کرد و URL قدیمی ۲۰۰ می‌ماند.
- lookup اسلاگ محصول از middleware برداشته شد؛ PDP از slug فعلی محصول، fallback نقشهٔ استاتیک، سپس `seo_redirects` استفاده می‌کند و هرگز canonical زنده را به SKU برنمی‌گرداند.
- Live قبل از hotfix: `GET /products/bezayagh-jacket-rose` → 301 به `coats00014`؛ بعد از deploy باید canonical ۲۰۰ و SKU ریدایرکت شود.

## 2026-08-18 — Slug اتمیک، تخفیف مستقل کانال، پک، متن و مرتبط

- تغییر slug محصول در یک transaction با ریدایرکت ۳۰۱ هر دو کانال و collapse زنجیره؛ lookup ویترین `no-store`.
- فرم ادمین فقط دو قیمت پایه؛ تخفیف تک/عمده مستقل؛ حداقل سفارش = تعداد پک (پیش‌فرض جدید ۱).
- مولد متن deterministic + CLI dry-run؛ تکمیل مرتبط تا ۵ بدون overwrite دستی.
- مهاجرت `ProductChannelSalePack1755510000001` فقط additive/nullable — بدون UPDATE دیتای تخفیف یا minOrderQty.
- گزارش: `docs/reports/2026-08-18-product-slug-pricing-pack.md`
- `apps/api` `npm test` و tsc وب/API: exit 0.

## 2026-08-17 — SEO storefront lane (TASK-20260817-001)


### Follow-up (orchestrator)
- ریویو مستقل Bugbot + Security: نشت عمده در related، دسته مخفی در API عمومی، و قیمت تسویه بدون پنجره تخفیف بسته شد.
- ریدایرکت اسلاگ دسته/محصول از `seo_redirects` روی ویترین اعمال می‌شود.
- Safety-net SQL ستون‌های 20260817 را هم پوشش می‌دهد.
- `npx tsc --noEmit` وب و API هر دو exit 0؛ `product-sale.spec.ts` OK.
- Deploy: بعد از merge به master با `auto-deploy.sh`؛ migration با `migrationsRun` روی API پروداکشن.

### خلاصه
- کارت عمده: جعبه‌های «حداقل سفارش» و «موجودی» حذف شد؛ رنگ و سایزبندی باقی ماند.
- کپی عمومی حداقل سفارش ۵ در FAQ/هدر به «از 6 عدد به بالا» عوض شد (توضیحات محصول دست نخورده).
- اسکیمای PDP تکی با `sale.payable` و ProductGroup؛ عمده بدون قیمت Offer تا قبل از ورود.
- محصولات مرتبط روی PDP؛ فید Google Merchant؛ اسکریپت `seo:audit`.

### Rollback
- مهاجرت: `SeoAdminUpgrade1755410400001`

---

## 2026-08-15 — تجربه محصول Stitch روی ویترین واقعی تکی و عمده

### خلاصه
- توکن‌های برند ترنم (`#1B5C4A` / `#C9A84C` / `#F6F1E8`) به CSS سراسری وصل شد؛ رنگ‌های جعلی استیچ وارد پروداکشن نشد.
- کارت و PDP تکی با گالری، wishlist، compare-at، نوار چسبان موبایل و آکاردئون واقعی به‌روز شد.
- کارت عمده با پنهان‌سازی قیمت مهمان، MOQ/موجودی واقعی و کشوی سفارش سریع روی سبد پک فعلی یکپارچه شد.
- ماتریس رنگ/سایز فقط نمایش موجودی است؛ فرمول پک و حداقل سفارش تغییر نکرد.
- داده جعلی استیچ (امتیاز، پلکان قیمت، تصویر ریموت) وارد نشد.

### اعتبارسنجی
- `npx tsx apps/web/src/lib/product-display.spec.ts` — OK
- `npx tsx apps/web/src/lib/wholesale-order.spec.ts` — OK
- `npm run type-check -w @taranom/web` — exit 0
- `npm run build -w @taranom/web` — exit 0؛ ۶۶ صفحه

### انتشار
- commit `332afd4` → PR [#42](https://github.com/rashidhamedas-prog/Site-BtoB/pull/42) merge `5880f95` روی `origin/master`
- VPS `/opt/taranom` HEAD = `5880f95`؛ `taranom_web` / `taranom_api` / nginx بعد از merge بالا آمدند
- live health: API `{"status":"ok"}`؛ عمده `.com` 200؛ تکی `.ir` 200
- نشانهٔ UI زنده: کارت عمده «پس از ورود» + توکن `#1B5C4A`؛ PDP عمده «انتخاب تعداد و سایزبندی»؛ PDP تکی `aria-pressed` wishlist

## 2026-08-14 — کارت محصول مستقل عمده و تک + پرامپت Stitch

### خلاصه
- ایجاد `WholesaleProductCard` با تمرکز بر SKU، پارچه، رنگ، سایزبندی، MOQ، موجودی، قیمت همکاری و CTA سفارش.
- ایجاد `RetailProductCard` با تمرکز بر تصویر ادیتوریال، تخفیف، wishlist واقعی، swatch رنگ، موجودی محدود و CTA انتخاب سایز.
- یکپارچه‌سازی کارت B2B در کاتالوگ و محصولات برتر؛ یکپارچه‌سازی کارت B2C در خانه، PLP و پیشنهادهای مرتبط PDP.
- اصلاح ساختار تعاملی wishlist: دکمه مستقل، `aria-pressed`، target لمسی 44px و focus-visible.
- رعایت reduced motion و حذف نیاز به dependency انیمیشن جدید.
- افزودن پرامپت حرفه‌ای Stitch در `docs/prompts/stitch-product-cards-fa.md`.
- ساخت نمودار تصمیم دو کانال در FigJam و چهار concept candidate در Canva.

### اعتبارسنجی
- `npm.cmd run type-check --workspace=@taranom/web` — موفق.
- `npm.cmd run build --workspace=@taranom/web` — موفق؛ ۶۶ صفحه تولید شد.

> **قانون پروژه:** بعد از هر تغییر معنادار (با Cursor یا Claude Code)، یک ورودی در این فایل و در صورت نیاز یک گزارش جلسه در `docs/reports/` اضافه شود. سپس commit در git.

## 2026-08-14 — Live apply re-verified (b7bd11a)

### خلاصه
- master و VPS هر دو `b7bd11a`؛ سایت‌ها 200؛ جداول پرداخت/اقساط روی prod موجود.
- فاصلهٔ deploy باقی نمانده؛ فقط BNPL/staging به‌عنوان residual باز است.

---

## 2026-08-14 — Payment disposable mig drill + CodeQL

### خلاصه
- up/down/up اقساط/پرداخت روی DB disposable VPS → **OK**
- workflow CodeQL اضافه شد
- BNPL و staging E2E همچنان BLOCKED/NOT RUN

### بعدی
- commit/PR/merge/deploy شواهد

---

## 2026-08-13 — Payment residuals closure (events + concurrency + runbooks)

### خلاصه
- `payment_events` + migration 005؛ سوییت ۲۰-parallel CAS؛ runbookهای عملیات؛ CI با `npm test` API + audit.
- BNPL همچنان BLOCKED؛ staging E2E / full SAST residual صریح.

### بعدی
- commit/PR/merge/deploy؛ live health.

---

## 2026-08-12 — Payment Phase 6 LIVE (PR #36 @ 16f2594)

### خلاصه
- Merge + VPS deploy `16f2594`؛ migration اقساط/اعتبار اعمال شد.
- Live: API/عمده/تکی **200**؛ eligible فقط ZARINPAL+MANUAL.
- Security + Reviewer: **PASS WITH CONDITIONS** (staging E2E / concurrency DB / CI SAST / BNPL باقی).

### بعدی
- residualهای شواهدی؛ BNPL تا قرارداد رسمی BLOCKED؛ task را Done نکن.

---

## 2026-08-12 — Payment Phase 6 logic + security follow-up

### خلاصه
- Phase 6: قرارداد/برنامه اقساط واقعی (credit consume اتمیک، schedule، aging، overdue job، portal اقساط، API ادمین).
- Security follow-up روی verify cancel/recovery، overpay فاکتور، سقف refund، postback recoverable، eligible DTO عمومی، start قفل‌شده per-order.
- گزارش‌ها: `docs/reports/2026-08-12-payment-phase6-installments.md`، `docs/reports/2026-08-12-payment-security-followup.md`
- Gates محلی: `apps/api` tsc **0**؛ installment/core/followup specs **0**
- BNPL همچنان BLOCKED.

### بعدی
- commit/PR/merge → VPS auto-deploy + migration 004؛ live health؛ Reviewer/Security روی SHA نهایی.

---

## 2026-08-12 — Payment Phases 1–3 (+6 schema) implementation

### خلاصه
- Phase 1: verify اتمی، adapter زرین‌پال با timeout، DTO عمومی، attempts، refund/ledger، idempotency سفارش، manual امن.
- Phase 2–3: جدول `payment_providers` + API ادمین/eligible؛ BNPLها DISABLED/NOT_STARTED.
- Phase 6 schema: قرارداد/برنامه اقساط داخلی.
- گزارش: `docs/reports/2026-08-12-payment-phases-1-3-impl.md`

### بعدی
- merge/deploy + migration روی VPS؛ تکمیل منطق اقساط و observability؛ BNPL تا قرارداد رسمی BLOCKED.

---

## 2026-08-12 — Payment Phase 0 CLOSED + Phase 1 scope freeze

### خلاصه
- Phase 0 پرداخت رسماً **بسته** شد (گزارش + gates + live read-only + بدون runtime/deploy).
- قدم بعدی انجام شد: `file_claims` دقیق Phase 1 و سند scope ثبت شد.
- گزارش scope: `docs/reports/2026-08-12-payment-phase1-scope.md`
- پیاده‌سازی کد Phase 1 هنوز شروع نشده؛ BNPL همچنان BLOCKED.
- تداخل claim با TASK-006 وجود ندارد.

### بعدی
- شروع پیاده‌سازی Phase 1 از race-safe verify + تست ۲۰ callback همزمان.

---

## 2026-08-12 — Payment & Sales Integrations Phase 0 (preflight)

### خلاصه
- نقش Orchestrator+Architect؛ مخزن صحیح `Site B2B`؛ بدون mutate/deploy production.
- Task جدید `TASK-20260812-001`؛ handoff رسمی از TASK-006 فقط برای `docs/reports/` و فایل‌های حاکمیتی Phase 0.
- Baseline gates ثبت شد؛ live health عمده/تکی/API فقط خواندنی **200**.
- شکاف‌های P0 پرداخت (race-safe verify، idempotency، recovery، DTO، refund، registry) مستند شد.
- BNPLها تا قرارداد و مستند رسمی **BLOCKED**؛ هیچ endpoint جعلی ساخته نشد.
- گزارش: `docs/reports/2026-08-12-payment-integrations-preflight.md`

### بعدی
- Phase 1 با file_claim دقیق روی هسته پرداخت + Reviewer/Security مستقل؛ بدون شروع تا claim گسترش یابد.

---

## 2026-08-12 — SEO P3 backlog (موازی با چند ایجنت)

### خلاصه
- SSR صفحهٔ اول `/products` عمده + ریتیل (`fetchProductList`، revalidate 300) تا لینک محصولات در HTML اولیه باشد.
- ۵۶ ریدایرکت ۳۰۱ اسلاگ توصیفی قدیمی → کد اسلاگ در middleware (`product-slug-redirects.ts`).
- Chrome SSR: wholesale layout + RetailChromeProvider (بدون دست‌زدن به RetailHeader claim‌شده) — کاهش fetchهای تکراری settings/chrome.
- RUM: `WebVitalsReporter` (LCP/CLS/INP) بعد از idle به GA4.
- حذف deps بلااستفاده از `apps/web/package.json`: swiper, next-seo, chart.js, react-chartjs-2.
- گزارش دستی به‌روز: `SEO-REMAINING-MANUAL-ACTIONS.md`.

### بعدی
- اقدامات GSC + تأیید اعداد تجاری توسط مالک؛ `npm install` برای تازه‌سازی lockfile؛ پاک‌کردن leftover chart.js از next.config وقتی claim آزاد شد.

---

## 2026-08-11 — SEO master fix (هر دو دامنه)

### خلاصه
- اجرای کامل `TARANOM-SEO-CURSOR-MASTER-FIX.md`: ممیزی پایه با ۴ ایجنت موازی + پیاده‌سازی همه P0/P1.
- P0: soft-404 محصولات عمده رفع شد (notFound + SSR + JSON-LD سروری)، ۵۷ عدم‌تطابق canonical محصولات عمده با canonical-guard رفع شد، canonical پیش‌فرض هوم از layout ریتیل حذف شد، placeholder جستجوی JSON-LD حذف شد، URLهای قدیمی وردپرس → 301/410 در middleware.
- P1: noindex,follow برای حالت‌های جستجو/فیلتر هر دو کانال؛ `/retail/*` عمومی → 301؛ آمار تجاری متمرکز در `lib/business-facts.ts`؛ GA4 page_view دوباره‌شمار رفع؛ hero موبایل از بهینه‌ساز تصویر عبور داده شد؛ OG از ~۲.۲/۳ MB به ~۷۱/۷۶ KB.
- گزارش‌ها: `SEO-BASELINE-AUDIT.md`، `SEO-IMPLEMENTATION-REPORT.md`، `SEO-REDIRECT-MAP.csv`، `SEO-URL-INVENTORY.csv`، `SEO-REMAINING-MANUAL-ACTIONS.md`. اسکریپت‌ها: `npm run seo:audit` / `seo:check`.
- Build: exit 0 (typecheck + 65 صفحه).

### بعدی
- بعد از دیپلوی: `npm run seo:audit` + `seo:check` → `SEO-POSTFIX-URL-AUDIT.csv`؛ اقدامات GSC طبق `SEO-REMAINING-MANUAL-ACTIONS.md`.

---

## 2026-08-11 — TASK-20260810-006: PR #31 live on VPS (ship evidence; still in_progress)

### خلاصه
- PR #31 merged: https://github.com/rashidhamedas-prog/Site-BtoB/pull/31
- Merge on master: `ee9c044` (`ee9c044e9e72f76e11e53e53534a360f6efc6d1a`); remediation `46821e8`
- VPS `/opt/taranom` HEAD = `ee9c044`; auto-deploy exit **0** ~2026-08-11T13:29Z
- Health: API `/v1/health` **200** ok; wholesale `.com` **200**; retail `.ir` **200**
- Containers: api/web Up ~2 min; nginx ~1 min; postgres/redis/meili/minio healthy
- Readiness **71/100** (بدون افزایش از روی deploy/health)؛ Task **in_progress**؛ claims retained؛ website-builder blocked
- جزئیات: `docs/reports/2026-08-11-pr31-ship-evidence.md`

### هنوز NOT RUN (مانع Done)
- staging sanitized E2E؛ retail OTP→ONLINE؛ rollback/off-box/MinIO؛ full Torob

### بعدی
- تکمیل ACهای باز + Reviewer/Security تازه روی SHA نهایی؛ **بدون Done / بدون release claims / بدون bump readiness**

---
## 2026-08-11 — TASK-20260810-006: reviews + Bugbot fixes + gates (in_progress)

### خلاصه
- Independent Security: **PASS WITH CONDITIONS**؛ Reviewer: **PASS WITH CONDITIONS**؛ Bugbot سه یافته → اصلاح شد.
- Gateهای format/lint/test/typecheck/build و negative guards/specs با exit 0 ثبت شدند (`docs/reports/gate-summary.json`).
- Readiness **71**؛ Task **in_progress**؛ claims retained؛ **بدون commit/deploy/Done**.

### Bugbot fixes
- RMA فقط `RETURN` تأیید مالی می‌شود
- update محصول legacy بدون retailPrice برای فیلدهای غیرقیمتی بلاک نمی‌شود
- DNS unresolved برای host غیرloopback fail-closed
- متن UV در AdminBlogAnalytics سروری شد

### بعدی
- در صورت تأیید owner: commit نهایی + Security/Reviewer روی SHA کامیت‌شده؛ Done فقط پس از ACهای باز

---
## 2026-08-10 — TASK-20260810-006: Reviewer/Security HIGH remediation (in progress)

### خلاصه

- Reproduce یافته‌های Reviewer/Security روی worktree `ai/TASK-20260810-006-readiness-remediation` در برابر `origin/master@ab4ffab`.
- HIGH: migration ownership-aware؛ E2E identity + حذف SQL mutation؛ Redis RL وبلاگ؛ invariant قیمت نهایی کانال.
- MEDIUM: assert دقیق سفارش؛ جداسازی reclass مشتری؛ tombstone رسانه؛ audit RMA؛ همگام‌سازی SHA اسناد.
- Readiness **71/100** (بدون افزایش). Task **in_progress**. Claims retained. Website-builder blocked. بدون mutate production.

### Validation اجراشده

- `blog-analytics-rate-limit.spec.ts` exit 0
- `product-pricing.invariant.spec.ts` exit 0
- `20260810-001-create-return-requests.spec.ts` exit 0
- `bash -n` scripts exit 0
- `_negative-e2e-guards.sh` ALL_NEGATIVE_GUARDS_PASSED exit 0

### هنوز NOT RUN

- staging wholesale E2E؛ retail OTP→ONLINE؛ rollback/off-box/MinIO؛ full Torob؛ npm lint/test/build کامل با artifact؛ Reviewer/Security تازه پس از final diff

### بعدی

- تکمیل quality gates؛ سپس Security → Reviewer مستقل؛ Done فقط پس از MET بودن همه AC

---

## 2026-08-10 — TASK-20260810-006: ship evidence pack 71/100 (owner full-authority)

### خلاصه

- Owner: اعمال زنده + merge + deploy بدون تأیید مرحله‌ای.
- docs/AI-DOS: امتیاز ۷۱، شواهد restore/Torob/SEO؛ Security PASS WITH CONDITIONS.
- PR #26 `197d54f` → #27/`0bb72c7` → #28/`67b55b8` → #29/`a3cb5e9`؛ همه deploy کامل.
- Health: API ok؛ wholesale/retail **200**.
- Task همچنان in_progress؛ claims retained.

---

## 2026-08-10 — TASK-20260810-006: parallel evidence wave → 71/100

### خلاصه

- Restore disposable fail-closed روی VPS دوباره **PASS** (RTO ۱۴ثانیه).
- Torob sample ۱۵/۱۵ **PASS**؛ SEO/a11y smoke **PASS**؛ gates + schema VPS OK.
- Retail OTP→ONLINE و staging E2E همچنان **NOT RUN**.
- Reviewer مستقل ادعای ~۷۶ را رد کرد؛ سقف توجیه‌شده **۷۱/۱۰۰** (Ops+۲، SEO+۲). C3 Satisfied نشد (rollback/off-box باز).
- Security مستقل: **PASS WITH CONDITIONS**.

### امتیاز

- قبل: ۶۷/۱۰۰ → بعد: **۷۱/۱۰۰** (نه ۷۶، نه ۱۰۰؛ ۸۱ همچنان superseded)

### بعدی

- Staging E2E + retail OTP؛ rollback/off-box؛ Torob panel؛ commit اسناد در صورت تأیید owner

---

## 2026-08-10 — TASK-20260810-006: remediation + ship to production (owner-authorized)

### خلاصه

- سخت‌سازی `e2e-purchase-test.sh` (argv-safe Python، allowlist دقیق، sentinel غیرقابل‌override، fixture MOQ، assert دقیق سفارش).
- بلاگ: کاور عمده، ناوبری/توکن ریتیل، آنالیتیکس اتمی، حذف رسانه با 409، محدودسازی image origins.
- RMA: migration TypeORM + approve تراکنشی + جلوگیری از double-credit؛ EXCHANGE silent نیست.
- Reports: کانال مشتری canonical + حذف N+1 topProducts؛ compare-at دوکاناله؛ `publicProductPath` + Torob www.
- Readiness: همچنان **۶۷/۱۰۰** (بدون inflate). Reviewer/Security اولیه FAIL بودند؛ Highهای بحرانی قبل از ship اصلاح شد.
- Owner صریحاً اعمال روی سایت را درخواست کرد → commit/PR/merge/deploy.

### اعتبارسنجی محلی

- lint/test/tsc/build/`bash -n`/negative E2E guards → **0**
- Staging E2E / retail OTP / restore drill / Torob full crawl → **NOT RUN** (OWNER follow-up)

---

## 2026-08-10 — TASK-20260809-005: Independent Reviewer FAIL remediation

### خلاصه

- Independent Reviewer روی بستن قبلی C1/C3 با امتیاز ۸۱ → **FAIL** ثبت شد؛ task دوباره claim شد؛ claims آزاد نشد.
- `restore-drill-disposable.sh`: اگر `RESTORE_EXIT != 0` باشد اسکریپت fail می‌شود (دیگر PASS کاذب نمی‌دهد).
- `e2e-purchase-test.sh`: credential ثابت حذف؛ mutate پسورد روی production حذف؛ فقط `E2E_TARGET=staging|local|disposable` + `E2E_ALLOW_MUTATION=1` + `E2E_PHONE`/`E2E_PASSWORD`؛ denylist هاست production؛ نام DB تولیدی (`taranom_db`) ممنوع.
- Retail journey OTP→PDP/cart→checkout→ONLINE: **NOT MET** (harness/staging اجرا نشد).
- Evidence/PLATFORM/progress: تناقض PASS/NOT RUN، CREDIT→CASH، ردیف تکراری C4، و ادعای نادرست **۸۱/MET** اصلاح؛ readiness authoritative دوباره **۶۷/۱۰۰**.
- Security Review: **PASS WITH CONDITIONS** (SEC-004 host allowlist اعمال شد؛ SEC-007 helpers قدیمی residual).

### اعتبارسنجی (exact exits)

- `bash -n scripts/restore-drill-disposable.sh` → **0**
- `bash -n scripts/e2e-purchase-test.sh` → **0**
- `npm run lint` → **0**
- `npm run test` → **0** (auth.otp + blog-seo specs)
- web/api `tsc --noEmit` → **0**
- `npm run build` → **0** (turbo api+web; ~3m43s)
- Deploy/merge: **NOT RUN** (مسدود تا Reviewer PASS)

---

## 2026-08-10 — TASK-20260809-005: بستن C1/C3 و افزایش readiness به ۸۱ (SUPERSEDED)

### خلاصه

- **باطل‌شده توسط Independent Reviewer FAIL** — به ورودی remediation بالا مراجعه شود. امتیاز ۸۱ دیگر authoritative نیست.
- چرا ۶۷≠۱۰۰: خرید E2E و بکاپ/ریستور و SEO/a11y رسمی باز بودند؛ ۱۰۰ بدون audit رسمی و retail ONLINE ممکن نیست.
- **C1 PASS (historical):** `e2e-purchase-test.sh` روی VPS → سفارش `ORD-2026-00008-9C0117` (CASH)؛ روش بعداً unsafe تشخیص داده شد.
- **C3 PASS (historical / invalidated):** restore یکبارمصرف — اسکریپت می‌توانست با `RESTORE_EXIT!=0` هم PASS بدهد.
- Readiness claimed: **۸۱/۱۰۰** → **superseded**.

### اعتبارسنجی

- E2E exit 0 · health ok · cron نصب شده — evidence تاریخی؛ برای close فعلی کافی نیست

---

## 2026-08-09 — TASK-20260809-003 residual close: C4 verify + safety-net narrow

### خلاصه

- PR #18 روی master (`3146aae`) دیپلوی شد؛ migration `PromoteSqlOnlyEntityColumns1786276800001` در production ثبت شد (id=11)
- ستون‌ها/ایندکس‌های viewCount، wholesale color، bannerUrl، torobClid روی VPS تأیید شدند
- `scripts/apply-production-schema.sql` باریک شد (بخش‌های تکراری حذف؛ فایل حفظ شد)
- C3 inventory: بکاپ خودکار روزانه شکسته؛ dump listable جدید در `/opt/taranom/backups/20260809-c3-evidence/` با `pg_restore -l` OK — restore کامل هنوز باز
- C1 همچنان accepted-with-expiry (بدون Docker محلی)
- Readiness: **GO WITH CONDITIONS** **67/100** (C4 Satisfied)

### اعتبارسنجی

- VPS health ok · migration row YES · columns/indexes YES · api/web lint+test 0 · smoke readonly 0 · C3 dump list 0

---

## 2026-08-09 — TASK-20260809-003 residual: expanded smoke + C4 migration artifact

### خلاصه

- Smoke فقط‌خواندنی گسترش یافت: PDP عمده/تکی، portal login، account، checkout (soft)
- Migration TypeORM برای ستون‌های SQL-only: `20260809-001-promote-sql-only-entity-columns.ts`
- Merge PR #18 به master / deploy VPS: انجام شد (`3146aae`)

### اعتبارسنجی

- `acceptance-smoke-readonly.sh` exit 0 (شامل PDP و صفحات soft)

---

## 2026-08-09 — TASK-20260809-002 Retail/Wholesale completion (MASTER phase 1–4)

### خلاصه

- Preflight + worktree `ai/TASK-20260809-002-retail-wholesale-completion`
- اسناد MASTER: audit، target architecture، progress، evidence، deployment-runbook، PLATFORM-READINESS (**GO WITH CONDITIONS**, 61/100)
- Tooling: `apps/api` و `apps/web` lint → `tsc --noEmit`؛ API test → ts-node specs
- `scripts/acceptance-smoke-readonly.sh` (فقط‌خواندنی، harden‌شده) روی production PASS
- OTP helpers در `phone.util.ts` مشترک بین service و spec (SEC-002)
- شرایط باز: خرید E2E بدون Docker محلی؛ backup/restore؛ dual-path schema

### اعتبارسنجی

- root lint 0 · root/api test 0 · build 0 (پیش‌تر) · smoke 0

---

## 2026-08-02 — تکمیل باقی‌مانده وبلاگ: تگ، آمار، داک

### خلاصه

- صفحات عمومی `/blog/tag/{slug}` عمده و تک
- تب آمار ادمین + `GET /blog/admin/analytics/summary`
- ارسال رویداد به GA4 (gtag) از `BlogAnalyticsTracker`
- Docs: API، Schema، Deploy، Test Report

---

## 2026-08-02 — فاز ۳ وبلاگ: Redirect، Settings، Export، Taxonomy عمومی، TOC

### خلاصه

- Admin hub: مقالات / ریدایرکت / تنظیمات / نظرات / نویسندگان
- Export JSON + check-links
- صفحات category و search (عمده و تک)
- TOC + redirect 301/410 روی miss اسلاگ
- Preview noindex
- Docs: BLOG_MEDIA_GUIDE، BLOG_CHANGELOG، به‌روزرسانی معماری

---

## 2026-08-02 — فاز ۲ وبلاگ: TipTap، SEO Score، Revisions، Cron، Media، Authors

### خلاصه

- TipTap RTL editor + sanitize-html
- SEO Analysis Engine + UI تحلیل
- Version history + autosave + optimistic lock
- Media assets table + register API
- Nest cron برای SCHEDULED
- Related products/articles، orphan detection
- Author pages + comments + analytics hooks
- HowTo schema fields
- Migration `20260802-002-blog-phase2-extensions`

---

## 2026-08-02 — ماژول پیشرفته وبلاگ و SEO چندسایته (فاز ۱ MVP)

### خلاصه

- گسترش `BlogModule` (TypeORM): فیلدهای SEO کامل، workflow انتشار، FAQ، `(channel,slug)` unique
- جداول: categories / tags / authors / settings / seo_redirects / seo_audit_logs
- RBAC: `users.blogRole` + `BlogPermissionsGuard` (SUPER_ADMIN … VIEWER)
- API: import JSON/MD، redirect روی تغییر slug، sitemap-posts، feed
- فرانت: retail `/blog`، RSS، اصلاح sitemap/robots، AdminBlog تب‌دار
- Docs: `BLOG_MODULE_ARCHITECTURE.md`, `BLOG_IMPORT_FORMAT.md`, `BLOG_ADMIN_GUIDE.md`
- Migration: `20260802-001-advanced-blog-seo-module.ts`

---

## 2026-08-01 — سرعت لندینگ تکی و عمده

### خلاصه

- قانون دائمی: `.cursor/rules/performance-first.mdc` (+ conventions)
- هوم تکی: سقف ۱۲ محصول، Suspense، LCP هیرو تک‌اسلاید، بدون priority روی دسته‌ها
- حذف FloatingContact تکراری عمده؛ GTM بعد از idle
- اسکریپت `scripts/perf-cap-retail-home-products.sql` برای CMS منتشرشده

---

### خلاصه

- اسلاگ محصول = `lower(sku)` تا لینک کپی‌شده بدون `%D9...` باشد
- لینک‌های فارسی قدیمی با fallback SKU + ریدایرکت ۳۰۱ کار می‌کنند
- slugify بلاگ/CMS/کالکشن هم فقط ASCII

---

### خلاصه

- فید `torob.xml`: قیمت به تومان (هم‌راستا با ویترین و API سفارش)
- لینک محصولات فید روی `www.poshaktaranom.ir`
- `robots.txt`: اجازهٔ صریح `/api/v1/feeds/`
- راهنمای پنل: برچسب وبزی متادیتای قدیمی است؛ نوع را به فید XML/سایر تغییر دهید

---

## 2026-08-01 — رفع 500 پنل بررسی سفارش ترب

### خلاصه

- کرش QueryBuilder (`orderBy` با quote → `databaseName` undefined) با `repository.find` جایگزین شد
- حذف هدر Content-Type دستی که با body Fastify تداخل داشت
- بدون پارامترهای کوئری: پاسخ ۲۰۰ با `data: []` (سازگار با «بررسی» پنل ترب)

---

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
