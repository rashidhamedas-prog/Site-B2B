# بله و روبیکا در کنسول انتشار — معماری اجرایی (2026-09-06)

همان مونولیت، همان قالب، همان صف. تلگرام، بله و روبیکا سه «آداپتر» پشت یک رجیستری هستند؛ ادمین یک‌بار پیام‌رسان را انتخاب می‌کند، ربات و کانال را ثبت می‌کند و بعد هر پست خودکار به هر سه می‌رسد.

## فرض‌ها

- درخواست مالک: «برای بله و روبیکا هم تنظیماتش را اضافه کن؛ قبلش مستندات رسمی را کامل بخوان». این درخواست، محدودیت قبلی (بله/روبیکا پشت `ConnectorDisabledError`) را لغو می‌کند.
- منابع مطالعه‌شده (2026-09-06): `docs.bale.ai` (Bot API بله: sendMessage / sendPhoto / sendMediaGroup / editMessageCaption / deleteMessage / getChat / getChatMember / getChatMembersCount / getUpdates)، `rubika.ir/botapi` (Bot API v3 روبیکا: sendMessage / requestSendFile / sendFile / editMessageText / deleteMessage / getChat / getUpdates / متادیتا / InlineKeypad) و `core.telegram.org/bots/api` برای مقایسه.
- توکن هر ربات فقط روی سرور است (`TELEGRAM_BOT_TOKEN`، `BALE_BOT_TOKEN`، `RUBIKA_BOT_TOKEN` یا هر نام دیگری با همان پیشوند). ادمین فقط نام env را می‌بیند؛ آداپتر توکنی را که پیشوندش با پیام‌رسان نخواند رد می‌کند (`invalid_credential`).
- پرچم‌های سرور `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` حکم اصلی می‌مانند. کلید جدید `OMNICHANNEL_DISABLED_PROVIDERS=BALE,RUBIKA` هر پیام‌رسان را جدا خاموش می‌کند بدون این‌که تلگرام بخوابد.
- قالب پست همان قالب «اصلی» تلگرام است (`provider=TELEGRAM` در دیتابیس). هیچ قالب دومی برای بله/روبیکا ساخته نمی‌شود؛ هر آداپتر خودش HTML محدود قالب (`<b>`) را به فرمت خودش تبدیل می‌کند. دلیل: تجربهٔ «یک‌بار تنظیم کن» و جلوگیری از سه قالب ناهم‌زمان.

## پژوهش: تفاوت‌های واقعی سه Bot API

| موضوع | تلگرام | بله (`tapi.bale.ai`) | روبیکا (`botapi.rubika.ir/v3`) | تصمیم |
|---|---|---|---|---|
| پاکت پاسخ | `ok/result/description` | همان تلگرام | `status: OK/…` + `data` | هر آداپتر پاکت خودش را می‌خواند؛ خطاها به کدهای مشترک (`invalid_credential`، `forbidden`، `chat_not_found`، `rate_limited`، `provider_unavailable`) نگاشت می‌شوند |
| فرمت متن | `parse_mode=HTML` | همه‌چیز Markdown، بدون parse_mode؛ `*bold*` باید دو طرفش فاصله داشته باشد | `metadata.meta_data_parts[]` با آفست UTF-16، حداکثر ۳۰ بخش؛ یک بخش خراب کل پیام را رد می‌کند | ماژول `rich-text.ts`: HTML کانونی → HTML / Markdown بله / متادیتا روبیکا؛ متن PLAIN هم برای بله escape می‌شود |
| عکس | `sendPhoto` با URL | `sendPhoto` با URL | `requestSendFile(type=Image)` → `upload_url` → آپلود multipart → `file_id` → `sendFile` | آداپتر روبیکا خودش عکس را از CDN ما می‌گیرد و آپلود می‌کند (سقف ۱۰MB) |
| آلبوم | `sendMediaGroup` تا ۱۰ | `sendMediaGroup` تا ۱۰؛ کپشن آیتم تا ۱۰۲۴ | ندارد | روبیکا فقط عکس اول را می‌فرستد؛ UI این را کنار پیش‌نمایش می‌گوید |
| بولد روی کپشن عکس | دارد | دارد (Markdown) | `sendFile` فیلد متادیتا ندارد | کپشن روبیکا ساده می‌رود؛ پیش‌نمایش بولد را برمی‌دارد |
| دکمهٔ زیر پست | `InlineKeyboardMarkup` (نه زیر آلبوم) | `reply_markup` روی sendPhoto/sendMessage (نه زیر آلبوم)؛ `InlineKeyboardButton.url` مستند است | `ButtonTypeEnum.Link` در `/botapi/models` هست، ولی مدل `Button` فیلد URL/`button_link` ندارد (فقط selection/calendar/picker/location/textbox) | روبیکا: دکمه‌ها به‌صورت خط «🔗 برچسب: لینک» با بخش متادیتای `Link` رسمی به متن اضافه می‌شوند؛ فیلد URL اختراع نمی‌شود |
| بی‌صدا / ضدفوروارد / متن بالای عکس / پیش‌نمایش لینک | همه | هیچ‌کدام مستند نیست؛ پارامتر اضافه نمی‌رود | فقط `disable_notification` | ماتریس قابلیت؛ پارامتر نامستند هرگز ارسال نمی‌شود |
| ویرایش | caption و text | caption و text | فقط `editMessageText` (بدون متادیتا؛ در مستندات `Message.text` برای فایل همان کپشن است) | تغییر قیمت در روبیکا با `editMessageText` روی همان پیام می‌رود؛ بولد بعد از ویرایش می‌پرد. ماتریس `editCaption=false` و UI می‌گوید «ویرایش زیرنویس عکس محدود است» |
| حذف | همیشه برای ادمین | فقط تا ۴۸ ساعت | مستند بدون محدودیت | کد خطای `delete_window_expired` در UI فارسی |
| مجوز ربات در کانال | `getChatMember` | `getChatMember` + `getChatMembersCount` | فقط `getChat`؛ معادل getChatMember ندارد | روبیکا: `permissionCheck=test_post` — یک «پست آزمایشی» موفق `canPost=true` را ثبت می‌کند |
| شناسهٔ کانال | `@user` یا `-100…` | `@user` یا عددی | `c0…` (کانال)، `g0…`، `u0…`، `b0…` | `discoverChats` از `getUpdates` چت‌های اخیر را لیست می‌کند تا ادمین شناسهٔ مبهم را کپی نکند |

## ماژول‌ها و مالکیت داده

```
apps/api/src/modules/omnichannel/
  omnichannel.constants.ts          OMNICHANNEL_PROVIDERS، isOmnichannelProviderEnabled (کلید per-provider)، defaultSecretRefFor
  provider-capabilities.ts          ماتریس قابلیت هر پیام‌رسان + providerReadiness (enabled / tokenConfigured، بدون مقدار توکن)
  adapters/channel-adapter.ts       قرارداد مشترک: validateConnection / inspectDestination / discoverChats / preview / create / update / delete
  adapters/adapter-registry.ts      ChannelAdapterRegistry.for(provider) — provider ناشناخته صدا می‌زند، نه این‌که بی‌صدا هیچ‌جا نفرستد
  adapters/rich-text.ts             HTML کانونی (<b>) → plain / Markdown بله / متادیتا روبیکا (+ appendLinkLines)
  adapters/telegram.adapter.ts      resolveProviderToken و chatsFromUpdates مشترک؛ discoverChats
  adapters/bale.adapter.ts          tapi.bale.ai — Markdown، آلبوم، دکمه روی پست تک‌عکس، حذف ۴۸ ساعته، getChatMembersCount
  adapters/rubika.adapter.ts        botapi.rubika.ir/v3 — متادیتا، آپلود دومرحله‌ای، بدون آلبوم، لینک متنی، test_post
  oos-policy.ts                     selectCanaryDestinations(provider?)، canaryDestinationIdsByProvider، withTestPostProof
  services/omnichannel.service.ts   liveAdapter(provider) → verify / testPost / discoverChats / canary-ping / پیش‌نیاز خودکار
  services/outbox-worker.service.ts آداپتر از روی conn.provider انتخاب می‌شود
apps/web/src/components/admin/
  admin-omnichannel-ui.tsx          Provider / ProviderInfo / DiscoveredChat، PROVIDER_META، ProviderChip، ProviderTabs، providerLimits، platformRendered، پیش‌نمایش با تم هر پیام‌رسان
  AdminOmnichannel.tsx              کارت انتخاب پیام‌رسان، secretRef با اعتبارسنجی پیشوند، «پیدا کردن شناسه»، «پست آزمایشی»، پیش‌نمایش به‌ازای مقصد
  AdminTelegramTemplateBuilder.tsx  سوییچ پیش‌نمایش تلگرام/بله/روبیکا + فهرست تفاوت‌های همان قالب در هر پیام‌رسان
```

- **مالک قابلیت‌ها:** `PROVIDER_CAPABILITIES` روی سرور؛ UI آن را از `GET /omnichannel/status`.`providers` می‌خواند و فقط برای API قدیمی یک کپی fallback دارد.
- **مالک مجوز مقصد:** `settings.verified` روی مقصد؛ برای روبیکا `permissionCheck='test_post'` و `testPostAt` فقط با پست آزمایشی موفق نوشته می‌شود.
- **مالک قالب:** همان ردیف `provider=TELEGRAM` (ثابت `MASTER_TEMPLATE_PROVIDER` در سرویس و UI).
- **canary:** برای هر کانال فروش به‌ازای هر پیام‌رسان یک canary مجاز است (`assertUniqueCanary`)؛ `status.canaryDestinationIds[channel][provider]`.

## API

- `GET /v1/omnichannel/status` → `providers[]` (ماتریس + `enabled` + `tokenConfigured` + `defaultSecretRef`) و `canaryDestinationIds` به‌ازای پیام‌رسان.
- `POST /v1/omnichannel/connections` → `provider` حالا `BALE` و `RUBIKA` هم می‌پذیرد؛ `secretRef` باید با `PROVIDER_` شروع شود (DTO + آداپتر).
- `POST /v1/omnichannel/connections/:id/discover-chats` → `{ ok, provider, chats[≤50]{chatId, chatType, title, username, via} }`؛ audit `discover_chats`.
- `POST /v1/omnichannel/destinations/:id/verify` → برای همهٔ پیام‌رسان‌ها؛ خروجی روبیکا `canPost` نامشخص + `permissionCheck='test_post'`.
- `POST /v1/omnichannel/destinations/:id/test-post` → پیام کوتاه فارسی به همان مقصد؛ موفقیت `withTestPostProof` را می‌نویسد؛ audit `test_post`.
- `POST /v1/omnichannel/connections/:id/canary-ping` و `/test` → به هر پیام‌رسانی.

## دنبالهٔ بحرانی: محصول جدید در حالت LIVE با سه پیام‌رسان

1. `product.created` → ورکر → `syncProductPublications` → publication محلی.
2. `autoSyncRemote` → `selectAutomationDestinations` (هر provider رسمی، مقصد تأییدشده و enabled، اتصال ACTIVE) → یک `publication.deliver.requested` به‌ازای هر مقصد.
3. ورکر → `registry.for(conn.provider).create(payload)`:
   - تلگرام: `sendMediaGroup` (HTML) یا `sendPhoto` + دکمه.
   - بله: `sendMediaGroup` با کپشن Markdown (≤۱۰۲۴) یا `sendPhoto` (≤۴۰۹۶) + `reply_markup`.
   - روبیکا: `requestSendFile` → آپلود → `sendFile` با کپشن ساده (عکس اول) یا `sendMessage` با متادیتا و خط‌های لینک.
4. خطای هر پیام‌رسان روی همان delivery می‌نشیند (کد مشترک + متن redact‌شده)؛ بقیه ادامه می‌دهند.

## امنیت

- هیچ توکنی در پاسخ API/UI نیست؛ `providerReadiness` فقط بولی می‌دهد و فقط برای نام‌های با پیشوند مجاز.
- `resolveProviderToken(provider, secretRef)` پیشوند را تحمیل می‌کند؛ یک اتصال بله با `TELEGRAM_BOT_TOKEN` هرگز توکن تلگرام را به `tapi.bale.ai` نمی‌فرستد.
- URL دکمه‌ها همان allowlist قبلی (دامنهٔ ترنم / t.me) است؛ روبیکا همان‌ها را به‌صورت متن می‌گیرد.
- آپلود عکس روبیکا فقط از URLهای `sanitizePhotoUrls` (CDN خودمان) و تا ۱۰MB؛ timeout جدا.
- کلید `OMNICHANNEL_DISABLED_PROVIDERS` برای خاموش‌کردن فوری یک پیام‌رسان بدون دیپلوی.
- `discoverChats` هیچ update را ack نمی‌کند (offset نمی‌فرستد) تا وبهوک/پردازش دیگری را نخورد؛ خروجی به ۵۰ چت محدود و audit می‌شود.

## استقرار و rollout

1. دیپلوی کد (بدون مایگریشن؛ `provider` ستون رشته‌ای موجود است).
2. روی سرور: `BALE_BOT_TOKEN` و `RUBIKA_BOT_TOKEN` را در `.env` بگذارید (ربات‌ها را در @botfather بله و @BotFather روبیکا بسازید). تا آن موقع کارت پیام‌رسان «راه‌اندازی نشده» نشان می‌دهد و «تست توکن» با `invalid_credential` برمی‌گردد.
3. در کنسول: کارت بله/روبیکا → افزودن ربات → تست توکن → روشن‌کردن → مرحلهٔ ۲: «پیدا کردن شناسه» یا ثبت دستی → بررسی دسترسی → (روبیکا) پست آزمایشی → انتخاب مقصد تست.
4. مرحلهٔ ۵: پیش‌نمایش را روی تب بله/روبیکا ببینید؛ ارسال آزمایشی به مقصد تست همان پیام‌رسان.
5. Rollback: `OMNICHANNEL_DISABLED_PROVIDERS=BALE,RUBIKA` (بدون دیپلوی) یا خاموش‌کردن اتصال از UI.

## تست‌ها (اجرا شده)

- `adapters/rich-text.spec.ts` — HTML کانونی → plain / Markdown بله (فاصله‌گذاری) / متادیتای روبیکا (آفست UTF-16، سقف ۳۰).
- `adapters/bale.adapter.spec.ts` — توکن با پیشوند، getMe، getChat/getChatMember/getChatMembersCount، آلبوم بدون reply_markup، کپشن ۱۰۲۴/۴۰۹۶، editMessageCaption، حذف ۴۸ ساعته، discoverChats، کلید خاموشی.
- `adapters/rubika.adapter.spec.ts` — نوع چت از پیشوند، متادیتا + خط‌های لینک، requestSendFile→upload→sendFile، editMessageText فقط متن، deleteMessage، getChat بدون getChatMember (`permissionCheck=test_post`)، discoverChats، کلید خاموشی.
- `provider-capabilities.spec.ts`، `connector-gate.spec.ts`، `telegram.adapter.spec.ts`، `canary-ping.spec.ts`، `omnichannel-phase-acceptance.spec.ts` و ۱۲ اسپک دیگر omnichannel — همه سبز (۲۰/۲۰). `tsc --noEmit` برای api و web سبز.

## ریسک‌ها و نکات باز

- **پاسخ واقعی بله/روبیکا هنوز با توکن زنده دیده نشده.** آداپترها بر پایهٔ مستندات رسمی و اسپک‌های آفلاین‌اند؛ اولین «تست توکن» و «پست آزمایشی» روی سرور، صحت پاکت پاسخ را ثابت می‌کند. اگر متن خطای غیرمنتظره برگشت، در `publications` → «ارسال ناموفق» با متن redact‌شده دیده می‌شود.
- روبیکا `getChatMember` ندارد؛ ویرایش/حذف تا اولین به‌روزرسانی واقعی نامعلوم می‌ماند (UI این را می‌گوید).
- دکمهٔ URL روبیکا مستند نیست؛ اگر بعداً رسمی شد، فقط `rubikaMessage` تغییر می‌کند (UI از `buttons: 'text-link'` در ماتریس می‌خواند).
- `OMNICHANNEL_DISABLED_PROVIDERS` باید در `docs/env` سرور مستند شود (این گزارش مرجع است).

## تصمیم‌های نیازمند تأیید مالک

1. ساخت ربات در بله و روبیکا و گذاشتن توکن‌ها روی سرور (فقط مدیر سرور).
2. انتخاب کانال‌های مقصد در بله/روبیکا و یک مقصد تست برای هر کدام.
3. در روبیکا ویرایش پست عکس‌دار با `editMessageText` انجام می‌شود و اگر روبیکا آن را برای فایل نپذیرد، delivery با کد خطای همان پیام‌رسان می‌نشیند و در «انتشارها» دیده می‌شود. اگر این رفتار مطلوب نبود، جایگزین «حذف + ارسال دوباره» یک تغییر کوچک در `rubika.adapter.ts` است — انتخاب با مالک.
