# تنظیمات سیستم: تفکیک تکی/عمده و IA ادمین

تاریخ: ۲۰۲۶-۰۹-۰۸  
شاخه: `ai/TASK-20260908-004-admin-settings-ia`

## چه عوض شد

- روش‌های ارسال تکی و عمده کاملاً جدا شدند: کارمزد، شرکت‌های حمل، متن راهنما، و محاسبه پیشتاز.
- نوار روان هوم داخل تب «ظاهر و نوار روان» آمد.
- رویدادهای پیامک تکی/عمده داخل تب پیامک آمد.
- محاسبه بسته پستی پیشتاز داخل تب ارسال آمد.
- صفحه `/admin/settings` ناوبری ستونی، جستجو، و ذخیرهٔ همان تب را دارد.

## API

- `GET /shipping/methods?channel=RETAIL|WHOLESALE` — پیش‌فرض عمده
- `GET /shipping/quote?channel=` — کارمزد و پیشتاز همان کانال
- `shipping.retail.companies` / `shipping.wholesale.companies`
- `shippingPost` به شکل `{ retail, wholesale }`؛ JSON قدیمی هر دو را پر می‌کند

## اعتبارسنجی

- `shipping-channel.spec.ts`: OK
- `shipping-methods.spec.ts`: OK (tsx)
- `apps/api` tsc: 0
- `apps/web` tsc: 0
