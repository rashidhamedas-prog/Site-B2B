# اتصال Google Search Console و Google Analytics 4 / GTM

این راهنما برای **دو سایت جدا** است:

| سایت | دامنه | نقش |
|------|--------|-----|
| عمده | `https://poshaktaranom.com` | B2B |
| تکی | `https://www.poshaktaranom.ir` | B2C |

فریم‌ورک: **Next.js 15 (App Router)** — اسنیپت رسمی GTM در `apps/web/src/app/layout.tsx` (داخل `<head>` و اول `<body>`) قرار دارد. افزونه وردپرس (مثل GTM4WP) لازم نیست.

### GTM (فعال در سورس Next.js)
| کانال | دامنه Preview | Container | GA4 Measurement ID |
|------|----------------|-----------|---------------------|
| عمده | `https://poshaktaranom.com` | `GTM-M3LQFGZV` | `G-YVT5DXZF5Z` |
| تکی | `https://www.poshaktaranom.ir` | `GTM-NKBCGQJV` | `G-F2V7VSJMLE` |

در هر کانتینر یک تگ **Google Tag** با Measurement ID همان ردیف + Trigger **All Pages** (یا Initialization - All Pages) بسازید → **Submit / Publish** → **Preview** تا **Connected** و تگ **Fired** شود.

---

## پیش‌نیاز (از سمت سایت — آماده است)

- `robots.txt` هر دامنه به sitemap همان دامنه اشاره می‌کند  
  - عمده: `https://poshaktaranom.com/robots.txt` → `.../sitemap.xml`  
  - تکی: `https://www.poshaktaranom.ir/robots.txt` → `.../sitemap.xml`
- تگ تأیید Search Console از تنظیمات ادمین/محیط خوانده و در `<head>` گذاشته می‌شود
- اسکریپت GA4 (و در صورت نیاز GTM) روی هر کانال جدا لود می‌شود
- رویداد خرید تکی (`purchase`) برای GA4 روی صفحه تشکر ارسال می‌شود

---

## الف) Google Analytics 4 — ساخت و اتصال

### ۱) ساخت Property جدا برای هر دامنه
1. بروید به [Google Analytics](https://analytics.google.com/)
2. Admin → Create → Property
3. یک Property برای **عمده** بسازید (مثلاً «ترنم عمده»)
4. Data stream از نوع **Web** با URL: `https://poshaktaranom.com`
5. Measurement ID را کپی کنید — شکل: `G-XXXXXXXX`
6. همین کار را برای **تکی** تکرار کنید با URL: `https://www.poshaktaranom.ir` → یک `G-...` دیگر

> هرگز یک Measurement ID را روی هر دو دامنه نگذارید؛ گزارش‌ها قاطی می‌شود.

### ۲) وارد کردن ID در سایت
**روش پیشنهادی (ادمین):**
1. وارد `https://poshaktaranom.com/admin` شوید
2. تنظیمات → تب **پیکسل / افیلیت**
3. بخش **Google Analytics 4 + Search Console**
4. فیلدها:
   - `GA4 عمده (G-…)` → ID عمده
   - `GA4 تکی (G-…)` → ID تکی
5. ذخیره

**روش جایگزین (محیط سرور / Docker):** در `.env` وب:

```bash
NEXT_PUBLIC_GA4_WHOLESALE_ID=G-XXXXXXXX
NEXT_PUBLIC_GA4_RETAIL_ID=G-YYYYYYYY
# اختیاری:
NEXT_PUBLIC_GTM_WHOLESALE_ID=GTM-XXXXXXX
NEXT_PUBLIC_GTM_RETAIL_ID=GTM-YYYYYYY
```

بعد از تغییر env باید image وب rebuild شود.

### ۳) تست GA4
1. در GA4 → Reports → Realtime
2. سایت عمده را در مرورگر باز کنید (با VPN خارج از ایران اگر لازم بود)
3. ظرف چند ثانیه باید hit ببینید
4. همین کار را برای دامنه تکی با Property تکی تکرار کنید
5. در DevTools → Network فیلتر `google-analytics` یا `gtag/js?id=G-` را چک کنید

---

## ب) Google Search Console — تأیید و Sitemap

### ۱) افزودن Property برای هر دامنه
1. بروید به [Google Search Console](https://search.google.com/search-console)
2. **Add property** → نوع **URL prefix** (ساده‌تر برای شروع)
3. عمده: `https://poshaktaranom.com`
4. تکی: `https://www.poshaktaranom.ir`  
   (اگر apex `poshaktaranom.ir` را هم می‌خواهید، جداگانه اضافه کنید؛ سایت ما به `www` ریدایرکت می‌کند)

### ۲) تأیید با تگ HTML (روش سایت ما)
1. در GSC روش **HTML tag** را انتخاب کنید
2. چیزی شبیه این می‌دهد:

```html
<meta name="google-site-verification" content="TOKEN_HERE" />
```

3. فقط مقدار `TOKEN_HERE` را کپی کنید (نه کل تگ)
4. در ادمین → تنظیمات → Google:
   - `کد تأیید GSC عمده` → توکن عمده
   - `کد تأیید GSC تکی` → توکن تکی
5. ذخیره کنید، ۳۰–۶۰ ثانیه صبر کنید، در GSC روی **Verify** بزنید

**جایگزین env:**

```bash
NEXT_PUBLIC_GSC_WHOLESALE=TOKEN_WHOLESALE
NEXT_PUBLIC_GSC_RETAIL=TOKEN_RETAIL
```

(نیاز به rebuild وب)

### ۳) ارسال Sitemap
بعد از Verify موفق، در هر Property:

| Property | Sitemap |
|----------|---------|
| عمده | `https://poshaktaranom.com/sitemap.xml` |
| تکی | `https://www.poshaktaranom.ir/sitemap.xml` |

در GSC: Sitemaps → Enter URL → Submit

### ۴) تست سریع از ترمینال / مرورگر
```bash
curl -sI https://poshaktaranom.com/robots.txt
curl -sI https://www.poshaktaranom.ir/robots.txt
curl -s https://poshaktaranom.com/sitemap.xml | head
curl -s https://www.poshaktaranom.ir/sitemap.xml | head
# بعد از وارد کردن توکن:
curl -s https://poshaktaranom.com/ | grep -i google-site-verification
curl -s -H 'Host: www.poshaktaranom.ir' https://www.poshaktaranom.ir/ | grep -i google-site-verification
```

---

## ج) نکات مهم ایران / دسترسی

- ربات‌های گوگل معمولاً از خارج ایران سایت را می‌خوانند؛ SSL و DNS باید درست باشد
- برای دیدن Realtime GA4 از ایران، گاهی VPN لازم است
- دامنه `.ir` باید SSL معتبر داشته باشد و به همان سرور اشاره کند
- hreflang بین `.com` و `.ir` عمداً فعال نیست (دو کسب‌وکار جدا: عمده/تکی)

---

## د) چک‌لیست نهایی مالک

### عمده — poshaktaranom.com
- [ ] GA4 Property + Web stream ساخته شد
- [ ] `G-...` در ادمین (عمده) ذخیره شد
- [ ] Realtime hit دیدم
- [ ] GSC URL-prefix اضافه و با meta تأیید شد
- [ ] Sitemap عمده Submit شد

### تکی — www.poshaktaranom.ir
- [ ] GA4 Property جدا + Web stream ساخته شد
- [ ] `G-...` در ادمین (تکی) ذخیره شد
- [ ] Realtime hit دیدم
- [ ] GSC جدا تأیید شد
- [ ] Sitemap تکی Submit شد

---

## رفع اشکال سریع

| مشکل | کار |
|------|-----|
| Verify شکست می‌خورد | فقط content توکن را بگذارید؛ بعد از ذخیره Hard Refresh؛ چند دقیقه صبر |
| GA4 اسکریپت لود نمی‌شود | فرمت باید دقیقاً `G-` باشد؛ کش مرورگر / Adblock را خاموش کنید |
| Sitemap خالی از محصول تکی | محصول باید `showOnRetail` و قیمت تکی داشته باشد |
| دو دامنه یک آمار می‌دهند | اشتباه ID مشترک؛ برای هر کانال ID جدا بگذارید |
| بعد از env عوض کردن اثری نیست | `docker compose build web && up -d web` |

پشتیبانی فنی داخل پنل: ادمین → تنظیمات → پیکسل / افیلیت → بخش Google.
