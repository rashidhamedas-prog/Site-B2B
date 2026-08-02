# راهنمای ادمین وبلاگ

## مسیر

`/admin/blog`

## کانال

با تب **عمده / تک** محتوا جدا می‌شود. هر مطلب فقط روی یک کانال است.

## نقش‌های وبلاگ (`blogRole`)

روی کاربران ADMIN تنظیم می‌شود (`PATCH /v1/blog/admin/users/:id/blog-role`):

| نقش | توانایی کلیدی |
|-----|----------------|
| SUPER_ADMIN | همه + حذف دائم + نقش‌ها |
| SEO_MANAGER | SEO، Redirect، تأیید انتشار |
| CONTENT_MANAGER | CRUD، دسته، تگ، انتشار |
| EDITOR | ویرایش محتوا |
| AUTHOR | Draft خودش + ارسال بازبینی |
| REVIEWER | تأیید / رد |
| VIEWER | فقط مشاهده |

بدون `blogRole`، ادمین فعلی ≡ SUPER_ADMIN.

## تب‌های ویرایشگر

محتوا · پایه · سئو · شبکه‌های اجتماعی · اسکیما/FAQ · انتشار · پیش‌نمایش

## Import

دکمه Import — JSON یا Markdown (نگاه کنید به `BLOG_IMPORT_FORMAT.md`).

## Seed دسته

دکمه «Seed دسته» دسته‌های پیشنهادی retail/wholesale را اگر خالی باشند می‌سازد.
