# مستندات API وبلاگ

Base: `/v1/blog`

## عمومی

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/posts?channel=&page=&limit=&category=&search=&tag=` | لیست منتشرشده |
| GET | `/posts/:slug?channel=` | جزئیات مقاله |
| GET | `/posts/:slug/seo?channel=` | بسته SEO/JSON-LD |
| GET | `/categories?channel=` | دسته‌ها |
| GET | `/categories/:slug?channel=` | دسته + مقالات |
| GET | `/tags?channel=` | برچسب‌ها |
| GET | `/tags/:slug?channel=` | برچسب + مقالات |
| GET | `/search?q=&channel=` | جست‌وجو |
| GET | `/authors/:slug` | نویسنده + مقالات |
| GET | `/feed?channel=` | RSS data |
| GET | `/sitemap-posts?channel=` | اقلام sitemap |
| GET | `/redirects/match?channel=&path=` | تطبیق ریدایرکت |
| GET | `/article/:id/comments` | نظرات تأییدشده |
| POST | `/article/:id/comments` | ثبت نظر (honeypot: website) |
| POST | `/article/:id/analytics/:event` | view/scroll*/cta/product/internal |
| GET | `/article/:id/related-products` | محصولات مرتبط |

## ادمین (JWT + ADMIN + BlogPermissions)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PUT/DELETE | `/admin/posts…` | read/create/edit/delete |
| POST | `/admin/posts/:id/:action` | publish/approve/… |
| POST | `/admin/import` | import |
| GET | `/admin/posts/:id/export` | export |
| POST | `/admin/check-links` | manage_seo |
| CRUD | `/admin/categories`, `/admin/tags` | manage_* |
| CRUD | `/admin/redirects` | manage_redirects |
| GET/PUT | `/admin/settings?channel=` | manage_settings |
| CRUD | `/admin/authors` | edit/settings |
| GET | `/admin/comments/pending` | approve |
| PATCH | `/admin/comments/:id` | approve |
| GET | `/admin/analytics/summary?channel=` | audit |
| GET | `/admin/posts/:id/analytics` | audit |
| POST | `/admin/seo/analyze` | manage_seo |
| revisions / autosave / media / orphans / products/search | … | مطابق فاز ۲ |

## کانال

`WHOLESALE` | `RETAIL` — داده دو سایت مخلوط نمی‌شود.
