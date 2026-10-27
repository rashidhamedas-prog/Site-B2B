# سند نیازمندی فنی: وضعیت فعلی ماژول Omnichannel («کانال انتشار»)
تاریخ: ۱۴۰۵/۸/۵ (2026-10-27، حدود ۱۶:۳۰ به وقت تهران). این کار فقط خواندنی بود: فقط grep روی کد و SELECT داخل `BEGIN READ ONLY` اجرا شد. هیچ تغییری در کد، env، DB یا deploy داده نشد.
- **نسخهٔ کد روی سرور ایران:** `/opt/taranom` در commit `3a5a2155`، تاریخ 2026-10-27 11:11 UTC (برابر ۱۴:۴۱ تهران).
- **مسیر شماره خط‌ها:** شماره خط‌ها مربوط به `apps/api/src/modules/omnichannel/` است، مگر جایی که مسیر دیگری ذکر شده باشد.
- **منابع:** `omnichannel-media-rca-2026-10-24.md`، `omnichannel-status-2026-10-24-1910.md`، `bale-rubika-no-send-rca-2026-10-24.md`، `pr97-rollout-2026-10-24.md`، `telegram-worker-iran-env-2026-10-24.md`، `omnichannel-qa/*` و `server-capacity-2026-10-27.md`.

## ۱. معماری
- **اندازهٔ ماژول:** حدود ۱۱.۶ هزار خط TS. هستهٔ آن `services/omnichannel.service.ts` با ۳۵۰۸ خط است؛ این god-service مهم‌ترین بدهی فنی ماژول است.
- **API:** `controllers/omnichannel-admin.controller.ts` حدود ۴۰ endpoint دارد:
  - status: خط 48
  - secrets: خطوط 94 و 100
  - settings: خطوط 106 و 112
  - connections (CRUD، test، canary-ping، discover-chats): خطوط 118 تا 174
  - destinations (verify، test-post، publish-settings): خطوط 181 تا 228
  - templates: خطوط 235 تا 250
  - preview: خط 255
  - publications: خطوط 261 و 267
  - deliveries: خط 272
  - outbox: خط 277
  - outbox/clear-waiting: خط 282
  - outbox/revive-connector-disabled: خط 289
  - requeue-by-category: خط 296
  - audits: خط 303
  - deliveries/:id/retry: خط 308
  - deliveries/:id/reapprove: خط 313
  - bulk-withdraw: خط 319
  - publications/:id/withdraw: خط 329
  - reconcile: خط 335
  - media: خطوط 340 تا 350
  - **هیچ endpointی برای حذف یک پیام مشخص وجود ندارد.** حذف فقط از راه withdraw کل publication در یک مقصد انجام می‌شود.
- **Outbox:**
  - انتشار رویداد در `services/outbox.service.ts` است، با `maxAttempts: 8` در خط 214.
  - `services/outbox-worker.service.ts` (۵۳۵ خط) در کانتینر `taranom_worker` با `OMNICHANNEL_WORKER=true` اجرا می‌شود.
  - صف lease-based است: `services/outbox-lease.ts`، تابع `shouldDeadLetter` در خط 85.
  - وضعیت‌های outbox (`omnichannel.constants.ts:10`): PENDING، PROCESSING، DONE و DEAD. آمار امروز: DONE=4144 و DEAD=10.
- **دیتامدل انتشار:** publication (محصول و قالب) به چند delivery می‌رسد، یک delivery برای هر destination.
  - وضعیت‌های delivery (`omnichannel.constants.ts:32`): PENDING، PROCESSING، SUCCEEDED، RETRY، DEAD و HOLD.
  - action هر delivery یکی از CREATE، UPDATE یا DELETE است. اگر مقصد پست فعال داشته باشد، انتشار جدید به‌جای CREATE یک UPDATE می‌سازد؛ رفتار روبیکا که در RCA 24 اکتبر دیده شد از همین است.
  - **supersededAt** (`entities/publication-delivery.entity.ts:75`): یکتایی CREATE فعال با یک index جزئی تضمین می‌شود. شرطش `status IN (PENDING,PROCESSING,RETRY,SUCCEEDED,HOLD) AND action='CREATE' AND supersededAt IS NULL` است (خط 14، و `delivery-dedupe-sql.ts:9`). نسخه‌های تکراری با `lastError='superseded_duplicate'` به DEAD می‌روند (`outbox.service.ts:336`، `omnichannel.service.ts:2126` و 3235).
  - **reapprove** (`omnichannel.service.ts:1907` تا 1956): ستون `reapprovedAt` (entity، خط 84) را ثبت می‌کند و delivery را برای slot بعدی دوباره فعال می‌کند. این کار روی DEAD، FAILED، HOLD، RETRY و PENDING ممکن است.
  - اگر پست فعلی SUCCEEDED باشد، ابتدا supersede می‌شود (خطوط 1923 تا 1942).
  - HOLD همیشه به reapprove انسانی نیاز دارد (`delivery-idempotency.ts:11`). REUSABLE فقط شامل DEAD و FAILED است (خط 12).
  - `isStaleDelivery` (خط 161) بر اساس مقدار reapprovedAt کار می‌کند.
  - **revive:** `outbox/revive-connector-disabled` فقط DEADهایی را برمی‌گرداند که علتشان خاموش بودن connector بوده (`omnichannel.service.ts:1158`، `outbox.service.ts:296`). DEADهای دیگر خودکار retry نمی‌شوند.
- **آمار deliveries تا امروز:**

| provider | SUCCEEDED | DEAD | از DEADها superseded |
|---|---|---|---|
| BALE | 31 (آخرین 26 اکتبر، 19:32 تهران) | 23 | 21 |
| RUBIKA | 71 (آخرین 25 اکتبر، 20:20) | 10 | 1 |
| TELEGRAM | 64 (آخرین 25 اکتبر، 20:28) | 33 | 19 |

## ۲. رفتار صف
- **تنظیمات per-connection:** `connection-publish-settings.ts:260` تا 275 در `resolveConnectionPublishSettings` این‌ها را تعیین می‌کند: mode، dailyCap، minGapSeconds، quietStart و quietEnd، withdrawAction و oosPolicy.
- **مقادیر پیش‌فرض کد** (`omnichannel.constants.ts:170` تا 181): mode=OFF، dailyCap=20، minGap=90s، withdraw=DELETE.
- **مقادیر تنظیم‌شده در production** طبق RCA 24 اکتبر: **فاصلهٔ 900 ثانیه (۱۵ دقیقه)، سقف روزانهٔ 10، و ساعت سکوت از 23 تا 12 به وقت تهران.** سکوت فقط وقتی اعمال می‌شود که هر دو مقدار شروع و پایان تعریف شده و با هم برابر نباشند (خط 262).
- **منطق slot:** `publication-automation.ts:57` تا 74 سقف روزانه را چک می‌کند (`remainingDailyCreates`) و بعد ساعت سکوت را (خط 65).
  - اگر سقف پر باشد، ارسال به نیمه‌شب بعد + quietEnd + jitter منتقل می‌شود (`delivery-idempotency.ts:185` تا 188).
  - سقف روزانه فقط پست‌های CREATE را می‌شمارد. پیام خطای فارسی این حالت در `omnichannel.service.ts:1250` و 1508 است.
- **تقدم CANARY و LIVE:**
  - تنظیم سطح connection (اگر seeded باشد یا autoPublishMode داشته باشد) بر تنظیم سراسری `app_settings.omnichannel` غلبه می‌کند (`connection-publish-settings.ts:235` تا 264، و `publication-automation.ts:98`).
  - در production هر سه connection روی **LIVE** هستند و CANARY سراسری عملاً فقط fallback است.
  - پنل باید مقدار مؤثر و منبع آن را نشان دهد.
- **kill-switch:** متغیر `OMNICHANNEL_DISABLED_PROVIDERS` (`omnichannel.constants.ts`، تابع `isOmnichannelProviderEnabled`) فقط روی worker اثر دارد. چون api آن را ندارد، تست‌ها و canary-ping موفق می‌شدند ولی ارسال واقعی DEAD می‌شد. حادثهٔ 24 اکتبر از همین بود. امروز این متغیر روی worker تنظیم نیست.
- **پایداری در برابر restart:** پیش از claim اتمی، دو worker با هم رقابت داشتند و duplicate تولید می‌شد. به همین دلیل worker-b در `auto-deploy.sh` خاموش نگه داشته می‌شود.

## ۳. Providerها
- **تلگرام:**
  - **مسیر:** از سرور ایران فقط از راه Cloudflare Worker `taranom-telegram-egress` با `TELEGRAM_API_URL=https://taranom-telegram-egress.taranomsms.workers.dev` ارسال می‌کند (`adapters/telegram.adapter.ts:44`، تابع `telegramApiBase`).
  - **دسترس‌پذیری:** دامنهٔ workers.dev از ایران ناپایدار یا مسدود است (timeout و fetch failed). دامنهٔ اختصاصی لازم است.
  - **حالت رسانه:** `TELEGRAM_MEDIA_UPLOAD_MODE` در `adapters/telegram-media.ts:5` تا 16 تعیین می‌شود. مقدار پیش‌فرض `url` است و هر مقدار ناشناخته هم به url برمی‌گردد.
    - در حالت url، تلگرام عکس را خودش از origin ایرانی fetch می‌کند و همین علت `WEBPAGE_CURL_FAILED` بود.
    - در حالت `upload`، فرایند خودش فایل را از MinIO می‌خواند و با Sharp پردازش می‌کند (حد fetch برابر 15MiB، خط 28). سپس آن را multipart با `attach://photoN` از طریق Worker می‌فرستد.
    - این متغیر روی worker تنظیم شده، ولی مقدارش را چاپ نکردم.
- **بله** (`adapters/bale.adapter.ts`):
  - **روش ارسال:** sendPhoto، sendMediaGroup یا sendMessage، بسته به تعداد عکس (خط 179). عکس **به‌صورت URL** فرستاده می‌شود (خطوط 199 و 205).
  - **محدودیت‌ها:** caption آلبوم حداکثر 1024 کاراکتر است. آلبوم reply_markup ندارد و دکمه‌ها در یک پیام متنی جدا می‌آیند. `deleteMessage` فقط برای پیام‌های **کمتر از 48 ساعت** کار می‌کند (خطوط 23 تا 26 و 266). timeout برابر 12s است (خط 62).
  - **حادثهٔ UNSUPPORTED_FILE (SKU 5047):** JPEG در دقیقاً 5,242,880 بایت بریده شده بود.
  - **وضعیت اصلاح:** `modules/upload/upload-bytes.ts` اکنون حالت truncated را تشخیص می‌دهد و `UploadTooLargeError` برمی‌گرداند. سقف جدید `MAX_UPLOAD_IMAGE_BYTES = 20MiB` است (`modules/upload/upload-image-policy.ts:2`، `main.ts:49`). اما فایل‌های خراب قدیمی هنوز اسکن نشده‌اند.
- **روبیکا** (`adapters/rubika.adapter.ts`):
  - رسانه را خودش دانلود (15s، خط 317) و آپلود (30s، خط 329) می‌کند.
  - editMessageText و deleteMessage دارد (خطوط 25 و 306).
  - خطاهای شبکه را به provider_unavailable نگاشت می‌کند (خط 96).
- **توکن‌ها:** توکن‌های بله و روبیکا در vault رمزگذاری‌شده نگهداری می‌شوند (`omnichannel-token-vault.ts`، با `OMNICHANNEL_VAULT_KEY`).
  - **ریسک امنیتی:** `TELEGRAM_BOT_TOKEN` هنوز به‌صورت env در worker هست. باید به vault منتقل شود.

## ۴. پنل ادمین: توانایی‌ها و کمبودها
- **فایل‌ها:** `apps/web/src/app/admin/omnichannel/page.tsx`، `components/admin/admin-omnichannel-ui.tsx` و `admin-omnichannel-outbox.ts`.
- **توانایی‌های فعلی:** مدیریت connection و destination، verify، test-post، canary-ping، قالب و preview، انتشار تکی و dry-run، فهرست publication و delivery و outbox، retry و reapprove، withdraw تکی و گروهی، requeue بر اساس دسته، revive، clear-waiting، audits و reconcile.
- **کمبودها:**
  1. **حذف یک پیام مشخص وجود ندارد.** پاکسازی ۳۶ پیام تکراری بله در 26 اکتبر با اسکریپت Bot API در کانتینر انجام شد.
  2. **link builder برای پست‌های بله وجود ندارد.** لینک پست یا محصول ساخته نمی‌شود و لینک کانال بله به تلگرام می‌رود.
  3. **تشخیص تکراری قابل‌مشاهده برای ادمین وجود ندارد.** ۹ محصول در بله پست تکراری داشتند و این فقط با SQL پیدا شد.
  4. ماتریس پوشش محصول در کانال‌ها وجود ندارد. ۶ محصول در روبیکا بودند ولی در بله نه.
  5. وضعیت مؤثر providerها (kill-switch در worker، مقدار env، سلامت مسیر Worker) در پنل دیده نمی‌شود.
  6. **انتشار در عمل به اسکریپت داخل کانتینر نیاز داشت.** endpoint انتشار نشست ادمین می‌خواهد، و انتشارهای 7157 و ۵ SKU بله با اسکریپت `createPublication` داخل کانتینر انجام شد. این خلاف قانون «فقط از پنل» است.
  7. ویرایشگر قالب جداگانه برای هر کانال، با پیش‌نمایش زنده، وجود ندارد.
  8. اعتبارسنجی رسانه‌های موجود و دکمهٔ «اسکن و فشرده‌سازی» وجود ندارد.

## ۵. Auto-deploy
- **زمان‌بندی:** `taranom-autodeploy.timer` هر ۳ دقیقه `scripts/auto-deploy.sh` را اجرا می‌کند.
- **کار اسکریپت:** `git reset --hard origin/master` می‌زند، سپس `docker compose build api web worker` و `up -d`، و nginx را با `--force-recreate` از نو می‌سازد. بعد از آن health چک می‌شود و prune اجرا می‌شود.
- **اثرها:**
  - هر merge به master در کمتر از ۳ دقیقه بدون GO به production می‌رسد. deploy ناشناس `7ad0f6b9` در 26 اکتبر و deploy همین امروز `3a5a2155` در ۱۴:۴۱ تهران از همین مسیر بودند.
  - worker وسط کار restart می‌شود. در 26 اکتبر یک deploy فایل‌های temp داخل کانتینر را پاک کرد.
  - هر تغییر دستی روی فایل‌های ردیابی‌شده از بین می‌رود.
- **پیش‌نیاز deploy امن:** gate دستی (مثلاً یک فایل flag یا تأیید)، ثبت deploy در لاگ تغییرات و نمایش آن در پنل، و drain صف پیش از restart worker.

## ۶. پایش و observability
- **لاگ Worker کلادفلر خاموش است.** شکست‌های مسیر egress تلگرام دیده نمی‌شوند.
- لاگ‌های داخل کانتینر به UTC هستند، در حالی که عملیات به وقت تهران است.
- معیار نرخ موفقیت هر provider، هشدار DEAD و health-check دوره‌ای مسیر Worker وجود ندارد. فقط `outbox-metrics.ts` شمارنده دارد.
- **سرور:** دیسک ۸۰٪ پر است، swap ندارد، و یک سرور نقطهٔ شکست واحد برای کل سیستم است (`server-capacity-2026-10-27.md`).

## ۷. محدودیت‌ها و بدهی فنی
- god-service با ۳۵۰۸ خط.
- منطق slot و dedupe در چند جا تکرار شده: `omnichannel.service.ts:2069`، 2126، 3216 و 3235، و `delivery-dedupe-sql.ts`.
- **ناهمخوانی مقادیر پیش‌فرض با production:** در کد cap=20 و gap=90s است، ولی در production cap=10 و gap=900s.
- ناهمخوانی env بین api و worker.
- محدودیت 48 ساعته بله برای حذف پیام.
- حداقل سفارش در کپشن «۱» است ولی سایت ۶ می‌گوید. آیدی‌های تماس دوگانه‌اند. ادعای «ضدآب» برای ۷ SKU تأیید نشده (`prompt-redesign-v1.md`).
- workers.dev و حالت پیش‌فرض url برای تلگرام.
- `TELEGRAM_BOT_TOKEN` به‌صورت env، نه در vault.
- ربات‌ها هیچ inbound (webhook یا polling) ندارند و `owner_chat_id` تنظیم نشده.
- DEADهای قدیمی باز مانده‌اند (BALE 2، TELEGRAM 14، RUBIKA 9 مورد DEAD که superseded نیستند).

## ۸. نیازمندی‌ها و پیشنهادهای بازطراحی (اولویت: ضروری / مهم / بعداً)
**ضروری**
1. endpoint و UI برای «حذف این پیام» در سطح delivery و message id. پیش از حذف، از متن و مدیا backup گرفته شود و در audit ثبت شود. هشدار محدودیت 48 ساعت بله در UI نمایش داده شود.
2. نمای duplicate و پوشش: کلید یکتای «محصول + مقصد»، ماتریس محصول در کانال، و دکمهٔ «حذف نسخه‌های قدیمی». این نما از index موجود supersededAt استفاده کند.
3. انتشار تکی کامل از پنل، با نمایش slot بعدی، سقف باقی‌مانده و ساعت سکوت. هیچ عملیاتی نباید به اسکریپت کانتینر نیاز داشته باشد.
4. داشبورد provider:
   - وضعیت مؤثر (connection mode و منبع آن، kill-switch در worker و api)
   - health مسیر Worker، با ping دوره‌ای
   - آخرین موفقیت و آخرین خطای هر provider
   - هشدار هنگام تغییر وضعیت
5. دامنهٔ اختصاصی برای Worker، و `TELEGRAM_MEDIA_UPLOAD_MODE=upload` به‌عنوان حالت پیش‌فرض تأییدشده. هر دو با GO حامد.
6. gate برای deploy: auto-deploy خودکار به حالت «فقط با تأیید» تغییر کند، و worker پیش از restart صف را drain کند. GO لازم است.

**مهم**
7. ویرایشگر قالب برای هر کانال با پیش‌نمایش. لینک محصول، آیدی و ربات هر کانال، و minOrderQty از یک منبع واحد گرفته شوند.
8. اعتبارسنجی رسانه هنگام انتشار: decode، EOI و حجم. فشرده‌سازی خودکار به زیر 2MB، و اسکن یک‌بارهٔ فایل‌های قدیمی.
9. نمایش DEADها با علت دسته‌بندی‌شده، و اقدام تکی retry یا reapprove. retry انبوه نباشد.
10. روشن کردن لاگ Worker و ذخیرهٔ متریک نرخ موفقیت. همهٔ زمان‌ها در UI به وقت تهران نمایش داده شوند.
11. انتقال `TELEGRAM_BOT_TOKEN` به vault.

**بعداً**
12. تقسیم `omnichannel.service.ts` به چند سرویس: publishing، scheduling، admin-ops و reconcile.
13. inbound برای ربات‌ها (webhook برای بله و تلگرام از طریق Worker، و روبیکا)، صندوق پیام، و پیش‌فاکتور PFI.
14. بکاپ offsite و جدا کردن worker از سرنوشت deploy وب.
