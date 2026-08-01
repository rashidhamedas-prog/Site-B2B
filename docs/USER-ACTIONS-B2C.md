# کارهای شما (Owner checklist) — فروشگاه تکی ترنم

این‌ها را فقط شما می‌توانید انجام دهید؛ کد از سمت Agent آماده است.

## ۱) داده و قیمت
- [ ] در پنل ادمین برای هر محصول **قیمت خرده‌فروشی (`retailPrice`)** را پر کنید  
  بدون این فیلد، در فروشگاه «قیمت به‌زودی» دیده می‌شود و فید تورب/بام خالی می‌ماند.

## ۱-ب) اینماد (نماد اعتماد)
- [ ] ادمین → تنظیمات → کسب‌وکار → بخش «نماد اعتماد الکترونیکی»
- [ ] برای **عمده** (`poshaktaranom.com`) و **تکی** (`www.poshaktaranom.ir`) جداگانه:
  - کد HTML از پنل اینماد را بچسبانید، **یا**
  - شناسه (`id`) + کد (`Code`) را وارد کنید و در صورت نیاز تصویر نشان را آپلود کنید
  - «نمایش در فوتر» را روشن کنید و ذخیره کنید
- [ ] در فوتر هر دو سایت، نشان اینماد باید دیده شود و با کلیک به trustseal.enamad.ir برود

## ۲) دامنه www.poshaktaranom.ir
- [ ] DNS دامنه `.ir` را به سرور فعلی (همان Hetzner عمده) اشاره دهید  
- [ ] SSL با certbot برای `poshaktaranom.ir` و `www.poshaktaranom.ir`  
- [ ] بلاک nginx کامنت‌شده در `nginx/nginx.conf` را فعال کنید  
- [ ] اگر الان `.ir` روی webzi است، هاستینگ قبلی را قطع کنید تا تداخل نباشد

## ۳) پیامک OTP
- [ ] در تنظیمات ادمین: API Key سرویس sms.ir + قالب OTP  
- [ ] بدون این، ورود تکی کار می‌کند ولی کد را در حالت توسعه روی صفحه نشان می‌دهد

## ۴) درگاه پرداخت
- [ ] زرین‌پال **عمده** را در ادمین → تنظیمات → درگاه پرداخت → بخش «عمده» وارد کنید  
- [ ] زرین‌پال **تکی** را در همان صفحه، بخش «فروشگاه تکی» → مرچنت کد / توکن تکی وارد کنید  
- [ ] در پنل زرین‌پال دامنه `www.poshaktaranom.ir` و Callback تکی را تأیید کنید  
- [ ] Sandbox تکی را برای تست روشن/خاموش کنید؛ برای فروش واقعی خاموش باشد

## ۵) مارکت‌پلیس و افیلیت (اتصال از سمت سایت آماده است)

### Google Search Console + Google Analytics 4
- [ ] راهنمای کامل گام‌به‌گام: [`docs/GOOGLE-SETUP.md`](./GOOGLE-SETUP.md)
- [ ] برای **عمده** و **تکی** دو Property جدا در GA4 بسازید و `G-...` را در ادمین → تنظیمات → Google وارد کنید
- [ ] برای هر دامنه Search Console را با HTML tag تأیید کنید و sitemap همان دامنه را Submit کنید  
  - عمده: `https://poshaktaranom.com/sitemap.xml`  
  - تکی: `https://www.poshaktaranom.ir/sitemap.xml`

### تورب — https://torob.com | پنل: https://panel.torob.com

**دو آدرس جدا — با هم اشتباه نگیرید:**

1) **فید محصولات (XML)** — برای ثبت کاتالوگ / محصولات:  
   `https://www.poshaktaranom.ir/api/v1/feeds/torob.xml`

2) **API همگام‌سازی سفارش (JSON)** — برای صفحه «تنظیمات همگام سازی اطلاعات سفارش‌ها» با روش «API اختصاصی»:  
   `https://www.poshaktaranom.ir/api/torob/v1/orders`  
   - مسیر باید دقیقاً به `/torob/v1/orders` ختم شود  
   - پاسخ `application/json` است (نه XML)  
   - در ادمین → تنظیمات → Google/پیکسل: «فعال‌سازی همگام‌سازی سفارش ترب» را روشن کنید  
   - مستند رسمی: https://github.com/Torob/Torob-Sync/blob/main/order_tracking_api.md

- [ ] فید XML را در بخش محصولات/فید پنل ترب ثبت کنید  
- [ ] آدرس JSON سفارش را در همگام‌سازی سفارش بگذارید (نه فید XML)  
- [ ] همگام‌سازی سفارش را از تنظیمات ادمین فعال کنید  
- [ ] آدرس فروشگاه در پنل ترب: `https://www.poshaktaranom.ir`

### بام — https://bam.ir | پنل: https://business.bam.ir
- [ ] فید CSV: `https://api.poshaktaranom.com/v1/feeds/bam.csv`  
- [ ] یا XML: `https://api.poshaktaranom.com/v1/feeds/bam.xml`  
- [ ] فهرست همه فیدها: `GET /v1/feeds`

### یکتانت — https://yektanet.com | تبلیغ‌دهنده: https://yektanet.com/advertisers
- [ ] ثبت‌نام تبلیغ‌دهنده + کمپین همکاری در فروش  
- [ ] **Pixel ID** را در ادمین → تنظیمات → پیکسل/افیلیت وارد کنید  
- [ ] در صورت دریافت اسکریپت محصول از پشتیبانی یکتانت، همان ID کافی است؛ خرید با `yektanet('product','purchase',…)` روی صفحه تشکر فای می‌شود  
- [ ] Postback URL (اگر پنل داد) را در فیلد Yektanet Postback ذخیره کنید

### Affer — https://affer.com | ثبت‌نام: https://affer.com/advertiser
- [ ] URL اسکریپت/پیکسل را در `Affer Script URL` بگذارید  
- [ ] Postback را با پلیس‌هولدر `{click_id}` / `{order_number}` / `{amount_toman}` تنظیم کنید  
- [ ] لینک‌های ورودی: `?affer=CLICK_ID` یا `?src=affer&aff=CLICK_ID`

### افسون — https://afsona.com
- [ ] پس از ثبت‌نام بازرگان، پیکسل/کالبک را از داشبورد بردارید و در تنظیمات وارد کنید  
- [ ] ورودی: `?afsona=CLICK_ID`

### آدرو — https://adro.co | https://adro.co/advertisers
- [ ] کد ریتارگتینگ را از پنل کپی کنید → فیلد **Adro Script URL** (در `<head>` همه صفحات تکی تزریق می‌شود)  
- [ ] در صورت داشتن Account ID، فیلد جداگانه را هم پر کنید

### باسلام — https://basalam.com | مستندات: https://doc.basalam.com
- [ ] در https://developers.basalam.com کلاینت بسازید و Access Token بگیرید  
- [ ] Vendor ID + Token را در تنظیمات مارکتینگ ذخیره و «فعال‌سازی همگام‌سازی» را روشن کنید  
- [ ] محصولات را در غرفه بسازید؛ نگاشت `localId → basalamId` را در `basalamProductMap` (API) بگذارید  
- [ ] همگام موجودی/قیمت: `POST /v1/basalam/sync-inventory` (ادمین)  
- [ ] خروجی کمکی کاتالوگ: `GET /v1/basalam/catalog-export`

### تخفیفان — https://takhfifan.com | بازرگانی: https://business.takhfifan.com
- [ ] با واحد بازرگانی هماهنگ کنید و لینک‌های شاخص + کد رهگیری بگیرید  
- [ ] Script URL و Postback را در تنظیمات ذخیره کنید  
- [ ] ورودی: `?takhfifan=` یا `?tf=`

## ۶) تست نهایی روی production
- [ ] خرید آزمایشی تکی روی یک SKU با `?aff=test`  
- [ ] همزمان یک سفارش عمده روی همان کالا → موجودی مشترک درست کم شود  
- [ ] در ادمین سفارش‌ها فیلتر «تکی» را چک کنید  
- [ ] پس از پرداخت موفق، پست‌بک در لاگ API دیده شود

## پیش‌نمایش همین الان (لوکال)
- اپ واقعی (هم‌تراز موکاپ): `http://localhost:3000/retail`
- موکاپ مرجع: `apps/web/public/retail/mockup-reference.png`
- راهنمای خروج از Webzi: `docs/MIGRATE-FROM-WEBZI.md`
