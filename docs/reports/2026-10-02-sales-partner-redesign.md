# 2026-10-02 — بازطراحی همکار بازاریاب (ادمین + پنل + فرم قابل‌پیکربندی)

Task: `TASK-20261002-002`  
Branch: `ai/TASK-20261002-002-sales-partner-redesign`

## خلاصه

- تب درخواست‌ها: دکمه «مشاهده جزئیات» + drawer کامل قبل از تأیید/رد
- تنظیمات ادمین: فرم‌بیلدر (روشن/خاموش، الزامی، برچسب، ترتیب، فیلد سفارشی)
- فرم عمومی ثبت‌نام: رندر پویا از `applyFormFields`
- پنل همکار: تعریف/تغییر رمز در `/sales-partners/profile` با JWT سالم `sales_partner`

## امنیت

- موبایل و کدملی در لیست ماسک؛ جزئیات فقط ادمین
- رمز فقط hash؛ endpoint اختصاصی همکار (نه `/auth/me/password` که `salesPartnerId` را از JWT حذف می‌کرد)
- Migration expand-only برای `answers` / `applicationAnswers`

## تست

- `sales-partner-apply-form.spec.ts` OK
- `sales-partner-settings.spec.ts` OK
- `tsc` api/web بدون خطای جدید در فایل‌های تغییر یافته

## فایل‌های اصلی

- `apps/api/src/modules/sales-partner/sales-partner-apply-form.ts`
- `apps/api/src/database/migrations/20261002-001-sales-partner-apply-answers.ts`
- `apps/web/src/components/admin/sales-partners/SpApplicationDetailDrawer.tsx`
- `apps/web/src/components/admin/sales-partners/SpApplyFormBuilder.tsx`
- `apps/web/src/components/sales-partners/SalesPartnershipApply.tsx`
- `apps/web/src/app/sales-partners/profile/page.tsx`
