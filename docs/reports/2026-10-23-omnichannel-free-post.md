# FREE_POST — متن آزاد کانال انتشار (MVP)

تاریخ: 2026-10-23. دیپلوی نشده. پرچم پیش‌فرض خاموش.

## مسیر شبکه (الزام حامد)

ارسال زندهٔ FREE_POST **همان Gateway کانال انتشار** است که PRODUCT / BLOG_POST / CMS_PAGE از آن می‌روند:

```
ادمین /admin/omnichannel
  → POST /v1/omnichannel/preview | POST /v1/omnichannel/publications
  → OmnichannelService.createPublication
  → outbox publication.deliver.requested
  → OutboxWorkerService.handlePublicationDeliver
  → ChannelAdapterRegistry (TelegramAdapter موجود)
```

هندلر درخواست، ماژول `free-post.ts`، و UI به `api.telegram.org` وصل نمی‌شوند و `TelegramAdapter.create` را صدا نمی‌زنند. تنها دو `adapter.create` قبلی (canary-ping و test-post) سر جایشان مانده‌اند. مسیر جدا به Bot API از سرور ایران در این PR نیست.

اگر ربات به کانال دسترسی نداشته باشد، همان خطای آداپتر موجود برمی‌گردد. این PR دسترسی ربات را عوض نمی‌کند.

## پرچم

`OMNICHANNEL_FREE_POST_ENABLED`

- پیش‌فرض: خاموش (هر مقداری غیر از رشتهٔ دقیق `true`)
- خاموش: گزینهٔ «متن آزاد» در UI نیست؛ preview و publications برای `sourceType=FREE_POST` با 403 و پیام «ارسال متن آزاد خاموش است» رد می‌شوند
- روشن‌کردن فقط با GO جداگانهٔ حامد، روی سرور ایران، بدون این PR

ارسال زنده همچنان `OMNICHANNEL_CONNECTORS_ENABLED=true` می‌خواهد. مقصد باید canary یا verified باشد. ساخت پست جدید سقف روزانه را رعایت می‌کند. در حالت LIVE ربات، ساعت سکوت ساخت پست جدید را بلوکه می‌کند. ویرایش همان `free:<uuid>` سقف ساخت را مصرف نمی‌کند.

## مدل

- `sourceType = FREE_POST`
- `sourceId = free:<uuid>` (اگر کلاینت ندهد سرور می‌سازد؛ شناسهٔ بد 400 است)
- همان sourceId = به‌روزرسانی همان پست. «پست تازه» در UI شناسهٔ جدید می‌سازد
- reason برای create (پیش‌نویس و زنده) اجباری است
- کپشن اجباری است. یک URL تصویر اختیاری، فقط HTTPS دامنهٔ ترنم
- تطبیق کاتالوگ ردیف FREE_POST را از ورودی حذف می‌کند تا برداشت محصول، پست آزاد را WITHDRAWN نکند
- حسابرسی: actor، reason، destination، و بعد از ارسال ورکر `providerMessageId`. کپشن، توکن، و کلید در payload حسابرسی و لاگ ورکر نیست

## خارج از scope

آلبوم، زمان‌بندی آرشیو هفته، و دیپلوی.

## تست

`npx ts-node --transpile-only src/modules/omnichannel/free-post.spec.ts` از `apps/api`.

## Rollback

`OMNICHANNEL_FREE_POST_ENABLED` را برندارید یا هر چیزی غیر از `true` بگذارید. UI مخفی می‌شود و API رد می‌کند. پست‌هایی که قبلاً به تلگرام رفته‌اند سر جایشان می‌مانند. ریورت کد لازم نیست.
