# مرحله ۲ — طراحی UX/UI و طراحی فنی پنل «کانال انتشار»
پوشاک ترنم · نسخه ۱ · ۵ آبان ۱۴۰۵ (۲۷ اکتبر ۲۰۲۶) · مبنا: `stage1-requirements.md`
**به‌روزرسانی ۲۰۲۶-۱۰-۲۷:** تصمیم‌های حامد اعمال شد (بخش ۰). **وضعیت:** فقط سند. بدون تغییر کد/env/DB/deploy. وایرفریم: `stage2-wireframe.html`.
هر جا «⚠ D#» آمده، طراحی به تصمیم باز حامد وابسته است و هر دو حالت پشتیبانی می‌شود (پیکربندی، نه کد).

---

## ۰. تصمیم‌های حامد اعمال‌شده (۲۰۲۶-۱۰-۲۷)
1. اتصال‌ها **LIVE** می‌مانند؛ HOLD پیش‌فرض و تأیید Owner برای هر ارسال **حذف** شد. GO فقط برای انتشار گروهی، حذف (طبق قواعد موجود) و deploy.
2. **هر کانال تمام متن، قالب، جزئیات و آیدی تماس خودش را دارد**؛ صفحه «۹. تنظیمات هر کانال» (۳.۱۰) فیلدهای جدا دارد؛ حامد آیدی‌ها را خودش وارد می‌کند.
3. حداقل سفارش از فیلد هر محصول؛ ⚠ الان `minOrderQty=1` برای همه ← کار داده per-product (REQ-C11).
4. ربات عمده تلگرام: @TaranomRetailBot.
5. «ضدآب» حذف و مسدود.
6. owner_chat_id: فیلد تنظیمات per-channel در پنل.
7. سقف، فاصله، ساعت سکوت: کاملاً per-channel.
8. ربات‌های سفارش: بعد از تثبیت انتشار (PR-14 و صفحه ۳.۸ = فاز آخر).

### ۳.۱۰ تنظیمات هر کانال (جدید)
فرم جدا برای هر کانال (تب تلگرام / روبیکا / بله / canary)، بدون مقدار مشترک:

| فیلد | نوع |
|---|---|
| آیدی تماس، نام ربات، لینک کانال | متن (اعتبارسنجی @username / URL) |
| قالب کپشن، CTA، هشتگ‌ها | ویرایشگر + پیش‌نمایش همان کانال |
| نمایش قیمت | toggle (پیش‌فرض خاموش، ⚠ D4) |
| utm_source / utm_campaign | متن (⚠ D12 مقادیر) |
| سقف روزانه، حداقل فاصله، ساعت سکوت | عدد / ساعت تهران |
| owner_chat_id | شناسه + دکمه «تست» (فاز ربات‌ها) |
| mode (LIVE / توقف اضطراری) | سوئیچ با دلیل، فقط Owner |

ذخیره = audit قبل/بعد؛ «کپی از کانال دیگر» فقط مقدار کپی می‌کند، پیوند مشترک نمی‌سازد.

## ۱. معماری اطلاعات (IA)
مسیر: `/admin/omnichannel` (جایگزین تدریجی `AdminOmnichannel.tsx` با کامپوننت‌های تفکیک‌شده)

```
کانال انتشار
├── ۱. سلامت (Dashboard)           ← پیش‌فرض صفحه
├── ۲. صف زنده (Queue)
├── ۳. پوشش و تکرار (Coverage Matrix)
├── ۴. انتشار جدید (Composer)  ← تکی / زمان‌بندی / پست آزاد
├── ۵. قالب‌ها (Templates)
├── ۶. رسانه (Media Health)
├── ۷. صندوق ربات‌ها (Inbox & Orders)
├── ۸. ممیزی و deploy (Audit & Changes)
└── ۹. تنظیمات هر کانال (جدا برای هر کانال؛ بدون سراسری) — فقط Owner
```
عناصر سراسری: نوار وضعیت بالا (۳ چراغ provider + بنر «انتشار در جریان/قفل deploy» + بنر «ناهمخوانی api/worker»)، نقش کاربر، ساعت تهران. همهٔ زمان‌ها Asia/Tehran.

## ۲. زبان بصری وضعیت‌ها
| وضعیت | رنگ | آیکن | معنی |
|---|---|---|---|
| PENDING | خاکستری | ⏳ | در صف، slot بعدی نمایش |
| PROCESSING | آبی | ⟳ | در حال ارسال |
| SUCCEEDED | سبز | ✓ | موفق |
| SUCCEEDED+warning | **کهربایی** | ⚠ | موفق با هشدار (نه خطا) — رفع قرمز فعلی ~L2022 |
| RETRY | نارنجی | ↻ | خطای موقت، تلاش بعدی در … |
| HOLD | بنفش | ⏸ | نیازمند تأیید مجدد (علت: uncertain_after_timeout / stale / channel_hold) |
| DEAD | قرمز | ✕ | شکست نهایی، فقط اقدام دستی |
| WITHDRAWN | خاکستری خط‌خورده | 🗑 | حذف‌شده با backup (⚠ D11) |
| OUT-OF-PANEL | قرمز تیره | ⛔ | پست بدون رکورد پنل |

## ۳. صفحه‌ها

### ۳.۱ سلامت (هر provider یک کارت)
- **mode مؤثر** (پیش‌فرض LIVE ✅) + **منبع** (connection یا app_settings)؛ HOLD فقط توقف اضطراری دستی Owner
- kill-switch در api و worker جداگانه؛ اگر ناهمخوان ← بنر قرمز «تست موفق ولی ارسال واقعی DEAD می‌شود»
- آخرین موفقیت / آخرین خطا (متن واقعی، بدون توکن)، heartbeat worker، تعداد stalled/RETRY/DEAD/HOLD امروز
- سقف امروز: «۳ از ۱۰ — slot بعدی ۱۴:۱۵»، ساعت سکوت
- فقط تلگرام: کارت مسیر Worker (دامنه، p95 تأخیر، نرخ ping ۲۴ساعت، آخرین خطا)
- دسترسی ربات در کانال (post/edit/delete)
- اکشن‌ها (Owner): HOLD/LIVE با دیالوگ دلیل؛ «تست canary»
- **حالت‌ها:** loading (اسکلت)، خطای API (کارت خاکستری «وضعیت نامعلوم» — هرگز سبز پیش‌فرض)، stale (>۵ دقیقه بدون heartbeat ← نارنجی)

### ۳.۲ صف زنده
- تب‌ها: در انتظار / در حال ارسال / موفق / RETRY / HOLD / DEAD / همه؛ فیلتر کانال، SKU، بازه
- ستون‌ها: SKU+thumbnail، کانال، اکشن (CREATE/UPDATE/DELETE)، وضعیت، تلاش n/8، **علت خطا (کد + متن واقعی)**، slot/زمان، messageId، کلید idempotency (کوتاه‌شده)
- اکشن ردیف: retry (فقط RETRY/FAILED؛ غیرفعال برای unsupported_media با «اول تصویر را اصلاح کنید»)، «تأیید مجدد» HOLD/DEAD (دلیل اجباری، Owner)، لغو PENDING
- **بدون** دکمه revive گروهی یا requeue-by-category در حالت عادی (پشت سوئیچ Owner)
- مثال‌های واقعی برای تست UX: #7200 و #7154 تلگرام (در صف بدون لاگ ← باید علت `provider_unavailable/worker timeout` نمایش دهد)

### ۳.۳ ماتریس پوشش محصول × کانال
- سطر = محصول، ستون = تلگرام/روبیکا/بله؛ سلول: وضعیت، تاریخ، messageId(ها)، لینک (فقط فرمت تأییدشده؛ بله ← «لینک ندارد + id»)، **شمارنده تکرار** (۲+ = قرمز)
- فیلترها: «در روبیکا هست، در بله نیست» و برعکس، «تکراری»، «خارج از پنل»، «بدون دلیل»
- خلاصه بالا: روبیکا ۳۰ · بله ۲۴ · تلگرام n · اختلاف بی‌دلیل m
- اکشن: «ثبت دلیل عدم‌پوشش»، «انتشار تکی جاافتاده» (به Composer با پیش‌پر)، «حذف نسخه‌های قدیمی» (به دیالوگ حذف)

### ۳.۴ انتشار جدید (Composer)
گام‌ها: ① محصول (جست‌وجو با نام/کد + thumbnail) ② مقصدها (هیچ تیک پیش‌فرض) ③ کپشن (قالب کانال + ویرایش دستی، toggle قیمت per-channel، پیش‌فرض خاموش ⚠ D4، شمارندهٔ ۱۰۲۴/۴۰۹۶) ④ رسانه (نتیجه اعتبارسنجی، حجم قبل/بعد) ⑤ زمان (اکنون در slot بعدی / زمان‌بندی؛ برخورد با سکوت ۲۳–۱۲ = خطا؛ سقف باقی‌مانده) ⑥ Dry-run (پیش‌نمایش هر کانال، dedupe: «قبلاً در بله ۲۶ اکتبر، id 1234 ← ویرایش کنید؟») ⑦ دیالوگ تأیید درون‌صفحه توسط خود Publisher (خلاصه + دلیل) — **بدون تأیید Owner برای ارسال تکی** ✅
- پست آزاد: همان جریان بدون محصول؛ مقاله برای تلگرام غیرفعال.
- انتشار گروهی: فقط Owner، نمایش فهرست SKU و زمان‌بندی محاسبه‌شده با سقف.

### ۳.۵ ویرایشگر قالب
- سه ستون: متغیرها (`{name}`, `{sku}`, `{minOrder}` از فیلد محصول ✅، `{price?}`, `{pdpUrl}` با UTM همان کانال، `{contactId}` از تنظیمات همان کانال ✅)، ویرایشگر، پیش‌نمایش زنده سه کانال (آلبوم/تک‌عکس، محل کپشن، دکمه‌ها؛ بله: دکمه در پیام جدا)
- گارد ادعا: واژه «ضدآب» **مسدود** است (✅ D5: ادعا نشود)؛ ذخیره قالب حاوی آن خطا می‌دهد
- minOrder از `product.minOrderQty`؛ اگر مقدار ۱ و تأییدنشده ← هشدار «حداقل سفارش این محصول تعریف نشده»؛ parse mode با «تست روی canary»
- **هر کانال قالب و متن کاملاً مستقل دارد؛ هیچ قالب سراسری/مشترک** ✅ D1
- ذخیرهٔ قالب = نسخه جدید + audit؛ فعال‌سازی = تأیید Owner

### ۳.۶ سلامت رسانه
- آپلود: decode کامل + EOI؛ خطای فارسی؛ فشرده‌سازی خودکار به زیر حد (⚠ C5: ۱.۸ یا ۲ MB)
- اسکن یک‌باره: جدول محصولات با تصویر خراب/بزرگ (5047 در صدر)، دکمه «جایگزینی تصویر»

### ۳.۷ ویرایش و حذف
- از هر سلول ماتریس یا ردیف SUCCEEDED: «ویرایش» (diff قبل/بعد، UPDATE روی همان messageId، revert) و «حذف»
- **حذف دومرحله‌ای:** مرحله ۱ = انتخاب messageIdها + دلیل + نمایش backup (متن، idها، URL رسانه) + هشدار «بله: بیش از ۴۸ ساعت ← حذف ممکن نیست»؛ مرحله ۲ = تایپ SKU برای تأیید (+ تأیید Owner ⚠ D9) ← نتیجه هر messageId (OK/خطا) ← WITHDRAWN

### ۳.۸ صندوق ربات‌ها و سفارش‌ها (فاز بعدی — P2)
- لیست گفتگوها (ربات، مشتری، آخرین پیام، زمان پاسخ خودکار، برچسب حساس: سفارش اول/اعتبار/قیمت ویژه/شکایت)
- جزئیات: تاریخچه، پیش‌فاکتور PFI-xxxx، دکمه «ارجاع به سوشال مدیا» (مقصد = فیلد owner_chat_id در تنظیمات همان کانال ✅)
- هشدار «بی‌پاسخ > ۱ دقیقه»
- ربات تلگرام: @TaranomRetailBot (✅ D3) از مسیر Worker
- **این صفحه در فاز آخر، بعد از تثبیت انتشار** ✅

### ۳.۹ ممیزی و deploy
- جدول audit غیرقابل‌ویرایش: زمان، actor، اکشن، شیء، قبل/بعد، GO-ref، منبع (پنل / **خارج از پنل**)
- اولین رکورد دستی: رخداد بله (۵ انتشار + ۱۱ حذف خارج از پنل، ۲۶ اکتبر)
- deployها: commit، زمان، فرد، GO-ref، وضعیت drain؛ رکورد گذشته: `7ad0f6b9` (ناشناس، ۲۶ اکتبر ~۱۹:۰۲)، `3a5a2155` (۲۷ اکتبر ۱۴:۴۱)
- export CSV بدون داده حساس

## ۴. نقش‌ها و گیت‌های GO
| اکشن | Viewer | Publisher | Owner |
|---|---|---|---|
| مشاهده/CSV | ✓ | ✓ | ✓ |
| Dry-run، پیش‌نویس | — | ✓ | ✓ |
| انتشار تکی زنده | — | ✓ (بدون GO) ✅ | ✓ |
| ویرایش پست | — | ✓ (audit) | ✓ |
| حذف | — | ⚠ D9 | ✓ |
| انتشار گروهی/requeue | — | — | ✓ + GO-ref |
| تأیید مجدد HOLD/DEAD | — | — | ✓ |
| HOLD/LIVE کانال، سقف، سکوت، قالب فعال | — | — | ✓ + GO-ref |
| تأیید deploy | — | — | ✓ (+GO نوشتاری) |
توکن در هیچ نقشی نمایش داده نمی‌شود (فقط «تنظیم شده ✓ / آخرین چرخش: تاریخ»).

---

## ۵. طراحی فنی (خلاصه)
### ۵.۱ دیتامدل (افزوده/تغییر)
- `publication_delivery`: + `idempotency_key` (UNIQUE جزئی برای وضعیت‌های فعال)، + `status WITHDRAWN` ⚠ D11، + `hold_reason`، + `warning_code`، + `content_hash`
- `delivery_message` (جدید): delivery_id، provider_message_id، index در آلبوم، sent_at، deleted_at
- `post_backup` (جدید): delivery_id، caption، media_urls، message_ids، reason، actor، created_at (نگهداری ⚠ D16)
- `caption_template_version` (per-destination)، `channel_settings` **per-destination بدون fallback سراسری**: mode، dailyCap، minGapSeconds، quietStart/End، contactId، botUsername، channelLink، hashtags/CTA، utm_source/campaign، showPrice، ownerChatId
- minOrder: فقط `product.minOrderQty` (بدون ثابت)
- `audit_event` (append-only، trigger ضد UPDATE/DELETE)
- `deploy_log`، `deploy_lock`
- `bot_conversation`، `bot_message`، پیوند به `orders/invoices` (PFI)
- `provider_health_sample` (ping Worker، heartbeat)

### ۵.۲ صف idempotent
- کلیدها: `CREATE:{destinationId}:{productId}`، `UPDATE:{messageId}:{contentHash}`، `DELETE:{messageId}` — بدون زمان
- claim اتمیک: `UPDATE … SET status='PROCESSING', lease_until=… WHERE id=(SELECT … FOR UPDATE SKIP LOCKED) AND status IN ('PENDING','RETRY') RETURNING *`
- قبل از sendPhoto: ثبت «attempt_started»؛ بعد از پاسخ: ثبت messageId در همان تراکنش
- **قاعدهٔ «HOLD در ناشناخته»:** اگر lease منقضی شد و attempt_started بدون نتیجه است ← HOLD `uncertain_after_timeout` (هرگز RETRY خودکار برای CREATE)
- **بدون auto-revive:** حذف revive خودکار؛ revive فقط endpoint تکی با LIMIT 1 و دلیل
- سقف/سکوت/gap هنگام claim بررسی می‌شود؛ HANDLE_TIMEOUT > مجموع timeout adapter (روبیکا ≥ ۵۰s)
- برداشتن HOLD کانال ← deliveryهای معلق HOLD `channel_hold_released` می‌مانند تا تأیید مجدد

### ۵.۳ قفل deploy و gate
- `deploy_lock` فعال وقتی PROCESSING > 0 یا PENDING امروز در پنجره انتشار (⚠ D10)
- `auto-deploy.sh`: به‌جای اجرا با هر merge ← بررسی فایل/رکورد `deploy_approval` با GO-ref؛ اگر قفل ← خروج و ثبت «deploy blocked»
- drain: SIGTERM ← worker claim جدید نمی‌گیرد، ارسال جاری تمام می‌شود (≤ ۶۰s) ← restart
- ثبت هر deploy (commit، زمان، فرد) در `deploy_log` و نمایش در پنل

### ۵.۴ Worker و تلگرام
- دامنهٔ اختصاصی (مثلاً `telegram-egress.poshaktaranom.com`) روی Worker با Custom Domain کلادفلر؛ احراز سرآیند مشترک بین سرور و Worker؛ لاگ Worker روشن (⚠ D7)
- `TELEGRAM_MEDIA_UPLOAD_MODE=upload`
- `TELEGRAM_BOT_TOKEN` ← `omnichannel-token-vault` (رمزگذاری با `OMNICHANNEL_VAULT_KEY`)؛ چرخش توکن پس از انتقال
- inbound تلگرام: webhook از Worker با `secret_token`؛ بله/روبیکا: webhook یا polling با امضا/secret

### ۵.۵ هشدارها
DEAD/HOLD تازه، تکرار، سقف، تغییر mode/kill-switch، ناهمخوانی api/worker، شکست ping Worker (۳ متوالی)، اختلاف پوشش > N، پیام ربات بی‌پاسخ > ۱ دقیقه، تلاش deploy حین قفل، اقدام خارج از پنل — به کانال داخلی سوشال مدیا.

### ۵.۶ API جدید/تغییر (نمونه)
`GET /admin/omnichannel/health` · `GET /coverage` · `POST /deliveries/:id/messages/:mid/delete` · `POST /deliveries/:id/edit` · `POST /deliveries/:id/revert` · `POST /channels/:id/hold` · `GET/POST /deploy/lock|approve` · `GET /audit?source=out_of_panel` · `GET /bots/inbox` · `POST /media/scan`

---

## ۶. برنامهٔ PR فازبندی‌شده
هر PR: کوچک، مستقل، بدون deploy تا GO؛ تست روی canary بله ابتدا.

| فاز | PR | محتوا | ریسک | راه برگشت | تست/پذیرش |
|---|---|---|---|---|---|
| 0 | PR-0 Deploy gate | auto-deploy «فقط با تأیید» + deploy_log + drain | متوسط: deploy قفل بماند | revert اسکریپت؛ deploy دستی | merge بدون approval ← بدون deploy |
| 1 | PR-1 Health read-only | endpoint health + کارت‌ها + بنر ناهمخوانی | کم (فقط خواندن) | revert UI | ناهمخوانی شبیه‌سازی‌شده دیده شود |
| 1 | PR-2 Status UI | رنگ کهربایی warning، متن واقعی خطا، retry rules | کم | revert | unsupported_media بدون retry |
| 2 | PR-3 Idempotency | کلید بدون زمان + claim اتمیک + migration UNIQUE | **بالا** (DB) | migration down؛ backup DB قبل | تست دو worker + restart = صفر تکرار |
| 2 | PR-4 No auto-revive / HOLD on unknown | حذف revive خودکار، HOLD uncertain/stale، timeout | متوسط | feature flag | timeout شبیه‌سازی ← HOLD |
| 2 | PR-5 Cap/quiet at send | بررسی هنگام claim | کم | flag | مازاد به روز بعد |
| 3 | PR-6 Audit + roles | audit_event append-only، نقش‌ها، GO-ref | متوسط | flag نقش‌ها | Viewer نتواند بنویسد |
| 3 | PR-7 Delete/Edit + backup | endpoint حذف پیام، edit/revert، WITHDRAWN | **بالا** (حذف برگشت‌ناپذیر) | backup + فقط canary اول | حذف روی canary + backup |
| 3 | PR-8 Coverage matrix | ماتریس، تکرار، out-of-panel reconcile | کم | revert | ۹ محصول تکراری بله دیده شود |
| 4 | PR-9 Composer | انتشار تکی، بدون پیش‌فرض، dry-run، دیالوگ تأیید، زمان‌بندی | متوسط | flag به فرم قدیم | dry-run صفر درخواست خروجی |
| 4 | PR-10 Channel settings + Templates | `channel_settings` per-channel (متن، آیدی، UTM، سقف/فاصله/سکوت، ownerChatId)، قالب مستقل هر کانال، toggle قیمت، مسدودسازی «ضدآب»، minOrder از محصول | متوسط (محتوا) | نسخهٔ قبلی قالب | پیش‌نمایش = رندر canary |
| 4 | PR-11 Media validation | decode/EOI، فشرده‌سازی، اسکن | کم | flag | 5047 رد شود |
| 5 | PR-12 Worker domain + token vault | custom domain، لاگ، upload mode، vault | متوسط (قطع تلگرام) | برگشت `TELEGRAM_API_URL` قبلی | ping ۲۴ساعت ≥ ۹۹٪ |
| 5 | PR-13 Alerts | هشدارها | کم | خاموش کردن | هر هشدار در تست شلیک شود |
| 6 (بعد از تثبیت انتشار) | PR-14 Bots inbound + inbox + PFI | webhook/polling، auto-reply، PFI، ارجاع | متوسط (امنیت webhook) | غیرفعال webhook | e2e صفر پیام گم‌شده، پاسخ < ۱ دقیقه |
| 7 | PR-15 Refactor god-service | تقسیم سرویس | متوسط | revert | تست‌های رگرسیون |

**ترتیب:** PR-0 قبل از همه (تا خود PRهای بعدی بدون GO deploy نشوند).

## ۷. بازبینی امنیتی (خلاصه)
- توکن: فقط vault، هیچ نمایش/لاگ؛ scrubber لاگ برای الگوی `\d+:[A-Za-z0-9_-]{35}`
- webhook: secret token/امضا، rate limit، IP allowlist در صورت امکان
- Worker: سرآیند احراز مشترک، فقط مسیرهای Bot API لازم
- نقش‌ها: سمت سرور اعمال، نه فقط UI؛ GO-ref اجباری برای اکشن‌های Owner
- CSV/لاگ: بدون شماره تماس مشتری مگر برای Owner
