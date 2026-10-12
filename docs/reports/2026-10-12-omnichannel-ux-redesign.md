# بازطراحی UX کانال‌های انتشار (فاز A→E) — 2026-10-12

## هدف

کنسول `/admin/omnichannel` برای اپراتور غیرفنی: اخطارهای مبهم (ناموفق / متوقف / canary) به تشخیص + دکمه تبدیل شوند؛ واژگان فارسی؛ تفکیک نویز صف غیرکانال.

## تغییرات

### UI ([`AdminOmnichannel.tsx`](../../apps/web/src/components/admin/AdminOmnichannel.tsx), [`admin-omnichannel-ui.tsx`](../../apps/web/src/components/admin/admin-omnichannel-ui.tsx))

- **AttentionStrip**: حداکثر ۳ تشخیص با CTA (مقصد آزمایشی، ارسال ناموفق، صف متوقف، gate block)
- تب‌ها: وضعیت و اقدام · انتشار · تنظیمات · صف و حسابرسی
- بعد از تکمیل راه‌اندازی: تب پیش‌فرض انتشار؛ stepper جمع‌شونده
- متریک «پست امروز» دیگر شمار شکست را قاطی نمی‌کند
- متریک صف پیش‌فرض روی DEAD کانال‌محور
- فیلتر انتشارها: همه / ناموفق؛ صف: فقط کانال / همه
- `cancelled_by_admin` / `publication_withdrawn` → badge «عمدی»
- واژگان: مقصد آزمایشی، ارسال از سرور (بدون canary/connector انگلیسی در سطح اول)

### API

- [`gate-block-reason.ts`](../../apps/api/src/modules/omnichannel/gate-block-reason.ts): `resolveGateBlockReason`, `summarizeDeadByEventType`
- `GET /omnichannel/status` اضافه کرد: `sentToday` (روز تهران), `gateBlockReason`, `outboxDeadByEventType`

## محدودیت‌های حفظ‌شده

بدون DELETE روی outbox · vault/secretRef · بدون روشن‌کردن کانکتور · مونولیت adapters

## تست

- `gate-block-reason.spec.ts`
- assertهای تازه در `omnichannel-phase-acceptance.spec.ts`
