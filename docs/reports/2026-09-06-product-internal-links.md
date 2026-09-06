# 2026-09-06 — لینک داخلی سئو هر محصول (جدا برای تکی و عمده)

## خلاصه

گزینه «لینک داخل» به پنل مدیریت محصولات (ایجاد/ویرایش) اضافه شد. هر محصول می‌تواند تا ۱۲ لینک داخلی سئو **به‌ازای هر کانال** داشته باشد — کاملاً جدا برای سایت تکی (.ir) و سایت عمده (.com) — و این لینک‌ها روی صفحه جزئیات محصول (PDP) همان کانال رندر می‌شوند همراه با `ItemList` JSON-LD.

## معماری

- **جدول اختصاصی `product_internal_link`** (نه JSONB): ستون `channel` هر ردیف را به `RETAIL` یا `WHOLESALE` اسکوپ می‌کند. FK به `products` با `ON DELETE CASCADE`. `targetId` یک soft-reference (UUID) است که می‌تواند به محصول/دسته/بلاگ اشاره کند یا برای URL دلخواه `NULL` باشد.
- **جداسازی کانال در سه لایه**:
  1. ذخیره: هر ردیف یک `channel` دارد؛ سقف ۱۲ لینک per channel.
  2. اعتبارسنجی هنگام ذخیره: لینک تکی نمی‌تواند به محصولی که `showOnRetail=false` است اشاره کند (و برعکس)؛ هدف باید `ACTIVE`/`PUBLISHED` و در صورت بلاگ `robotsIndex=true` باشد.
  3. خواندن: مسیر عمومی فقط لینک‌های کانال درخواست‌شده را برمی‌گرداند (میدان `internalLinks`)؛ مسیر ادمین هر دو کانال را (`retailInternalLinks`/`wholesaleInternalLinks`).
- **منطق خالص در `internal-link-resolver.ts`**: ساخت URL از slug، نرمالایز rel، اعتبارسنجی لیست (تعداد، طول انکر ۱–۶۰، تکرار، self-link، CUSTOM باید داخلی باشد). بررسی‌های وابسته به DB (وجود هدف، visibility کانال، noindex) در سرویس.
- **UI**: پنل دوگانه در `AdminProducts` (عمده = primary، تکی = amber) الگوی پنل سئوی دوگانه را پیروی می‌کند. picker با `ProductRelatedPicker` هم‌الگو است: تب نوع هدف، جستجوی debounced، پیشنهاد انکر از focus keyword، مرتب‌سازی، حذف، دکمه «بررسی اعتبار».

## فایل‌ها

### Backend (apps/api)
- `src/database/migrations/20260906-001-product-internal-links.ts` — جدول + ۴ ایندکس (شامل دو unique index برای جلوگیری از تکرار هدف).
- `src/modules/product/entities/product-internal-link.entity.ts` — موجودیت TypeORM.
- `src/modules/product/dto/internal-link.dto.ts` — `InternalLinkItemDto` + `InternalLinkView`.
- `src/modules/product/dto/create-product.dto.ts` — فیلدهای `retailInternalLinks`/`wholesaleInternalLinks`.
- `src/modules/product/internal-link-resolver.ts` — منطق خالص.
- `src/modules/product/internal-link-resolver.spec.ts` — ۱۲ چک واحد.
- `src/modules/product/product.service.ts` — `replaceInternalLinks`/`resolveAndValidateLinks`/`loadInternalLinkViews`/`attachInternalLinks`/`suggestInternalLinks`/`validateInternalLinks` + هک در create/update/findOne/findBySlug.
- `src/modules/product/product.controller.ts` — `POST admin/internal-links/suggest` و `/validate` (JWT + ADMIN).
- `src/modules/product/product.module.ts` — ثبت موجودیت.

### Frontend (apps/web)
- `src/components/admin/ProductInternalLinkPicker.tsx` — picker اصلی.
- `src/components/admin/ProductInternalLinkRow.tsx` — ویرایشگر ردیف.
- `src/components/admin/AdminProducts.tsx` — state، هیدریشن، ذخیره، پنل دوگانه.
- `src/lib/hooks/useProducts.ts` — تایپ‌های `InternalLinkView`/`InternalLinkInput`/`InternalLinkSuggestion` + فیلدهای Product.
- `src/components/shared/ProductInternalLinks.tsx` — رندر PDP + ItemList JSON-LD (سرور-کامپوننت، بدون JS کلاینت).
- `src/app/retail/products/[slug]/page.tsx` — رندر retail.
- `src/app/(wholesale)/products/[slug]/page.tsx` — رندر wholesale.

## اعتبارسنجی

- `apps/api` `tsc --noEmit`: PASS
- `apps/web` `tsc --noEmit`: PASS
- `internal-link-resolver.spec.ts` (۱۲ چک): PASS — buildInternalLinkUrl, normalizeRel, normalizeInternalLinkInput, isInternalUrl/toRelativePath, dedupKey, validateInternalLinkList (good/duplicate/self-link/external-custom/internal-custom/too-many/anchor-length).
- `public-product-channel.spec.ts`, `product-content.spec.ts`, `product-related-fill.spec.ts`: PASS (بدون رگرسیون).
- مایگریشن: additive (`CREATE TABLE IF NOT EXISTS`، بدون backfill)، قابل بازگشت (`down` همه ایندکس‌ها و جدول را drop می‌کند).

## امنیت

- هر دو endpoint ادمین با `AuthGuard('jwt')` + `RolesGuard` + `@Roles('ADMIN')` محافظت می‌شوند.
- بدون secret جدید؛ بدون وابستگی جدید.
- جلوگیری از نشت کانال: validate-on-save + filter-on-render.
- جلوگیری از self-link و loop و external URL در CUSTOM.

## ریسک و بازگشت

- ریسک: medium (ماژایل product + مایگریشن جدید). مایگریشن additive و idempotent است.
- بازگشت: `typeorm migration:revert` جدول را drop می‌کند؛ کد به‌سادگی فیلدهای خالی را handle می‌کند (پنل اگر جدول نباشد فقط ذخیره نمی‌کند ولی فرم باز می‌ماند).

## ملاحظات/پیگیری

- `internal-link-resolver.spec.ts` هنوز به `npm run test` در `apps/api/package.json` وصل نشده چون آن فایل توسط `TASK-20260905-003` claim شده (append-only test script). اتصال پس از آزاد شدن آن claim به‌عنوان پیگیری ثبت شد.
- `apps/web/src/app/retail/products/[slug]/page.tsx` قبلاً توسط `TASK-20260905-004` (done) claim شده بود؛ ویرایش من additive (import + یک رندر) است.
- WIP مربوط به `TASK-20260905-003` پیش از branch در `stash@{0}` نگه داشته شد.
