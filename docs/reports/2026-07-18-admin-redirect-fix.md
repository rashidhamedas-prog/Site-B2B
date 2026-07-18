# گزارش: `/admin` داشبورد مشتری را باز می‌کرد

## مشکل
با مراجعه به `https://www.poshaktaranom.com/admin` به‌جای پنل ادمین، داشبورد مشتری (`/portal/dashboard`) نمایش داده می‌شد.

## ریشه علت
در `apps/web/src/middleware.ts` اگر کوکی `taranom_token` وجود داشت ولی `taranom_role` برابر `ADMIN` نبود، کاربر به `/portal/dashboard` ریدایرکت می‌شد.

این حالت وقتی رخ می‌دهد که کاربر قبلاً به‌عنوان مشتری لاگین کرده باشد (کوکی نقش `CUSTOMER`).

تأیید روی پروداکشن:

| کوکی | نتیجه `/admin` |
|------|----------------|
| بدون کوکی | `/admin/login` (صحیح) |
| `taranom_role=CUSTOMER` | `/portal/dashboard` (باگ) |

## اصلاح
1. **middleware:** کاربر غیر‌ادمین روی مسیرهای `/admin/*` → `/admin/login` (نه پورتال)
2. **useAuth:** اگر لاگین از صفحه ادمین باشد و نقش `ADMIN` نباشد، پیام خطا نشان داده شود و به پورتال نرود؛ پارامتر `redirect` فقط وقتی با نقش هم‌خوان است اعمال شود

## Deploy
پس از merge به `master` و deploy وب، رفتار جدید فعال می‌شود.
