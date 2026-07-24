# گزارش جلسه — تکمیل تک‌فروشی ترنم

**تاریخ:** 2026-07-24  
**موضوع:** مسیر پول، موجودی variant، PLP/PDP، حساب، RMA ادمین، فید و پیکسل

## انجام‌شده
1. سفارش تکی ONLINE → `PaymentService.start` → `paymentUrl`
2. چک‌اوت: آدرس، quote ارسال، کیف‌پول، `affiliateId` از `?aff=`
3. کسر/بازگردانی موجودی در سطح variant (+ sync محصول؛ کنسلی و RMA)
4. Collection + فیلدهای pre-order / modelInfo / videoUrl
5. PLP فیلتر + بارگذاری بیشتر؛ PDP زوم/ویدیو/جدول سایز/کراس‌سل؛ مگامنو
6. ادمین `/admin/rma`؛ تنظیمات marketing پیکسل؛ فید بدون old_price جعلی

## تست دستی پیشنهادی
- PLP → PDP → سبد → OTP → چک‌اوت COD/ONLINE → حساب → RMA → تأیید ادمین
