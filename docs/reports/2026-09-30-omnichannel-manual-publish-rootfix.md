# کانال‌های انتشار — اصلاح ریشه‌ای ارسال دستی

تاریخ: 2026-09-30  
تسک: TASK-20260930-002

## مشکل‌های تأییدشده

1. **ارسال دستی به `OMNICHANNEL_AUTO_PUBLISH` قفل بود.**  
   `createPublication(dryRun=false)` فقط وقتی هر دو پرچم CONNECTORS و AUTO_PUBLISH روشن بودند صف می‌ساخت. نتیجه: ردیف READY بدون delivery، در حالی که UI می‌گفت «به صف ارسال رفت».

2. **هر ارسال یک ردیف publication جدید می‌ساخت.**  
   پست‌های تکراری در پیام‌رسان، badgeهای چندوضعیتی در ادمین محصول، و withdraw ناقص.

3. **`liveRemoteMessages` با کلید `publicationId:destinationId`.**  
   دو انتشار برای یک محصول = دو پیام زنده روی یک کانال؛ UPDATE/DELETE اشتباه هدف می‌گرفت.

4. **دکمه «پیام آزمایشی» canary کانال فروش را چک می‌کرد نه canary همان ربات.**  
   با API (`selectCanaryDestinations` روی همان connection) هم‌خوان نبود.

## اصلاح معماری

| لایه | تغییر |
|------|--------|
| Pure | `canEnqueueManualDelivery`, `foldLiveRemoteMessages`, `planManualDeliveries`, `latestPublicationsBySource` |
| Service | ارسال دستی فقط CONNECTORS؛ upsert ردیف زنده؛ CREATE یا UPDATE؛ withdraw همه پیام‌های زنده source×channel؛ listPublications بدون duplicate |
| UI | چک‌لیست جدا برای کانکتور / انتشار خودکار؛ غیرفعال‌کردن ارسال وقتی کانکتور خاموش؛ canary per-connection |

`OMNICHANNEL_AUTO_PUBLISH` همچنان فقط automation کاتالوگ را کنترل می‌کند.

## تست مشاهده‌شده

- `publication-automation.spec.ts` ok  
- `canary-ping.spec.ts` ok  
- `apps/api` `tsc --noEmit` 0  
- `apps/web` `tsc --noEmit` 0  

## باقیمانده (خارج از این تسک)

- `retrySla` / `outboxRetention` در UI ذخیره می‌شوند ولی worker هنوز از آن‌ها استفاده نمی‌کند (§9).  
- اتوماسیون فقط PRODUCT را به پیام‌رسان می‌فرستد؛ ارسال دستی blog/CMS عمداً دستی می‌ماند.  
- پیش‌نمایش قالب در کلاینت آینهٔ سرور است (ریسک drift).  
