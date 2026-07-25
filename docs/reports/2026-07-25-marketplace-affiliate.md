# گزارش جلسه — اتصال مارکت‌پلیس و افیلیت B2C

**تاریخ:** 2026-07-25

## هدف
آماده‌سازی سمت سایت برای اتصال فروشگاه تکی به تورب، بام، یکتانت، Affer، افسون، آدرو، باسلام و تخفیفان طبق قوانین اعلام‌شده هر پلتفرم.

## اقدامات سمت کد
| پلتفرم | کار انجام‌شده در سایت |
|--------|------------------------|
| Torob | فید XML با قیمت/موجودی/لینک/تصویر/توضیح/گارانتی |
| Bam | فید CSV + XML |
| Yektanet | Pixel ID + purchase event + postback template |
| Affer / Afsona / Takhfifan | Script URL در head + postback + query capture |
| Adro | Script URL در head همه صفحات تکی |
| Basalam | تنظیمات توکن/vendor + sync-inventory + catalog-export |

## کارهای Owner (خارج از کد)
ثبت‌نام در پنل‌های خارجی، چسباندن URL فید/پیکسل/پست‌بک در تنظیمات ادمین، و برای باسلام نگاشت شناسه محصولات — جزئیات در `docs/USER-ACTIONS-B2C.md`.
