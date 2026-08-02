# گزارش تست ماژول وبلاگ

تاریخ: 2026-08-02

## واحدی

| تست | نتیجه |
|-----|--------|
| `blog-seo.util.spec.ts` (assert script) | پاس در فاز ۱ |
| `blog-seo-analysis.spec.ts` | پاس |

## Typecheck / Build

| هدف | نتیجه |
|-----|--------|
| `apps/api` nest build | پاس (فاز ۳/۴) |
| `apps/web` tsc --noEmit | پاس قبل از هر deploy |

## دود دستی / لایو

| مسیر | نتیجه مورد انتظار |
|------|-------------------|
| `GET /v1/health` | ۲۰۰ |
| `/blog` عمده و تک | ۲۰۰ |
| `/blog/search?q=` | ۲۰۰ + noindex |
| `/blog/category/:slug` | ۲۰۰ یا ۴۰۴ |
| `/blog/tag/:slug` | ۲۰۰ یا ۴۰۴ |
| ریدایرکت اسلاگ حذف‌شده | ۳۰۱ یا صفحه ۴۱۰ |
| `/admin/blog` تب آمار | خلاصه analytics |

## امنیت

- نظرات PENDING تا تأیید
- HTML sanitize در API
- Preview با token؛ robots disallow `/blog/preview`
- Draft ایندکس نمی‌شود

## محدودیت‌های شناخته‌شده

- uniqueViews تقریبی است (بدون fingerprint پایدار)
- متریک‌های واقعی GSC (CTR/position) هنوز از Google API خوانده نمی‌شوند؛ فقط verification + hook آماده است
- Jest در workspace API نصب نشده؛ تست‌ها به صورت assert-script اجرا می‌شوند
