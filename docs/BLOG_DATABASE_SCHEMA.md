# اسکیمای دیتابیس وبلاگ

| جدول | نقش |
|------|-----|
| `blog_posts` | مقالات + SEO + HowTo + related IDs + version |
| `blog_categories` | دسته per-channel |
| `blog_tags` | برچسب per-channel |
| `blog_authors` | پروفایل نویسنده |
| `blog_settings` | تنظیمات وبلاگ per-channel |
| `seo_redirects` | ۳۰۱/۳۰۲/۴۱۰ |
| `seo_audit_logs` | لاگ اعمال |
| `blog_media_assets` | متادیتای رسانه |
| `blog_article_revisions` | تاریخچه نسخه |
| `blog_comments` | نظرات |
| `blog_analytics` | آمار داخلی مقاله |

## قیود مهم

- `UNIQUE(blog_posts.channel, blog_posts.slug)`
- `UNIQUE(blog_categories.channel, slug)`
- `UNIQUE(blog_tags.channel, slug)`
- `UNIQUE(seo_redirects.channel, sourcePath)`
- `UNIQUE(blog_analytics.articleId)`
- soft delete روی posts / categories / tags / authors

## فیلدهای کلیدی `blog_posts`

`status`, `contentFormat`, `seoTitle`, `seoDescription`, `focusKeyword`, `faqItems`, `primaryCta`, `relatedProductIds`, `relatedArticleIds`, `howToData`, `version`, `tableOfContentsEnabled`, `commentsEnabled`, `robotsIndex`, `canonicalType`, `publishAt`, `publishedAt`
