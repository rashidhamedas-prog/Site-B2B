# گزارش — لاگین ادمین، سرچ، موجودی دسته، کاربران سیستم

تاریخ: 2026-08-31  
تسک: TASK-20260831-001

## علت‌ها

1. **لاگین ادمین:** `LoginDto` رقم فارسی را رد می‌کرد؛ میدلور فقط `role===ADMIN` را می‌پذیرفت؛ `/admin/login/` هم محافظت می‌شد.
2. **سرچ هوم:** آیکون عمده دکمه بدون handler بود؛ تکی فقط به `/products` می‌رفت؛ فیلد جستجو روی هوم نبود.
3. **ناموجود در دسته تکی:** `CategoryProductCard` فیلد `retailStock` را به `RetailProductCard` پاس نمی‌داد و واریانت هم لود نمی‌شد → موجودی ۰.
4. **کاربران سیستم:** `/admin/users` نقش جعلی `MANAGER` داشت، ریست رمز نداشت، خطای API را می‌بلعید، و گیت RBAC فقط باینری ADMIN بود.

## معماری کاربران (اجرا شده)

- هویت ورود به پنل: هر نقش `UserRole` (`ADMIN`, `SALES_MANAGER`, `SALES_REP`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CUSTOMER_SERVICE`).
- `CUSTOMER` مشتری است و در CRM می‌ماند. `STAFF` / `SUPER_ADMIN` به‌عنوان `users.role` ساخته نشد (`SUPER_ADMIN` فقط `blogRole` است).
- ماتریس ماژول در `staff-access.ts` (API و وب هم‌سان). سایدبار بر اساس نقش فیلتر می‌شود.
- `@Roles('ADMIN')` برای کارکنان سیستم هم باز است مگر `@AdminOnly()` — کاربران و تنظیمات فروشگاه فقط مدیر کل.
- سیاست جهش: آخرین `ADMIN` فعال را نمی‌توان غیرفعال/تنزل داد؛ خود-غیرفعال ممنوع.

## گیت‌ها (اجرا شده)

- `apps/api` `auth.otp.logic.spec.ts` / `staff-access.spec.ts` / `users.policy.spec.ts` OK
- `apps/api` `tsc --noEmit` exit 0
- `apps/web` `tsc --noEmit` exit 0
- `category-search-params.spec.ts` exit 0

## غیرهدف

- جدول audit جدا، مایگریشن DB، Meilisearch برای ویترین، تغییر `AdminSettings`.
