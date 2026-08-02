# فاز ۲ ماژول وبلاگ — راهنما

## TipTap RTL

ویرایشگر ادمین از TipTap استفاده می‌کند (`BlogEditor.tsx`). محتوا به‌صورت HTML ذخیره و با `sanitize-html` پاک‌سازی می‌شود.

## SEO Score

`POST /v1/blog/admin/seo/analyze` یا دکمه «تحلیل سئو» در تب سئو. فقط پیشنهاد می‌دهد؛ انتشار را مسدود نمی‌کند.

## Revisions + Autosave

- Autosave هر ۳۰ ثانیه با optimistic lock (`version`)
- `GET /blog/admin/posts/:id/revisions`
- `POST /blog/admin/posts/:id/revisions/:revisionId/restore`

## Media Library

ثبت متادیتای رسانه پس از آپلود MinIO:

`POST /blog/admin/media/register`

فیلدها: alt، caption، hash تکراری، ابعاد، focal point.

## Scheduling

`@nestjs/schedule` هر دقیقه `publishDueScheduled` را اجرا می‌کند.

## Related products / articles

تب «مرتبط‌ها» در ادمین + پیشنهاد خودکار مقالات.

## Authors

`/blog/author/{slug}` روی عمده و تک + Person Schema.

## Comments

`POST /blog/article/:id/comments` با honeypot و rate-limit ساده؛ پیش‌فرض PENDING.

## Analytics

`POST /blog/article/:id/analytics/{event}` برای view/scroll/cta.

## HowTo Schema

فیلد `howToData` روی مقاله + `howToSchemaEnabled`.
