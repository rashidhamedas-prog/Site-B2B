# انتقال کامل دامنه از Webzi به سرور ترنم

هدف: `poshaktaranom.ir` و `www.poshaktaranom.ir` دیگر روی Webzi نباشند و مستقیم به سرور فعلی عمده (`5.75.200.102`) بروند.

---

## خلاصه مسیر (پیشنهادی: Cloudflare)

```text
nic.ir (NS) → Cloudflare DNS → A رکورد → 5.75.200.102 (Hetzner)
                                      ↓
                              nginx + SSL روی سرور
                                      ↓
                              سایت تکی /retail
```

Webzi فقط هاست/DNS قبلی بود؛ بعد از این کار دیگر لازم نیست.

---

## مرحله ۱ — Cloudflare (رایگان)

1. برو [cloudflare.com](https://dash.cloudflare.com) و حساب بساز/وارد شو  
2. **Add a site** → دامنه: `poshaktaranom.ir`  
3. پلن **Free** را انتخاب کن  
4. Cloudflare دو Nameserver می‌دهد، مثلاً:
   - `xxxx.ns.cloudflare.com`
   - `yyyy.ns.cloudflare.com`  
   این دو را یادداشت کن.

5. در Cloudflare → **DNS** این رکوردها را بساز:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `5.75.200.102` | DNS only (خاکستری) اول |
| A | `www` | `5.75.200.102` | DNS only (خاکستری) اول |

> اول Proxy را خاموش بگذار تا SSL روی خود سرور راحت صادر شود. بعداً می‌توانی نارنجی کنی.

---

## مرحله ۲ — nic.ir (همان صفحه‌ای که باز کردی)

در **تنظیمات سامانهٔ نام دامنه (DNS)**:

1. همهٔ NSهای Webzi را پاک کن (`ns1.webzidns.ir` و بقیه)  
2. فقط دو NS کلودفلر را بگذار:

| شماره NS | نام کارگزار | آی‌پی کارگزار |
|----------|-------------|---------------|
| 1 | `xxxx.ns.cloudflare.com` | **خالی** |
| 2 | `yyyy.ns.cloudflare.com` | **خالی** |

3. ذخیره کن  

آی‌پی کارگزار را پر نکن (همان هشدار زرد nic).

انتشار NS معمولاً چند ساعت تا ۲۴ ساعت طول می‌کشد.

---

## مرحله ۳ — روی سرور (بعد از سبز شدن DNS)

وقتی `ping poshaktaranom.ir` یا چک آنلاین DNS به `5.75.200.102` رسید:

```bash
ssh -i ~/.ssh/wholesale_server -p 2222 wholesale-admin@5.75.200.102

# صدور گواهی SSL
sudo certbot certonly --webroot -w /var/www/certbot \
  -d poshaktaranom.ir -d www.poshaktaranom.ir

# گواهی معمولاً اینجا می‌نشیند:
# /etc/letsencrypt/live/poshaktaranom.ir/
# یا کپی به مسیر nginx پروژه در صورت نیاز
```

سپس بلاک nginx برای `.ir` را فعال کن (در `nginx/nginx.conf` آماده است) و:

```bash
cd /opt/taranom
docker compose up -d --build nginx web
```

---

## مرحله ۴ — قطع کامل از Webzi

1. در پنل Webzi دامنه/هاست `.ir` را حذف یا تعلیق کن (دیگر ترافیک نیاید)  
2. ایمیل/FTP/فایل‌های قدیمی Webzi را اگر لازم است بکاپ بگیر  
3. nic را چک کن که دیگر هیچ `webzidns` نباشد  

---

## مرحله ۵ — تست

- https://www.poshaktaranom.ir → باید فروشگاه تکی باز شود  
- https://poshaktaranom.ir → ریدایرکت به www  
- https://poshaktaranom.com → عمده مثل قبل  
- خرید آزمایشی تکی + عمده روی یک کالا  

---

## اگر Cloudflare نمی‌خواهی

می‌توانی DNS را روی خود Hetzner یا هر DNS رایگان دیگری ببری؛ مهم این است:

1. NS در nic از Webzi خارج شود  
2. رکورد A برای `@` و `www` = `5.75.200.102`  
3. SSL + nginx روی سرور فعال شود  

---

## کارهای موازی کسب‌وکار

- قیمت `retailPrice` محصولات را در ادمین پر کن  
- SMS OTP را وصل کن  
- زرین‌پال را برای دامنه `.ir` تأیید کن  
