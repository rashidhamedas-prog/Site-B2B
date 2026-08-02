# معماری ماژول وبلاگ و SEO چندسایته

## خلاصه

ماژول وبلاگ روی Nest `BlogModule` موجود گسترش یافته (نه سیستم موازی). دو کانال:

| Channel | دامنه | مسیر عمومی |
|---------|-------|------------|
| `WHOLESALE` | poshaktaranom.com | `/blog`, `/blog/{slug}`, `/blog/feed.xml` |
| `RETAIL` | poshaktaranom.ir | همان URLها با rewrite به `app/retail/blog/**` |

## لایه‌ها

- **DB:** TypeORM — `blog_posts` (+ فیلدهای SEO)، `blog_categories`, `blog_tags`, `blog_authors`, `blog_settings`, `seo_redirects`, `seo_audit_logs`
- **API:** Nest `/v1/blog/*` — public + admin با `JwtAuthGuard` + `RolesGuard(ADMIN)` + `BlogPermissionsGuard`
- **RBAC:** ستون `users.blogRole`؛ ADMIN بدون blogRole ≡ `SUPER_ADMIN`
- **Web:** Next App Router — ادمین `/admin/blog`، ویترین عمده و تک، sitemap/robots/RSS

## Unique slug

`UNIQUE(channel, slug)` — یک اسلاگ می‌تواند در هر کانال جداگانه باشد.

## انتشار

وضعیت‌ها: DRAFT → IN_REVIEW → NEEDS_REVISION|APPROVED → SCHEDULED|PUBLISHED → UNPUBLISHED|ARCHIVED

تغییر slug مقالهٔ PUBLISHED ⇒ ریدایرکت ۳۰۱ در `seo_redirects`.

## فاز ۲ (انجام‌شده)

TipTap، Media Library، Version History، SEO Score، Internal Links، Comments، Analytics hooks، HowTo، Authors.

## فاز ۳ (انجام‌شده)

Redirect Manager UI + اعمال ۳۰۱/۴۱۰ در صفحه مقاله، تنظیمات وبلاگ، Export، check-links، moderation نظرات، نویسندگان، دسته/جستجو عمومی، TOC، preview noindex، مستندات تکمیلی.
