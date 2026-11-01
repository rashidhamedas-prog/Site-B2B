# 2026-11-01 — http→https: یک hop، HSTS و mount پوشه nginx

برنامه: `docs/fix-programme/http-redirect/` · وضعیت: `docs/fix-programme/http-redirect-status.json` · شواهد سرور: `docs/fix-programme/http-redirect-server-readonly.md`.

## تشخیص (فاز 01)
- هر چهار هاست روی http (`/`، `/about`، `/?x=1`) پاسخ 301 به https می‌دهند و کوئری حفظ می‌شود. 200 روی http بازتولید نشد.
- HEAD سرور = origin/master (`6365d471`)، `nginx.conf` داخل کانتینر = فایل مخزن، :80 فقط `docker-proxy` است و override به nginx کاری ندارد. علت‌های (b)، (c) و (d) رد شدند و (a) در وضعیت فعلی وجود ندارد.
- ایراد واقعی: `http://www.poshaktaranom.com` → `https://www.poshaktaranom.com` → `https://poshaktaranom.com` (دو hop، به خاطر `$host`).

## تغییرات
- `nginx/nginx.conf`: سه بلوک :80 با مقصد هاردکد (.ir → www.ir، .com/www.com → apex .com، api → api). `default_server` روی :80 با 444 و مسیر ACME باز. HSTS `max-age=31536000` روی همه بلوک‌های 443 و روی `location`هایی که `add_header` خودشان را دارند.
- `docker-compose.yml`: mount پوشه `./nginx:/etc/nginx/taranom:ro` و `command: nginx -c /etc/nginx/taranom/nginx.conf`.
- `scripts/auto-deploy.sh`: `docker compose run --rm nginx nginx -t` پیش از drain یا build، force-recreate بدون شرط، بررسی `nginx -T` برای ریدایرکت، اجرای `scripts/nginx-http-healthcheck.sh` و ثبت `logs/DEPLOYED_SHA`.
- CI: `scripts/tests/nginx-config.test.sh` (job `nginx-config`).

## نتیجه
- PR #151 با squash به master رفت (`b9cf9783`) و در 2026-11-01 12:18 UTC از راه تایمر و فایل تأیید deploy شد. چک سلامت داخل deploy پاس شد.
- ماتریس فاز 04 پاس شد (`docs/fix-programme/http-redirect-phase04-matrix.txt`). فاز 03 لازم نشد.
- تصمیم حامد (2026-11-01): HSTS `max-age=31536000` و 444 برای Host ناشناخته روی http همین‌طور می‌مانند.

## ریسک و rollback
- HSTS از `63072000; includeSubDomains` به `31536000` کاهش یافت. مرورگرهایی که سیاست قبلی را گرفته‌اند تا انقضا همان را نگه می‌دارند (بی‌ضرر).
- Host ناشناخته روی http حالا 444 می‌گیرد (قبلاً به www.ir ریدایرکت می‌شد).
- rollback: `git revert` روی PR، فایل تأیید revert، و deploy از راه تایمر.
