# http→https — شواهد فقط‌خواندنی سرور (فاز 01)

تاریخ: 2026-11-01 حدود 12:00 UTC. اتصال: `ssh -p 3031 -i <key-path> -o IdentitiesOnly=yes tnadmin@185.213.167.61`. هیچ مقدار محرمانه‌ای ثبت نشده است.

## شبکه کنترل
- `curl.exe` در ویندوز مستقیم کار می‌کند (پروکسی سیستم WinINET روی آن اثر ندارد). `http://example.com` پاسخ `HTTP/1.1 200 OK` داد و غیرعادی نبود.
- DNS هر چهار هاست → `185.213.167.61` (بدون CDN).

## ماتریس http (از بیرون)
| URL | پاسخ اول | Location |
|---|---|---|
| http://poshaktaranom.ir/ ، /about ، /?x=1 | 301 (nginx/1.31.2) | https://www.poshaktaranom.ir{same} |
| http://www.poshaktaranom.ir/ ، /about ، /?x=1 | 301 | https://www.poshaktaranom.ir{same} |
| http://poshaktaranom.com/ ، /about ، /?x=1 | 301 | https://poshaktaranom.com{same} |
| http://www.poshaktaranom.com/ ، /about ، /?x=1 | 301 | **https://www.poshaktaranom.com{same}** (hop دوم لازم است) |

`curl --resolve poshaktaranom.ir:80:185.213.167.61 http://poshaktaranom.ir/about` هم پاسخ 301 به `https://www.poshaktaranom.ir/about` داد. **هیچ 200 روی http دیده نشد.**

## سرور
- `ss -ltnp` (sudo -n): :80 و :443 فقط توسط `docker-proxy` گوش داده می‌شوند.
- nginx، apache2 و caddy روی میزبان `not-found` هستند.
- `git -C /opt/taranom rev-parse HEAD` = `6365d4716586568750e938e0e3ea1c6960d5c346` = origin/master.
- `docker-compose.override.yml` فقط `worker` و `worker-b` را تغییر می‌دهد و به nginx کاری ندارد.
- `docker compose config` برای nginx: bind فایل تکی `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`، `./nginx/ssl`، `/opt/seo-auto/deploy/nginx/conf.d` (فقط `00-placeholder.conf`)، `certbot_www`. پورت‌ها `80` و `443`.
- `diff <(docker exec taranom_nginx cat /etc/nginx/nginx.conf) /opt/taranom/nginx/nginx.conf` → SAME.
- `nginx -T`: بلوک :80 apex .ir (`return 301 https://www.poshaktaranom.ir$request_uri`) و بلوک :80 دیگر (`return 301 https://$host$request_uri`) برای `.com`، `www.com`، `www.ir` و `api`.
- `taranom_nginx` در 2026-11-01 11:15:18 UTC با deploy `6365d47` دوباره ساخته شد (`journalctl`: `Container taranom_nginx Recreate … Started`). `auto-deploy.sh` از 2026-09-30 (`7c92e9c8`) nginx را در هر deploy با force-recreate دوباره می‌سازد.
- بلوک‌های :80 از مرداد/شهریور 2026 در مخزن هستند (`git log -- nginx/nginx.conf`).

## یادداشت اجرایی
در اولین تلاش، اسکریپت SSH با پایان خط CRLF فرستاده شد و یک redirect `> /tmp/.nx_running` در آن بود (خارج از allowlist). خروجی آن تلاش خالی بود. بعداً `ls /tmp/.nx_running*` نشان داد که فایلی ساخته نشده است. تلاش‌های بعدی فقط از دستورهای مجاز استفاده کردند.
