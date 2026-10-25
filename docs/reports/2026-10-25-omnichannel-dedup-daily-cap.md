# 2026-10-25 — یکتایی ارسال بله/روبیکا و سقف روزانه

برنچ: `fix/omnichannel-dedup-daily-cap`  
وضعیت: GO کتبی داده شد. بکاپ و dry-run انجام شده. push و migration بعد از rebase.

## چه عوض شد

ارسال CREATE دیگر با `Date.now()` کلید یکتا نمی‌سازد. کلید CREATE این است:

`CREATE:{sourceType}:{sourceId}:{destinationId}`

یعنی هر محصول در هر مقصد فقط یک CREATE فعال دارد، حتی اگر چند publication تاریخی داشته باشد. UPDATE و DELETE با hash متن، عکس‌ها و دکمه‌ها جدا می‌شوند. بعد از DELETE موفق، `supersededAt` روی CREATE قبلی می‌نشیند تا موجودی دوباره پست بسازد.

Enqueue داخل تراکنش با `pg_advisory_xact_lock(hashtext(key))` تصمیم می‌گیرد:

- CREATE موفق و محتوای یکسان: ارسال نمی‌شود.
- CREATE موفق و محتوای متفاوت: به UPDATE همان پیام تبدیل می‌شود.
- ردیف PENDING/RETRY: همان ردیف و همان رویداد outbox به‌روز می‌شود. اگر worker همان لحظه در حال ارسال باشد، دست نمی‌زنیم.
- ردیف DEAD/FAILED/HOLD: همان `delivery.id` دوباره PENDING می‌شود. ردیف دوم ساخته نمی‌شود.

ایندکس یکتا فقط ردیف‌های فعال را می‌پوشاند: `PENDING`، `PROCESSING`، `RETRY`، `SUCCEEDED`، `HOLD`. ردیف DEAD و ردیف supersede شده می‌توانند بمانند. هیچ ردیفی DELETE نمی‌شود.

سقف روزانه در worker، قبل از `adapter.create`، منبع حقیقت است. شمارش: CREATEهای SUCCEEDED امروز به وقت تهران بر اساس `sentAt`، به‌علاوه PROCESSINGهای ده دقیقهٔ اخیر. شمارش ردیفی است، نه distinct publication. اگر سقف پر باشد attempts نمی‌سوزد و `availableAt` می‌رود به ابتدای روز بعد تهران به‌اضافهٔ `quietEndHour` و یک jitter ثابت برای همان مقصد. ترتیب صف با `availableAt` و بعد `createdAt` است.

فاصلهٔ حداقل ارسال در worker شصت ثانیه است (اگر تنظیم مقصد بیشتر باشد، همان عدد بزرگ‌تر). حداکثر ارسال در دقیقه برای هر connection پیش‌فرض ۲ است (`OMNICHANNEL_MAX_SENDS_PER_MINUTE`). سقف هر پلتفرم از `autoDailyCap` همان مقصد می‌آید و با `OMNICHANNEL_DAILY_CAP_BALE` / `_RUBIKA` / `_TELEGRAM` قابل override است.

CREATE قدیمی‌تر از `OMNICHANNEL_STALE_DELIVERY_HOURS` (پیش‌فرض ۲۴) ارسال نمی‌شود. وضعیت `HOLD` و دلیل `stale_needs_reapproval` می‌گیرد. در کنسول انتشار دکمهٔ «تأیید مجدد» هست و reason در audit ذخیره می‌شود.

ردیف‌های DEAD با خطای `connector is disabled` با `POST /omnichannel/outbox/revive-connector-disabled` (confirm، reason، limit) از همین زمان‌بند سقف رد می‌شوند، نه با `availableAt = now()` برای همه. اگر CREATE موفق همان کلید وجود داشته باشد، ردیف قدیمی superseded می‌شود و دوباره ارسال نمی‌شود.

## تست

Jest در این ریپو نیست. تست‌ها اسکریپت `ts-node` هستند و به زنجیرهٔ `apps/api` `npm test` اضافه شدند.

- `delivery-idempotency.spec.ts`: کلیدها، reuse ردیف DEAD، supersede سناریوی پست موفق، سقف ۲۳:۵۹:۳۰ تهران در برابر ۰۰:۰۰:۰۵، HOLD کهنه، شبیه‌سازی ۳۰ پست با سقف ۲۰ و یک adapter call برای هر کلید.
- `20261025-001-omnichannel-delivery-idempotency.spec.ts`: migration ردیف DELETE نمی‌کند و `down()` وضعیت قبلی را از جدول undo برمی‌گرداند.
- `tsc --noEmit` روی فایل‌های این تغییر خطا نداد. خطاهای `sharp.default` در `telegram-media` و `upload-bytes` از master است و این برنچ آن‌ها را نساخته.
- adapter فیک است. هیچ تماس واقعی به بله یا روبیکا زده نشد.

تست integration با Postgres سرویس در CI این ریپو وجود ندارد. migration یک‌بارهٔ disposable جدا است و این برنچ را روی آن اجرا نکردم.

## Dry-run

اسکریپت فقط SELECT است: `apps/api/src/jobs/omnichannel-dedupe-dryrun.ts`.

بدون هر دو متغیر زیر به دیتابیس وصل نمی‌شود:

```text
OMNICHANNEL_DEDUPE_DRY_RUN=1
DATABASE_URL=postgres://...
```

ستون `supersededAt` هنوز روی production نبود، پس اسکریپت با همان predicate روی schema فعلی اجرا شد (معادل SELECT، بدون UPDATE). نتیجه: ۱۳۹ ردیف CREATE، ۹۸ keeper، ۴۱ loser. وضعیت loserها فقط DEAD و SUCCEEDED است؛ PENDING در فهرست نیست. پست کانال حذف نمی‌شود؛ migration فقط ردیف بازنده را در دیتابیس superseded می‌کند.

بکاپ: `/opt/taranom/backups/postgres/20261025T113411Z` (۲۱۷۹۱۰۶ بایت، `pg_restore -l` سالم).

## Rollout

GO داده شد. ترتیب باقی‌مانده:

1. بکاپ بالا گرفته شده است.
2. Dry-run بالا دیده شده است (۴۱ ردیف).
3. فقط `taranom_worker` قبل از migration متوقف می‌شود. `taranom_worker_b` از قبل خاموش است و روشن نمی‌شود.
4. API اول بالا می‌آید تا `runMigrationsWithLock` ایندکس `UQ_omnichannel_deliveries_active_create` را بسازد؛ بعد health و وجود ایندکس چک می‌شود؛ بعد فقط `taranom_worker` روشن می‌شود.
5. `scripts/auto-deploy.sh` استفاده نمی‌شود چون worker-b را هم بالا می‌آورد.

اگر worker بعد از رزرو PROCESSING و قبل از ثبت `sentAt` قطع شود، یا `adapter.create` تایم‌اوت بدهد، ردیف `HOLD` با دلیل `send_unconfirmed` می‌شود و خودکار دوباره ارسال نمی‌شود. تأیید مجدد بعد از چک کردن کانال است. ردیف SUCCEEDED و ردیف بدون delivery اصلاً به adapter نمی‌رسند. اگر insert تحویل با ایندکس یکتا برخورد کند، رویداد outbox همان تراکنش DONE می‌شود تا بدون ردیف تحویل در صف نماند.

### سخت‌سازی بعد از بازبینی موازی

- تشخیص تایم‌اوت با `isUnconfirmedSendError` (timeout / AbortError / «timed out»)؛ بودجهٔ handle به ۳۵s رسید تا از آپلود ۲۸s جلوتر باشد.
- HOLD (stale یا send_unconfirmed) دیگر با enqueue خودکار reuse نمی‌شود؛ فقط `reapprove`.
- شمارش سقف روزانه، CREATEهای SUCCEEDED امروز را حتی بعد از `supersededAt` حساب می‌کند تا DELETE همان‌روز سقف را باز نکند.
- claim اتمی: فقط `PENDING|RETRY` → `PROCESSING` با `RETURNING`. موفقیت CREATE فقط روی `PROCESSING|HOLD` ثبت می‌شود.
- در migration، loserهای SUCCEEDED وضعیت خود را نگه می‌دارند و فقط از ایندکس فعال خارج می‌شوند.

## انتخاب طراحی

ایندکس یکتای ناقص Postgres جلوی دو CREATE فعال را می‌گیرد. قفل advisory فقط تصمیم merge/reuse را سریال می‌کند و جای ایندکس را نمی‌گیرد. الگوی outbox موجود پروژه حفظ شد؛ کتابخانهٔ outbox دوم اضافه نشد.
