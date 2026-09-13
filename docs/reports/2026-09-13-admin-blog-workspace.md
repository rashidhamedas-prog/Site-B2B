# گزارش تکمیل workspace وبلاگ ادمین

تاریخ: 2026-09-13  
تسک: TASK-20260913-009

## مسئله

`/admin/blog` هفت تب جدا با کانال مستقل داشت. رسانه، دسته، تنظیمات و آمار با جدول مقالات یکی نبودند. چند فرم (CTA، نویسنده، حذف سئویی، alt رسانه، ویرایش دسته/نویسنده) فیلد API موجود را نشان نمی‌دادند.

## تحقیق

Ghost Admin API، Payload drafts/locale، و Strapi draft/publish بررسی شد. هیچ‌کدام به عنوان محصول جایگزین نصب نشدند. الگوی قابل‌استفاده: یک سوییچ publication/locale در شل + URL به‌عنوان منبع حقیقت.

Slack: جست‌وجوی عمومی برای «وبلاگ ادمین» و «blog admin CMS» نتیجه‌ای نداشت.

## کار انجام‌شده

- `?channel=` + `?tab=` مشترک برای همه تب‌ها
- تکمیل taxonomy / authors / settings / redirects / comments / media / roles روی قرارداد موجود
- `primaryCta` و `authorId` در ذخیره مقاله
- حذف با strategy مستند API
- پیش‌نمایش با `lightSanitizeHtml`
- spec واحد برای parse/serialize و strip تنظیمات

## خارج از محدوده

- ویرایش `blog.controller.ts` / `blog.service.ts` (مالکیت TASK-20260826-001)
- اتصال زنده متریک GSC
- UI انتخاب کاربر برای blogRole
