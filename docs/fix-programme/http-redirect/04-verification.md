# فاز 04 — راستی‌آزمایی (پس از deploy فاز 02 یا اجرای فاز 03)

ابتدا کنترل شبکه را اجرا کن: `curl -sSI http://example.com` باید عادی باشد، وگرنه نتایج نامعتبرند.

```bash
P='/ /about /sitemap.xml /robots.txt /?utm_source=test&x=1 <PRODUCT_PATH>'
for s in http https; do for h in poshaktaranom.ir www.poshaktaranom.ir poshaktaranom.com www.poshaktaranom.com; do for p in $P; do
  r=$(curl -sS -o /dev/null -m15 -w '%{http_code} %{redirect_url}' "$s://$h$p")
  f=$(curl -sSL -o /dev/null -m20 -w '%{http_code} %{num_redirects} %{url_effective}' "$s://$h$p")
  echo "$s://$h$p | first: $r | final: $f"
done; done; done
```
`<PRODUCT_PATH>`: یک مسیر محصول واقعی از sitemap هر دامنه (فقط خواندن).

## انتظار
- **http، هر چهار هاست:** پاسخ اول `301` باشد و Location دقیقاً `https://www.poshaktaranom.ir…` (برای .ir) یا `https://poshaktaranom.com…` (برای .com) با همان مسیر و کوئری. `num_redirects=1` و پاسخ نهایی 200.
- **https کانونیکال:** 200 مستقیم. **https غیرکانونیکال:** دقیقاً یک 301.
- `www.poshaktaranom.ir/about` پاسخ 200 بدهد و به .com نرود.
- هیچ 200 روی http، هیچ 500 و هیچ حلقه‌ای نباشد.
- مسیر `http://<host>/.well-known/acme-challenge/x` از nginx پاسخ 404 بدهد، نه 301.

## HSTS
```bash
for h in www.poshaktaranom.ir poshaktaranom.com; do curl -sSI https://$h/ | grep -i strict-transport; done
curl -sSI http://poshaktaranom.ir/ | grep -i strict-transport   # must be empty
```
انتظار: دقیقاً `max-age=31536000`، **بدون** preload و includeSubDomains، فقط روی https.

## کانفیگ deployشده
خروجی `docker exec <nginx> nginx -T | grep -nE 'listen 80|return 301|Strict-Transport'` (فقط‌خواندنی، با allowlist فاز 01) باید با مخزن یکی باشد و mount پوشه در `docker inspect` دیده شود.

در صورت شکست: revert فاز 02 (با فایل تأیید revert) یا بازگردانی backup فاز 03، اجرای دوباره ماتریس، توقف و گزارش.
