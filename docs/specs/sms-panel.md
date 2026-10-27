# مشخصات فنی پنل پیامک — ادمین ترنم (Site-B2B)

> وضعیت: نهایی (پاسخ‌های حامد رشید ۱۴۰۵/۰۸/۰۴ ۱۵:۳۲ تهران اعمال شد؛ §۷) · تاریخ: ۱۴۰۵/۰۸/۰۴ (2026-10-26) · مخزن فقط خوانده شد (بدون push/PR/ارسال).

## ۰. وضعیت فعلی (شواهد از مخزن)
**ارائه‌دهنده فعلی: sms.ir (سامانه پیامکی ایده‌پردازان، `api.sms.ir/v1`)** — نه «taranomsms». کلمه «taranom» فقط در نام هدر egress (`x-taranom-egress-secret`) است.

| شاهد | فایل |
|---|---|
| `SMSIR_DIRECT_BASE = 'https://api.sms.ir/v1'`، هدر `x-api-key`، مسیرهای مجاز `/send/bulk`, `/send/verify`, `/credit`, `/line`، پاسخ `{status:1}` | `apps/api/src/modules/notification/sms-transport.ts` |
| egress از طریق Cloudflare Worker (`SMS_EGRESS_BASE_URL`, `SMS_EGRESS_SECRET`) چون TLS از Hetzner به api.sms.ir قطع می‌شود؛ خط `9982007567` | `docs/reports/2026-09-28-smsir-egress.md`, `deploy/sms-egress-worker/` |
| ارسال بازاریابی با `SMS_IR_BULK_MAX`، consent، suppression، `throw new Error('sms.ir marketing send failed')` | `apps/api/src/modules/customer-marketing/marketing-sms.sender.ts` |
| قالب‌های پیش‌فرض فارسی (otpFallback، orderConfirmed، orderShipped، paymentReceived، salesPartnerWelcome …) با `{placeholder}` | `apps/api/src/modules/notification/sms-templates.defaults.ts` |
| ارسال گروهی بازاریابی (preview → compose → canary → go-live)، quiet hours تهران، سقف روزانه، ۷۰۰ کاراکتر | `docs/reports/2026-10-13-marketing-bulk-sms.md` |
| تب تنظیمات SMS ادمین، cooldown، لاگ رویداد | `apps/web/src/components/admin/settings/SmsTab.tsx`, `notification/sms-cooldown-http.ts`, `cart/sms-event-log.entity.ts` |
| CI | `.github/workflows/ci.yml`, `codeql.yml` |

**اصل طراحی:** پنل جدید روی همین زیرساخت ساخته می‌شود (بازاستفاده از `smsIrRequest`، `MarketingConsentEntity`، `MarketingSuppressionEntity`، `recheckDelivery`) و جایگزین/موازی‌کاری نمی‌کند. Stack: NestJS + TypeORM (api)، React/TS (web).

## ۱. قواعد ایران و بهترین‌عملکرد ۲۰۲۶ (با منبع)
| قاعده | وضعیت | منبع |
|---|---|---|
| ارسال پیامک انبوه تبلیغاتی/اطلاع‌رسانی بدون اجازه قبلی مشترک ممنوع (مصوبه ۳-۲۷۰ کمیسیون تنظیم مقررات ارتباطات) | تأییدشده (خبر رسمی رگولاتوری) | [ایستنا](https://ictna.ir/id/192903/)، [مهر](https://www.mehrnews.com/news/6471541/)، [ایستنا ۸۸۴۰۸](https://ictna.ir/id/88408/) |
| درج «لغو ۱۱» در انتهای پیامک اطلاع‌رسانی از سرشماره خدماتی؛ ارسال «11» = لغو، «12» = عضویت مجدد | تأییدشده | همان |
| `*800#` لغو سراسری تبلیغات در اپراتور؛ شکایت از ۱۹۵ | تأییدشده | همان، [سیتنا](https://www.citna.ir/news/262577/) |
| ارسال تبلیغاتی در ساعات غیرمتعارف تخلف است | تأییدشده (بدون عدد دقیق) | [سیتنا](https://www.citna.ir/news/262577/) |
| بازه مجاز خط تبلیغاتی: ۸ تا ۲۱ (یک منبع ۸ تا ۲۲) | **تأییدنشده — فقط قوانین پنل‌دهنده‌ها؛ متن رسمی رگولاتوری پیدا نشد** | [ملی‌پیامک (۸–۲۲)](https://www.melipayamak.com/rules/)، [پیشگام رایان (۲۱–۸ ممنوع)](https://www.pishgamrayan.com/fa/%D9%85%D9%82%D8%A7%D9%84%D9%87/sms-rules) |
| خط خدماتی فقط برای پیام خدماتی به درخواست‌کنندگان؛ تبلیغ/تخفیف/تبریک از خط خدماتی ممنوع | تأییدنشده رسمی (قانون پنل‌دهنده به نقل از ابلاغیه همراه اول) | [ملی‌پیامک](https://www.melipayamak.com/rules/)، [شتاب‌تک](https://www.shetab.com/component/k2/39.html?Itemid=302&lang=fa) |
| «لغو11» در همه پیامک‌های تبلیغاتی و خدماتی (به‌جز verify/OTP) | تأییدنشده رسمی (قانون پنل‌دهنده) | [ملی‌پیامک](https://www.melipayamak.com/rules/) |
| sms.ir: `/send/bulk` حداکثر ۱۰۰ گیرنده، زمان‌بندی ۱ ساعت تا ۳۶۵ روز آینده، `messageIds` با 0 = لیست سیاه، null = شماره/متن نامعتبر؛ `/send/verify` از خط خدماتی حتی برای کسانی که تبلیغات را بسته‌اند؛ `/credit`؛ گزارش `/send/{id}`, `/send/pack/{packId}`؛ دریافتی `/receive/live` | تأییدشده (مستند رسمی) + SDKهای غیررسمی برای مسیرهای گزارش/دریافت | [sms.ir REST](https://sms.ir/rest-api/)، [sdk Go غیررسمی](https://pkg.go.dev/github.com/darinehgroup/sms-ir-sdk-go) |
| بهترین‌عملکرد عمومی: ثبت مدرک رضایت (زمان/منبع)، سقف فرکانس، idempotency، exponential backoff با jitter، تأیید دومرحله‌ای برای عملیات پرخطر | اصول مهندسی رایج؛ بدون منبع رگولاتوری | — |

**تصمیم مالک:** ساعات مجاز PROMO پیش‌فرض ۰۸:۰۰–۲۱:۰۰ Asia/Tehran و **در تنظیمات قابل‌تغییر** (`promoWindowStart`/`promoWindowEnd`، فقط مدیر کل و مدیر پیامک، با audit؛ اگر خارج ۰۸–۲۱ تنظیم شود UI هشدار «رسماً تأییدنشده» نشان می‌دهد)؛ هر پیام خارج بازه به اولین پنجره مجاز موکول می‌شود. OTP/TRANSACTIONAL بدون محدودیت ساعت ولی فقط از خط/متد خدماتی.

## ۲. دامنه
### ۲.۱ کلاس پیام
- `OTP` — فقط verify، بدون لغو11، بدون محدودیت ساعت، بدون نیاز به consent، rate-limit سخت.
- `TRANSACTIONAL` — وضعیت سفارش، پرداخت، کمیسیون همکار؛ خط خدماتی؛ لغو11 الزامی (طبق قواعد پنل)؛ نیاز به رابطه فعال مشتری.
- `PROMO` — تبلیغاتی؛ consent صریح `GRANTED`، خط تبلیغاتی، لغو11 الزامی، quiet hours، سقف فرکانس.

### ۲.۲ ارسال تکی
فرم: گیرنده(موبایل یا انتخاب مشتری) + قالب/متن + کلاس. اعتبارسنجی موبایل ایران (`^09\d{9}$` پس از نرمال‌سازی ارقام فارسی/عربی، `+98`/`0098`). شمارش کاراکتر و تعداد پارت (فارسی UCS-2: ۷۰ تک‌پارت، ۶۷ در چندپارت). گیت‌ها: blacklist، unsubscribe، consent، quiet hours، rate limit.
- **PROMO تکی توسط بازاریاب مجاز است** فقط وقتی همه سمت سرور enforce شوند: رضایت صریح `GRANTED` مشتری، الحاق قفل‌شده «لغو11»، پنجره ساعات مجاز تنظیمات، و rate limit (سقف فرکانس هر شماره + ۱۰ ارسال/دقیقه/کاربر). شکست هر گیت = رد (403/422/429) بدون override. اپراتور فقط TRANSACTIONAL تکی.

### ۲.۳ ارسال انبوه
- مخاطب: لیست، سگمنت، یا آپلود CSV (حداکثر ۵۰٬۰۰۰ ردیف، dedupe، گزارش ردیف‌های رد شده).
- `preview` → تعداد واجد/رد (با دلیل)، نمونه ۵ پیام شخصی‌سازی‌شده، برآورد هزینه **بر حسب تعداد پارت پیامک** (Σ پارت هر گیرنده)، مقایسه با اعتبار باقی‌مانده (همان واحد: تعداد پیامک).
- **تأیید دومرحله‌ای اجباری داخل پنل:**
  1. مرحله ۱ (`prepare`): کاربر خلاصه را می‌بیند؛ سرور `confirmationToken` یک‌بارمصرف (TTL ۱۰ دقیقه) بر پایه hash(campaignId + audienceSnapshotHash + bodyHash + scheduledAt) صادر می‌کند.
  2. مرحله ۲ (`confirm`): کاربر عدد دقیق گیرندگان را تایپ می‌کند + کد OTP به موبایل خودِ ادمین (یا رمز مجدد). برای **همه** ارسال‌های انبوه (بدون آستانه، تصمیم مالک §۹): تأیید نفر دوم با نقش «مدیر پیامک» یا «مدیر کل» (four-eyes)؛ تأییدکننده ≠ سازنده.
  - هر تغییر در متن/مخاطب/زمان token را باطل می‌کند. بدون token معتبر، API ارسال انبوه 409 می‌دهد.
- canary: ارسال اول به حداکثر ۵ شماره تست داخلی (لیست `SMS_TEST_NUMBERS` در تنظیمات) قبل از go-live (الگوی موجود).
- chunk به ۱۰۰ (`SMS_IR_BULK_MAX`)؛ توقف خودکار (circuit) اگر نرخ خطای chunk > ۲۰٪ یا اعتبار کم شد؛ دکمه «توقف اضطراری» (pause/cancel).

### ۲.۴ قالب‌های پایه
| key | کلاس | متد sms.ir | متغیرها |
|---|---|---|---|
| `otp.login` | OTP | verify (templateId از env/تنظیمات) | `code` |
| `order.registered / confirmed / shipped / paymentReceived` | TRANSACTIONAL | bulk تکی یا verify | `orderNumber, trackingLine, amountToman, refId` |
| `partner.commission.credited` (جدید) | TRANSACTIONAL | bulk/verify | `partnerName, amountToman, orderNumber, balanceToman, period` |
| `partner.commission.settled` (جدید) | TRANSACTIONAL | bulk/verify | `amountToman, refId, date` |
| `promo.generic` | PROMO | bulk | `name, city, link` |
قالب‌ها نسخه‌دار (`version`)، با لیست متغیر مجاز (whitelist) و پیش‌نمایش؛ متغیر ناشناخته = خطای اعتبارسنجی (برخلاف `fillSmsTemplate` فعلی که خالی می‌گذارد — برای قالب‌های جدید strict). مقادیر verify ≤ ۲۵ کاراکتر (طبق مستند غیررسمی؛ تأییدنشده). قالب‌های پیش‌فرض موجود در `SMS_TEMPLATE_DEFAULTS` به‌عنوان seed مهاجرت داده می‌شوند. متن PROMO/TRANSACTIONAL: افزودن خودکار «\nلغو11» اگر نبود؛ قابل حذف نیست.

### ۲.۵ لیست مخاطب و سگمنت
- لیست ایستا (اعضای دستی/CSV) و سگمنت پویا (فیلتر JSON روی مشتریان: کانال RETAIL/WHOLESALE، شهر، تعداد سفارش، آخرین خرید، نقش همکار فروش، برچسب).
- سگمنت در لحظه ارسال snapshot می‌شود (`audience_snapshot`) تا قابل حسابرسی باشد.

### ۲.۶ زمان‌بندی
- `scheduledAt` (ذخیره UTC، نمایش تهران/جلالی). صف داخلی خودمان زمان‌بندی می‌کند (نه SendDateTime سرویس‌دهنده) تا لغو/گیت‌ها در لحظه اجرا مجدد بررسی شوند.
- PROMO خارج پنجره مجاز: رد در UI یا جابه‌جایی به پنجره بعد با هشدار صریح.
- لغو زمان‌بندی تا قبل از شروع.

### ۲.۷ صف + retry با backoff
- صف مبتنی بر DB (`sms_message` با `status`, `next_attempt_at`, `attempts`) و claim اتمی (`UPDATE … WHERE status IN (…)` مثل الگوی `deliverById`) یا BullMQ/Redis اگر از قبل در پروژه هست — Cursor باید بررسی کند و بازاستفاده کند.
- وضعیت‌ها: `QUEUED → SENDING → SENT → DELIVERED | UNDELIVERED | FAILED`، `SKIPPED(reason)`، `PENDING_UNKNOWN`، `CANCELLED`.
- Retry فقط برای `TIMEOUT/NETWORK/HTTP 5xx/429`؛ نه برای `PROVIDER` 4xx، شماره نامعتبر، blacklist (messageId=0/null).
- backoff: `delay = min(base*2^attempt, 15min) ± jitter 20%`، base=۳۰s، حداکثر ۵ تلاش؛ سپس `FAILED` + dead-letter.
- **ابهام ارسال** (timeout پس از رسیدن درخواست): از `otpDispatchFromTransport` → `PENDING_UNKNOWN`؛ قبل از retry، گزارش pack/message بررسی شود تا پیام تکراری نرود. idempotencyKey یکتا برای هر (campaignId, phone).
- PROMO در retry نیز quiet hours را رعایت می‌کند.

### ۲.۸ گزارش تحویل
- ذخیره `providerMessageId`/`packId`؛ poller هر ۵ دقیقه تا ۷۲ ساعت (`GET /send/{id}` یا `/send/pack/{packId}`) → `deliveryState`. (وب‌هوک DLR برای sms.ir در مستند رسمی دیده نشد — تأییدنشده.)
- داشبورد: نرخ تحویل/شکست به‌ازای کمپین، اپراتور (پیشوند)، روز؛ خروجی CSV.

### ۲.۹ اعتبار باقی‌مانده
- **اعتبار sms.ir بر حسب تعداد پیامک است، نه ریال** (تأیید مالک). `GET /credit` با cache ۶۰ ثانیه؛ نمایش در هدر: «اعتبار: N پیامک»؛ آستانه هشدار هم بر حسب پیامک؛ برآورد هزینه هر ارسال = تعداد پارت‌ها؛ بلاک ارسال انبوه اگر پارت برآوردی > اعتبار. هیچ مبلغ ریالی/تومانی نمایش داده نمی‌شود. (`cost` بازگشتی provider نیز به‌عنوان پارت ذخیره می‌شود.)

### ۲.۱۰ لغو11 / unsubscribe
- poller پیام‌های دریافتی (`/receive/live` یا معادل adapter) هر ۲ دقیقه؛ نرمال‌سازی متن (ارقام فارسی، فاصله، «لغو», «لغو11», "11", "STOP") → `sms_unsubscribe` با منبع `INBOUND_11`؛ «12» → resubscribe فقط برای کانال خدماتی/اطلاع‌رسانی و ثبت consent جدید.
- لینک/دکمه لغو در پرتال مشتری و دستی توسط ادمین (با دلیل).
- همگام با `MarketingSuppressionEntity` موجود (یک منبع حقیقت؛ unsubscribe جدید روی همان جدول یا view).
- اثر: PROMO و TRANSACTIONAL غیرضروری مسدود؛ OTP و پیام‌های الزامی سفارش جاری مجاز (قابل‌تنظیم).

### ۲.۱۱ لیست سیاه
- `sms_blacklist(phone, reason, scope: ALL|PROMO, createdBy, expiresAt?)`؛ افزودن دستی، CSV، خودکار از messageId=0 sms.ir (`PROVIDER_BLACKLIST`).
- blacklist با scope=ALL حتی OTP را مسدود می‌کند (برای سوءاستفاده/اسپم OTP).

### ۲.۱۲ Rate limiting
- OTP: هر شماره ۱ در ۶۰ث (cooldown موجود)، ۵ در ساعت، ۱۰ در روز؛ هر IP ۲۰ در ساعت.
- هر شماره PROMO: حداکثر ۱ در روز و ۳ در هفته (قابل‌تنظیم).
- throughput خروجی به provider: token bucket (پیش‌فرض ۵ درخواست bulk/ثانیه)، قابل تنظیم با env.
- API ادمین: ۶۰ درخواست/دقیقه/کاربر؛ endpointهای ارسال ۱۰/دقیقه.

### ۲.۱۳ نقش‌ها و Audit log
| نقش (کد / فارسی) | مجوز |
|---|---|
| `SUPER_ADMIN` / مدیر کل | همه مجوزها؛ تنظیمات provider (بدون نمایش کلید)، مدیریت نقش‌ها، audit log کامل |
| `SMS_MANAGER` / مدیر پیامک | قالب‌ها، blacklist/لغو، تأیید مرحله دوم انبوه، تنظیمات ساعات/سقف/آستانه، گزارش و audit (خواندنی) |
| `SMS_OPERATOR` / اپراتور | ارسال تکی TRANSACTIONAL، مشاهده گزارش و اعتبار |
| `SMS_MARKETER` / بازاریاب | لیست/سگمنت، کمپین (آماده‌سازی و تأیید مرحله ۱)، **ارسال تکی PROMO با گیت‌های اجباری §۲.۲**، مشاهده گزارش و اعتبار |
همه نقش‌ها اعتبار و گزارش را می‌بینند (موبایل ماسک برای اپراتور و بازاریاب). نقش جداگانه VIEWER حذف شد.
- با RBAC موجود ادمین ادغام شود (بررسی ماژول auth فعلی).
- `sms_audit_log` append-only: actor, action, targetType, targetId, before/after (JSON بدون PII کامل — موبایل ماسک `0912***4567`)، ip, userAgent, at. اکشن‌ها: send.single, campaign.prepare/confirm/approve/cancel/pause, template.*, list.*, blacklist.*, unsubscribe.manual, settings.update, export.

### ۲.۱۴ Adapter مستقل از provider
```ts
export interface SmsProvider {
  readonly id: 'smsir' | 'mock' | string;
  sendSingle(req: { to: string; body: string; line?: string; idempotencyKey: string }): Promise<SendResult>;
  sendBulk(req: { to: string[]; body: string; line?: string; idempotencyKey: string }): Promise<BulkSendResult>; // ≤ maxBatch
  sendTemplate(req: { to: string; templateId: string; params: Record<string,string> }): Promise<SendResult>; // OTP/verify
  getDeliveryStatus(ids: string[]): Promise<DeliveryReport[]>;
  getCredit(): Promise<{ amount: number; unit: 'CREDIT'|'IRR'|'SMS' }>;
  fetchInbound(since: Date): Promise<InboundMessage[]>;
  readonly capabilities: { maxBatch: number; scheduling: boolean; inbound: boolean; dlrWebhook: boolean };
}
type SendResult = { ok: boolean; providerMessageId?: string; cost?: number;
  error?: { code: 'TIMEOUT'|'NETWORK'|'HTTP'|'PROVIDER'|'INVALID_RECIPIENT'|'BLACKLISTED'|'RATE_LIMITED'|'PARSE'; retryable: boolean; ambiguous: boolean; message: string } };
```
- `SmsIrProvider` روی `smsIrRequest` (egress حفظ شود)، `MockSmsProvider` برای تست/dev (`SMS_PROVIDER=mock`).
- انتخاب با `SMS_PROVIDER` env؛ در `NODE_ENV=test` اجباراً mock.
- رازها فقط از env: `SMSIR_API_KEY`, `SMSIR_LINE_PROMO`, `SMSIR_LINE_SERVICE`, `SMSIR_OTP_TEMPLATE_ID`, `SMS_EGRESS_BASE_URL`, `SMS_EGRESS_SECRET`. (اگر کلید فعلاً در DB تنظیمات است، env اولویت دارد و UI فقط «تنظیم شده/نشده» نمایش دهد؛ هرگز مقدار.)

## ۳. مدل داده (TypeORM، مهاجرت جدید `2026MMDD-001-sms-panel.ts`)
- `sms_template(id, key unique, name, messageClass, body, variables jsonb, providerTemplateId?, version, isActive, createdBy, updatedAt)`
- `sms_contact_list(id, name, description, type STATIC|DYNAMIC, filter jsonb?, createdBy, createdAt)`
- `sms_contact_list_member(listId, phoneNormalized, customerId?, vars jsonb, addedAt)` PK(listId, phone)
- `sms_campaign(id, name, messageClass, templateId?, bodySnapshot, listId?, segmentFilter?, audienceSnapshotHash, recipientCount, estimatedParts, estimatedCost, scheduledAt?, status DRAFT|PREPARED|AWAITING_APPROVAL|SCHEDULED|SENDING|PAUSED|COMPLETED|CANCELLED|FAILED, createdBy, confirmedBy?, approvedBy?, confirmedAt?, approvedAt?)`
- `sms_confirmation(id, campaignId, tokenHash, payloadHash, expiresAt, usedAt?, actorId)`
- `sms_message(id, campaignId?, templateKey?, messageClass, phoneNormalized, customerId?, body, parts, status, skipReason?, attempts, nextAttemptAt, idempotencyKey unique, provider, providerMessageId?, packId?, cost?, deliveryState?, deliveredAt?, lastError?, createdAt)` ایندکس (status,nextAttemptAt)، (phone, createdAt)
- `sms_unsubscribe(phoneNormalized PK, scope, source INBOUND_11|PORTAL|ADMIN|PROVIDER, at, resubscribedAt?)` (یا ادغام با marketing_suppression)
- `sms_blacklist(phoneNormalized PK, scope, reason, createdBy, expiresAt?)`
- `sms_inbound(id, providerId unique, from, body, receivedAt, handledAs)`
- `sms_audit_log(id, actorId, action, targetType, targetId, meta jsonb, ip, at)`
- `sms_credit_snapshot(id, amount, unit, at)`

## ۴. API (پیشوند `/v1/admin/sms`، همه با guard نقش + audit)
| متد | مسیر | نقش |
|---|---|---|
| GET | `/credit` | همه نقش‌ها |
| POST | `/send` (تکی) | اپراتور (TRANSACTIONAL)، بازاریاب (PROMO با گیت‌ها)، مدیر پیامک، مدیر کل |
| GET/POST/PATCH/DELETE | `/templates`, `/templates/:id`, POST `/templates/:id/preview` | مدیر پیامک (GET: همه) |
| GET/POST/PATCH/DELETE | `/lists`, `/lists/:id`, POST `/lists/:id/import` (CSV)، GET `/lists/:id/members` | بازاریاب |
| POST | `/segments/preview` | بازاریاب |
| POST | `/campaigns` (DRAFT) · GET `/campaigns` · GET `/campaigns/:id` | بازاریاب |
| POST | `/campaigns/:id/preview` | بازاریاب |
| POST | `/campaigns/:id/prepare` → confirmationToken | بازاریاب |
| POST | `/campaigns/:id/confirm` {token, typedCount, otp} | بازاریاب |
| POST | `/campaigns/:id/approve` {token} | مدیر پیامک / مدیر کل (≠ سازنده) |
| POST | `/campaigns/:id/canary` · `/pause` · `/resume` · `/cancel` | بازاریاب / مدیر پیامک |
| GET | `/messages?campaignId&status&phone&from&to` · GET `/messages/:id` | همه نقش‌ها |
| GET | `/reports/summary` · `/reports/export.csv` | همه نقش‌ها |
| GET/POST/DELETE | `/blacklist`, POST `/blacklist/import` | مدیر پیامک |
| GET/POST/DELETE | `/unsubscribes` | مدیر پیامک |
| GET | `/audit-log` | مدیر کل (مدیر پیامک: خواندنی) |
| GET/PATCH | `/settings` (ساعات مجاز PROMO، سقف‌ها، آستانه اعتبار بر حسب پیامک؛ بدون کلید) | مدیر پیامک / مدیر کل |
| POST | `/settings/probe` (بازاستفاده از probe موجود) | مدیر پیامک |
خطاها: 400 اعتبارسنجی، 403 نقش، 409 token نامعتبر/منقضی، 422 خارج quiet hours، 402 اعتبار ناکافی، 429 rate limit. همه پاسخ‌ها با پیام فارسی و `code` ماشینی.

## ۵. تست‌ها (CI، بدون شبکه واقعی)
- Unit: نرمال‌سازی موبایل (ارقام فارسی/+98)، شمارش پارت، قالب strict و افزودن لغو11، تشخیص «لغو۱۱/11/۱۱/12»، quiet hours تهران (مرزهای پیش‌فرض ۰۷:۵۹/۰۸:۰۰/۲۰:۵۹/۲۱:۰۰ و با پنجره سفارشی از تنظیمات)، برآورد پارت = هزینه، backoff+jitter (با seed)، طبقه‌بندی خطای retryable/ambiguous، rate limiter.
- Adapter: `SmsIrProvider` با `fetchImpl` ساختگی — نگاشت messageId 0 → BLACKLISTED، null → INVALID_RECIPIENT، status≠1 → PROVIDER، timeout → ambiguous؛ مسیر egress و هدر secret.
- Service/integration (DB تست موجود در CI): چرخه کامل کمپین DRAFT→…→COMPLETED با MockProvider؛ token دومرحله‌ای (منقضی، استفاده مجدد، تغییر متن پس از prepare، approver = creator رد)؛ chunk ۱۰۰؛ circuit breaker؛ retry تا FAILED؛ عدم ارسال تکراری در PENDING_UNKNOWN؛ unsubscribe/blacklist در لحظه اجرا؛ اعتبار ناکافی (پارت > اعتبار پیامک) → 402؛ ارسال تکی PROMO بازاریاب: بدون رضایت 403، خارج ساعت 422، rate limit 429، لغو11 قفل‌شده؛ اپراتور PROMO → 403.
- RBAC: هر endpoint با هر نقش؛ audit log برای هر اکشن تغییرده و ماسک PII.
- Guard: تستی که اگر `NODE_ENV=test` و provider ≠ mock → fail؛ و تستی که هیچ `fetch` به `api.sms.ir` در CI رخ نمی‌دهد.
- Web: تست کامپوننت wizard تأیید دومرحله‌ای و شمارنده کاراکتر؛ `tsc --noEmit`.

## ۶. خارج از دامنه / ریسک
- اتصال واقعی به sms.ir، خرید خط، تبدیل خط به خدماتی، ثبت templateId در پنل sms.ir — کار دستی مالک.
- اعداد ساعات مجاز و قواعد خط خدماتی پیش از تولید با پشتیبانی sms.ir / متن رسمی رگولاتوری تأیید شوند.

## ۷. تصمیم‌های مالک (۱۴۰۵/۰۸/۰۴، ۱۵:۳۲ تهران)
1. اعتبار sms.ir = تعداد پیامک؛ اعتبار و برآورد هزینه بر حسب پارت پیامک نمایش داده می‌شود.
2. ساعات ارسال تبلیغاتی پیش‌فرض ۰۸:۰۰–۲۱:۰۰ و در تنظیمات قابل‌تغییر.
3. بازاریاب می‌تواند PROMO تکی بفرستد، فقط با رضایت مشتری، لغو11، ساعات مجاز و rate limit اجباری.
4. نقش‌ها: مدیر کل، مدیر پیامک، اپراتور، بازاریاب.

## ۸. منابع داده و سگمنت‌ها (بازبینی مخزن master @ `3642bfc`، ۱۴۰۵/۰۸/۰۵)
> PR #107 ادغام شده؛ ماژول `apps/api/src/modules/sms-panel/` روی master است. همه مسیرها نسبت به ریشه مخزن.

### ۸.۱ منابع مخاطب موجود
| منبع | جدول / فایل | فیلدهای قابل‌استفاده | نکته |
|---|---|---|---|
| مشتری عمده | `customers` — `apps/api/src/modules/customer/entities/customer.entity.ts` | `phone` (unique، L19–20)، `phone2` (L22)، `businessName`/`ownerName`، `type` (پیش‌فرض `B2B`، L28–29)، `segment` (پیش‌فرض `C`، L31–32)، `status` (L34–35)، `province`/`city` (رشته آزاد، L37–41)، `isActive`، `createdAt` | کانال از `type` تعیین می‌شود: `customer-channel.ts` L12–25 (`RETAIL`/`B2C` = خرده، بقیه = عمده) |
| مشتری خرده (تک) | **همان جدول `customers`** با `type IN ('RETAIL','B2C')` | همان | جدول یا سایت جداگانه‌ای برای خرده در مخزن دیده نشد؛ `auth/retail-identity.ts` فقط نام/شهر ثبت‌نام خرده را تمیز می‌کند |
| همکار فروش (بازاریاب) | `sales_partner_profiles` — `sales-partner/entities/sales-partner-profile.entity.ts` | `phone` (unique، L19–20)، `displayName`، `status` (L26–27)، `userId`، `createdAt` | وضعیت‌ها: `sales-partner-policy.ts` L5–12 → `PENDING_REVIEW, NEEDS_INFORMATION, ACTIVE, SUSPENDED, REJECTED, CLOSED`. **رابطه‌ای با `customers` ندارد و شهر ندارد.** |
| معرف عمده (برنامه دوم همکاری) | `wholesale-referral/entities/wholesale-referral-partner.entity.ts` | `phone` (L9–10)، `displayName`، `status` (پیش‌فرض `PENDING_PHONE`، L24–25) | **منبع مخاطب است** (تصمیم مالک §۹)، کد `WHOLESALE_REFERRAL`، در ردهٔ عمده |
| `affiliate` | `apps/api/src/modules/affiliate/` | فقط `GET health` + postback؛ جدول مخاطب ندارد | منبع مخاطب نیست |

### ۸.۲ ابعاد سگمنت
| بُعد درخواستی | وجود در مخزن | منبع |
|---|---|---|
| منبع | ✅ مشتق‌شده | `customers.type` + جدول همکار |
| شهر/استان | ✅ برای مشتری، رشته آزاد (بدون جدول شهر؛ لیست مرجع فقط در وب `apps/web/src/lib/iran-geo.ts`) — ❌ برای همکار | customer.entity L37–41 |
| وضعیت سفارش | ✅ `orders.status` (پیش‌فرض `PENDING_REVIEW`، `order.entity.ts` L27–28)؛ enum مرکزی ندارد؛ مقادیر دیده‌شده: `PENDING_REVIEW, CONFIRMED, PROCESSING, PACKED, SHIPPED, DELIVERED, COMPLETED, CANCELLED, DELETED` (`customer-marketing.constants.ts` L64–66، `sales-partner-ledger-policy.ts` L11–18) | |
| آخرین خرید | ⚠️ ستون ندارد؛ باید `MAX(orders.createdAt)` روی سفارش‌های `SETTLED_ORDER_STATUSES` محاسبه شود | `orders.customerId` L21–22 |
| گروه مشتری | ⚠️ موجودیت «گروه» ندارد؛ نزدیک‌ترین: `customers.segment` با `VIP,A,B,C` (`apps/web/src/lib/admin-customer-workspace.ts` L4) | |
| وضعیت همکار | ✅ `sales_partner_profiles.status` (۶ مقدار، نه ۳ مقدار UI v2) | |
| برچسب‌ها (UI v2) | ❌ ستون/جدول tag برای مشتری پیدا نشد | |
| رضایت | ✅ `marketing_consent` با `customerId`+`channel`+`status` — فقط برای مشتری؛ **برای همکار رضایت تبلیغاتی وجود ندارد** | `customer-marketing/entities/marketing-consent.entity.ts` L12–22 |
| لغو | ✅ `marketing_suppression.phoneNormalized` unique + `sms_unsubscribe` + `sms_blacklist` (بر پایه شماره → روی هر ۳ منبع اعمال‌پذیر) | |

### ۸.۳ تحلیل شکاف پنل فعلی
| قابلیت | وضعیت | شاهد |
|---|---|---|
| انتخاب مخاطب از منابع سایت | ❌ کمپین فقط از `listId` (لیست ایستا/CSV) | `sms-panel.service.ts` `createCampaign` L799–850، `previewCampaign` L860+ |
| سگمنت پویا | ❌ stub: `count: 0` | `sms-panel.controller.ts` L138–142 |
| ستون `filter` لیست DYNAMIC | ✅ ستون هست، استفاده نمی‌شود | `sms-panel.entities.ts` L62–65 |
| ارسال تکی با جستجوی مخاطب | ❌ ورودی دستی «شناسه مشتری» | `apps/web/src/components/admin/sms/AdminSmsSend.tsx` L90–98 |
| رضایت | ⚠️ `hasPromoConsent` کانال را چک نمی‌کند و فقط `customerId` | service L249–253 |
| dedupe | ⚠️ فقط PK (listId, phone) و idempotencyKey `camp:{id}:{phone}`؛ dedupe بین منابع ندارد | service L1312–1332، L1189–1192 |
| snapshot گیرندگان | ✅ `sms_campaign_recipient(campaignId, phone, customerId, parts)` | entities L198–211، enqueue L1172+ |
| قالب strict | ✅ `domain/template.ts` L16؛ ❌ متغیر به‌ازای گیرنده (name/city…) از داده منبع پر نمی‌شود — `bodySnapshot` یکسان برای همه (L1199) |
| زمان‌بندی | ✅ `scheduledAt` + انتقال به پنجره مجاز | L1178–1184 |
| گزارش تحویل | ✅ polling هر ۵ دقیقه (`sms-panel.jobs.ts` L31) روی `GET /send/{id}` (`smsir.provider.ts` L198–201)؛ ⚠️ فقط ۱۰۰ ردیف آخر، یکی‌یکی، بدون backoff؛ webhook ندارد (مستند sms.ir هم webhook نشان نداد) | service L1522–1550 |
| inbound لغو11 | ✅ `/receive/live` هر ۲ دقیقه | provider L242، jobs L41 |
| نقش‌ها | ✅ `ADMIN/SMS_MANAGER/SMS_OPERATOR/SMS_MARKETER` | `auth/staff-access.ts` L3–12، L55–64؛ `sms-panel/sms-roles.ts` |
| تست‌ها در CI | ✅ ۵ spec در `apps/api/scripts/unit-specs.txt` L7–11؛ CI فقط `npm test` (unit)؛ تست DB واقعی برای sms نیست (الگوی `sales-partner-integrity.integration.spec.ts` نیازمند DB محلی است و در CI اجرا نمی‌شود) | `.github/workflows/ci.yml` |

### ۸.۴ مدل پیشنهادی
- **`AudienceContact` (view منطقی در کد، نه جدول جدید):** `{ phone (09…), sources: ('WHOLESALE'|'RETAIL'|'SALES_PARTNER')[], customerId?, salesPartnerId?, name, city?, province?, customerSegment?, partnerStatus?, lastOrderAt?, orderCount, orderStatuses[], promoConsent: boolean, optedOut, blacklisted }`.
- dedupe بر شماره نرمال (`domain/phone.ts`) روی `phone` و `phone2` مشتری و شماره همکاران؛ اولویت داده: `WHOLESALE > WHOLESALE_REFERRAL > SALES_PARTNER > RETAIL`.
- سگمنت = `sms_segment(id, name, rules jsonb, sources text[], createdBy, updatedAt)`؛ قواعد AND، whitelist فیلد/عملگر، بدون SQL خام از ورودی.
- همکاران (`sales_partner_profiles`, `wholesale_referral_partners`): رضایت PROMO پیش‌فرض با ستون‌های `smsPromoConsent`, `smsPromoConsentSource` (`OWNER_DEFAULT_POLICY` / `OWNER_DEFAULT_POLICY_BACKFILL`), `smsPromoConsentAt` + migration backfill؛ لغو با «لغو11» از مسیر inbound موجود، و لغو همیشه بر رضایت مقدم است.
- سگمنت: فقط AND (OR ساخته نمی‌شود).
- ارسال تکی به شماره خارج همه منابع: فقط مدیر کل و مدیر پیامک، برای خدماتی و تبلیغاتی؛ لغو/سیاه/لغو11/ساعات/rate limit اعمال می‌شوند؛ audit `send.single.offlist`.
- `unitPricePerPart` (ریال) در تنظیمات، nullable و **بدون پیش‌فرض**؛ تا خالی است UI «قیمت تنظیم نشده» و هزینه ریالی محاسبه نمی‌شود.

## ۹. لاگ تصمیم‌های مالک (حامد رشید، ۱۴۰۵/۰۸/۰۵ تهران)
| # | تصمیم |
|---|---|
| 1 | اولویت داده شماره مشترک: عمده، سپس همکار، سپس خرده. معرف عمده (`wholesale_referral_partners`) در ردهٔ عمده و پس از مشتری عمده قرار می‌گیرد. این انتخاب مجری است، چون معرف عمده در کانال عمده فعالیت می‌کند و مخزن مانعی برای آن ندارد. |
| 2 | ساعات مجاز PROMO ۰۸–۲۱ تهران و قابل‌تغییر (طبق §۱). |
| 3 | تأیید دوم برای همه ارسال‌های انبوه، بدون آستانه. فرض ۱۰۰۰ گیرنده حذف شد. |
| 4 | همه همکاران به‌صورت پیش‌فرض PROMO دریافت می‌کنند و با «لغو11» خارج می‌شوند. پرچم رضایت پیش‌فرض با منبع و زمان ثبت می‌شود، به‌اضافهٔ backfill. |
| 5 | ارسال تکی به شماره خارج از منابع فقط برای مدیر کل و مدیر پیامک مجاز است، در هر دو کلاس پیام، و بررسی لغو و سیاه برقرار است. |
| 6 | قیمت هر پارت تنظیم‌شدنی است و پیش‌فرض ندارد. تا تنظیم نشود، UI «قیمت تنظیم نشده» نشان می‌دهد. |
| 7 | شرط‌های سگمنت فقط AND هستند. |
| 8 | `wholesale_referral_partners` منبع مخاطب است. |
| 9 | `customers.phone2` گیرنده است و با همان اولویت dedupe می‌شود. |

## ۱۰. ریسک‌های افزوده
- رضایت پیش‌فرض تبلیغاتی همکاران تصمیم مالک است. مبنای حقوقی آن (مصوبه ۳-۲۷۰ «اجازه قبلی مشترک») باید بررسی شود.
- `phone2` ممکن است شماره فرد دیگری (منشی یا همکار) باشد که رضایت نداده است. رضایت مشتری به هر دو شماره تعمیم داده می‌شود.
- ارسال PROMO مدیران به شماره خارج از منابع، رضایت ثبت‌شده ندارد و فقط بر audit تکیه می‌کند.
- تأیید دوم برای هر انبوه، گلوگاه عملیاتی دو مدیر است.
- وضعیت‌های معرف عمده از کد خوانده می‌شوند و در این بازبینی فهرست نشده‌اند.
