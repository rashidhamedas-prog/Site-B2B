# امنیت محتوا و نظرات وبلاگ

## Sanitize HTML

محتوای HTML قبل از ذخیره با `sanitize-html` (allowlist) پاک می‌شود. تگ‌های خطرناک و `javascript:` حذف می‌شوند.

## نظرات

- وضعیت پیش‌فرض: `PENDING`
- Honeypot فیلد `website`
- Rate-limit ساده بر اساس hash IP
- فقط نظرات `APPROVED` در فرانت نمایش داده می‌شوند

## رسانه

ثبت متادیتا در `blog_media_assets`؛ حذف از ادمین فایل MinIO را هم پاک می‌کند.

## Analytics

رویدادهای view/scroll بدون PII شخصی ذخیره می‌شوند.
