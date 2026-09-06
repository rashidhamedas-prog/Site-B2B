# کنسول انتشار v2 — تنظیم یک‌باره، ارسال خودکار (2026-09-06)

معماری اجرایی برای «ربات کانال تلگرام حرفه‌ای و قابل تنظیم». همان مونولیت؛ تلگرام آداپتر است، نه سرویس دوم.

## فرض‌ها

- مالک می‌خواهد یک‌بار تنظیم کند و بعد هر محصول جدید / تغییر قیمت / ناموجودی خودش به کانال برسد.
- تنها ارائه‌دهندهٔ زنده تلگرام است؛ بله/روبیکا پشت `ConnectorDisabledError` می‌مانند.
- توکن ربات فقط روی سرور (`TELEGRAM_BOT_TOKEN`) است؛ ادمین فقط نام env را می‌بیند.
- پرچم‌های سرور `OMNICHANNEL_CONNECTORS_ENABLED` و `OMNICHANNEL_AUTO_PUBLISH` حکم اصلی‌اند؛ تنظیمات ادمین زیر آن‌ها می‌نشیند و هیچ‌وقت آن‌ها را دور نمی‌زند.

## پژوهش: چه چیزی «حرفه‌ای» است

منابع مقایسه‌شده: Bot API رسمی تلگرام (sendPhoto / sendMediaGroup / editMessageCaption / getChatMember / `show_caption_above_media` / `protect_content` / `link_preview_options` / `InlineKeyboardMarkup`) و رفتار ربات‌های تجاری کانال‌های پوشاک (پست آلبومی + کپشن ساخت‌یافته + دکمهٔ خرید).

نتیجهٔ کاربردی:

| قابلیت | تلگرام | تصمیم |
|---|---|---|
| آلبوم تا ۱۰ عکس با کپشن روی عکس اول | `sendMediaGroup` | پیش‌فرض «آلبوم» |
| دکمهٔ شیشه‌ای زیر پست | فقط `sendPhoto`/`sendMessage` (آلبوم `reply_markup` ندارد) | حالت «یک عکس» یا «فقط متن» با دکمه؛ UI صریح می‌گوید |
| بولد نام و قیمت | `parse_mode=HTML` با escape | پیش‌فرض HTML، متن کاربر escape می‌شود |
| متن بالای عکس | `show_caption_above_media` | تاگل |
| بی‌صدا / ضدفوروارد | `disable_notification` / `protect_content` | تاگل (عمده = قیمت محرمانه) |
| اجازهٔ ربات در کانال | `getChat` + `getChatMember` | «بررسی دسترسی» قبل از هر ارسال خودکار |
| ویرایش بی‌تغییر | 400 `message is not modified` | کد `duplicate` = موفق (idempotent) |

## ماژول‌ها و مالکیت داده

```
apps/api/src/modules/omnichannel/
  publication-template.ts        قالب v1 + options (mediaMode/parseMode/buttons/silent/protect/captionAbove/linkPreview)
  publication-automation.ts      توابع خالص: evaluateAutomationGate / selectAutomationDestinations / resolveRemoteIntent
  oos-policy.ts                  تنظیمات ذخیره‌شده: OOS، رویدادها، حالت خودکار، سقف، فاصله، سکوت، withdraw، verified snapshot
  adapters/telegram.adapter.ts   create/update/delete با options + inspectDestination
  services/omnichannel.service.ts  patchSettings / verifyDestination / createPublication / autoSyncRemote / enqueueDeliveries
  services/outbox-worker.service.ts  publication.deliver.requested → آداپتر؛ خطا روی delivery آینه می‌شود
apps/web/src/components/admin/
  AdminOmnichannel.tsx             کنسول: ۵ مرحله + انتشارها + عملیات
  AdminTelegramTemplateBuilder.tsx سازندهٔ قالب: محتوا / نمایش و دکمه‌ها / پیش‌نمایش
  admin-omnichannel-ui.tsx         تایپ‌ها، برچسب‌های فارسی، Badge/Metric/Stepper/RadioCards/Toggle/TelegramPreview
```

- **مالک قالب:** `omnichannel_channel_templates` (jsonb body، آخرین نسخهٔ `enabled` برنده).
- **مالک تنظیمات:** ردیف settings omnichannel (`*Chosen` برای هر گروه؛ تا ذخیره نشود پیش‌فرض بی‌اثر است).
- **مالک تأیید مقصد:** `settings.verified` روی `omnichannel_channel_destinations`؛ فقط سرور می‌نویسد، canary-toggle آن را پاک نمی‌کند.
- **حقیقت ارسال:** `publication_deliveries` + `outbox_events`؛ `liveRemoteMessages` از تاریخچهٔ CREATE/UPDATE/DELETE پیام‌های زندهٔ فعلی را می‌سازد.

## API / رویدادها

- `PATCH /v1/omnichannel/settings` — `autoPublishMode` (OFF|CANARY|LIVE)، `autoDailyCap` (۱..۲۰۰)، `autoMinGapSeconds` (۰..۳۶۰۰)، `quietStartHour/quietEndHour` (تهران، null = خاموش)، `withdrawAction` (DELETE|KEEP) + فیلدهای قبلی. ورود به CANARY/LIVE بدون مقصد تست/تأییدشده 400 می‌دهد.
- `POST /v1/omnichannel/destinations/:id/verify` — `getMe/getChat/getChatMember/getChatMemberCount`؛ اسنپ‌شات پاک‌سازی‌شده ذخیره + audit.
- `POST /v1/omnichannel/publications` — `destinationId` اختیاری برای پست آزمایشی به یک مقصد (باید canary یا تأییدشده باشد). سقف ۱۰ محصول زندهٔ canary فقط تا وقتی حالت خودکار LIVE نشده اعمال می‌شود.
- رویدادهای کاتالوگ (`product.created|content_changed|price_changed|media_changed|visibility_changed|withdrawn|stock_changed`) → ورکر → `syncProductPublications(eventType)` → `autoSyncRemote` → `publication.deliver.requested` با `availableAt` (فاصله/سکوت).

## دنبالهٔ بحرانی: تغییر قیمت در حالت LIVE

1. ProductService رویداد `product.price_changed` را در outbox می‌گذارد.
2. ورکر → `syncOneSource` → publication محلی refresh.
3. `autoSyncRemote`: `evaluateAutomationGate` (mode، پرچم‌ها، رویداد انتخاب‌شده، سقف روزانه، فاصله، سکوت) → `resolveRemoteIntent` = UPDATE چون پیام زنده دارد.
4. `enqueueDeliveries` برای هر مقصد `selectAutomationDestinations` (LIVE = همهٔ تأییدشده‌ها) با `providerMessageId`.
5. ورکر → `TelegramAdapter.update` → `editMessageCaption` با `parse_mode` و دکمه‌ها؛ «not modified» = موفق.
6. delivery SUCCEEDED؛ در ادمین زیر همان محصول دیده می‌شود.

## امنیت

- توکن فقط از env با allowlist `TELEGRAM|BALE|RUBIKA`؛ `assertNoPlaintextSecrets` روی بدنه‌های ادمین.
- URL دکمه و عکس: فقط https و هاست ترنم / `t.me`؛ توکن `{url}` بعد از جانشینی دوباره اعتبارسنجی می‌شود.
- HTML: هر متن کاربر escape؛ فقط `<b>` سرور می‌سازد. پیش‌نمایش وب بدون `dangerouslySetInnerHTML`.
- خطای تلگرام قبل از ذخیره `redactProviderError` می‌شود؛ UI کدها را به جملهٔ فارسی ترجمه می‌کند.
- همهٔ مسیرها زیر گارد ادمین omnichannel؛ هر تغییر تنظیمات/ارسال audit با actor و reason.

## UX کنسول (ui-ux-product-design)

- **کار اصلی کاربر:** «یک‌بار راه بینداز، بعد فقط نگاه کن.» پس صفحه با ۵ مرحلهٔ خطی شروع می‌شود و خودش روی اولین مرحلهٔ ناقص می‌ایستد: ربات → کانال‌ها → قالب پست → قواعد خودکار → تست و فعال‌سازی.
- **زبان:** برچسب‌ها انسانی‌اند («وقتی موجودی تمام شد»، «پست بماند»)، نه enum. خطاهای تلگرام ترجمه می‌شوند.
- **بازخورد:** هر تغییر قالب/قواعد Badge «ذخیره نشده» می‌گیرد؛ پیش‌نمایش شبیه تلگرام (تیره) با همان رندر سرور (بولد، آلبوم ۲+۳، دکمه‌ها، بی‌صدا/ضدفوروارد).
- **حالت‌ها:** خالی (بدون ربات/مقصد/انتشار)، هشدار (مقصد تأییدنشده، متن بلندتر از ۱۰۲۴، دکمه روی آلبوم)، خطا (دسترسی ندارد)، موکول‌شده (سکوت/فاصله).
- **RTL/دسترس‌پذیری:** `role=tablist/tab`، `aria-selected`، label برای همهٔ ورودی‌ها، تاگل بدون وابستگی به جهت.
- **کارایی:** فقط صفحهٔ ادمین؛ هیچ اثری بر ویترین/LCP. بدون کتابخانهٔ جدید.

## تست‌ها

- `publication-template.spec` (options، escape، دکمه، mediaMode)، `publication-automation.spec` (gate/quiet/intent/selection)، `oos-policy.spec` (تنظیمات + verified)، `telegram.adapter.spec` (inspect/buttons/not-modified)، `canary-ping.spec`، `omnichannel-phase-acceptance.spec` (هر جدول ادمین thead دارد؛ v2 نشانگرها).
- `tsc` api + web سبز.

## رول‌اوت

1. دیپلوی؛ `/v1/health`؛ صفحهٔ `/admin/omnichannel` باز شود.
2. مرحلهٔ ۲: مقصدهای موجود «بررسی دسترسی» بگیرند (بدون آن حالت LIVE به آن‌ها نمی‌فرستد).
3. مرحلهٔ ۵: یک پست آزمایشی به مقصد تست → شکل نهایی در تلگرام.
4. `autoPublishMode=CANARY` یک روز → بعد LIVE.
5. بازگشت: `autoPublishMode=OFF` (یک کلیک)؛ هیچ مهاجرت اسکیمای جدیدی نیست.

## ریسک‌ها و تصمیم‌های باز

- آلبوم دکمه ندارد (محدودیت تلگرام). پیش‌فرض آلبوم بدون دکمه است؛ اگر مالک دکمه می‌خواهد، «یک عکس».
- تعویض عکس‌های آلبوم پس از ارسال با API فعلی انجام نمی‌شود؛ `media_changed` فقط متن را ویرایش می‌کند.
- ساعت سکوت با آفست ثابت تهران (+۰۳:۳۰) است.
- بله/روبیکا/اینستاگرام خارج از این برش.
