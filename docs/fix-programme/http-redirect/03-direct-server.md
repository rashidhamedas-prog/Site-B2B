# فاز 03 — تغییر مستقیم سرور (Cursor اجرا می‌کند، فقط برای علت‌های (b) و (c))

مجوز: GO حامد 1405/08/10 ساعت 14:42 («میخام همه کارو کرسر انجام بده کامل»). فقط وقتی اجرا شود که فاز 01 علت را با شواهد (b) یا (c) ثبت کرده باشد. علت (a) با deploy فاز 02 حل می‌شود. اگر بعد از فاز 02 هنوز nginx قدیمی بود، فقط allowlist (a) پایین مجاز است.

اتصال: `ssh -p 3031 -i <key-path> -o IdentitiesOnly=yes tnadmin@185.213.167.61`. هیچ کلید یا رمزی در فایل‌ها نیاید.

## قوانین مشترک
- اول backup: `TS=$(date +%Y%m%d-%H%M%S); B=/opt/taranom/backups/http-redirect-$TS; mkdir -p $B`.
- اول خط پایه: ماتریس فاز 04 را اجرا و در `$B/baseline.txt` ذخیره کن.
- حداقل تغییر لازم را اعمال کن. سپس `nginx -t`، ماتریس curl و بررسی HSTS را اجرا کن.
- در صورت شکست: backup را بازگردان، دوباره بررسی کن که رفتار برابر baseline باشد، توقف و گزارش.
- **ممنوع:** دست زدن به DB، volumeهای داده، `.env` و مقادیر آن، کلیدها و certها (جز خواندن)، کانفیگ سرویس‌های دیگر، `docker compose down`، `docker volume|system prune`، `rm -rf`، `reboot`، `apt`، و تغییر فایروال.
- هر دستوری خارج از allowlist علت مربوط = توقف و گزارش.

## allowlist علت (a): کانتینر nginx قدیمی پس از فاز 02
```bash
docker exec <nginx> nginx -T > $B/nginx-T-before.txt
cd /opt/taranom && docker compose exec -T nginx nginx -t
cd /opt/taranom && docker compose up -d nginx --no-deps --force-recreate
# rollback: revert فاز 02 (فایل تأیید revert)
```

## allowlist علت (b): override یا کانفیگ دیگری mount شده
```bash
cp -a /opt/taranom/docker-compose.override.yml $B/            # و هر فایل nginx که mount شده
docker exec <nginx> nginx -T > $B/nginx-T-before.txt
docker compose -f /opt/taranom/docker-compose.yml config --services > $B/compose-services-before.txt   # full config not saved (contains env)
# apply: فقط بخش nginx override (mount یا ports که کانفیگ مخزن را می‌پوشاند) حذف شود
cp /opt/taranom/docker-compose.override.yml /opt/taranom/docker-compose.override.yml.tmp
# edit .tmp: remove only the nginx volumes/ports entries that shadow the repo config (no other service touched)
cd /opt/taranom && docker compose -f docker-compose.yml -f docker-compose.override.yml.tmp config >/dev/null
mv docker-compose.override.yml.tmp docker-compose.override.yml
# اگر override فقط nginx را تغییر می‌دهد، می‌توان آن را کامل کنار گذاشت:
#   mv docker-compose.override.yml $B/override.disabled.yml
docker compose up -d nginx --no-deps --force-recreate
docker compose exec -T nginx nginx -t
# rollback
cp -a $B/docker-compose.override.yml /opt/taranom/ && cd /opt/taranom && docker compose up -d nginx --no-deps --force-recreate
```
اگر override روی سرویس‌های دیگر (api، web، worker، db) اثر دارد، فقط کلید nginx حذف شود. اگر جدا کردن آن بدون اثر روی بقیه ممکن نیست، توقف و گزارش.

## allowlist علت (c): سرویس میزبان روی :80
```bash
sudo -n ss -ltnp '( sport = :80 )' > $B/ss-before.txt
sudo -n tar czf $B/host-nginx-etc.tgz /etc/nginx
sudo -n nginx -T > $B/host-nginx-T-before.txt
# apply option 1 (preferred if the host service serves anything else): a new file only
sudo -n tee /etc/nginx/conf.d/taranom-http-redirect.conf >/dev/null <<'NG'
server { listen 80; server_name poshaktaranom.ir www.poshaktaranom.ir;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://www.poshaktaranom.ir$request_uri; } }
server { listen 80; server_name poshaktaranom.com www.poshaktaranom.com;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://poshaktaranom.com$request_uri; } }
NG
sudo -n nginx -t && sudo -n systemctl reload nginx
# rollback 1
sudo -n rm -f /etc/nginx/conf.d/taranom-http-redirect.conf && sudo -n nginx -t && sudo -n systemctl reload nginx
# apply option 2 (only if the host service serves nothing else, confirmed in phase 01)
sudo -n systemctl disable --now nginx && cd /opt/taranom && docker compose up -d nginx --no-deps --force-recreate
# rollback 2
cd /opt/taranom && docker compose stop nginx; sudo -n systemctl enable --now nginx; docker compose up -d nginx --no-deps
```
- مسیر ACME (`root`) را با کانفیگ واقعی certbot میزبان هم‌خوان کن.
- اگر `sudo -n` رمز خواست، توقف و گزارش (رمز وارد نشود).
- سرویس میزبان اگر apache یا caddy است: معادل همین با یک فایل جدید یا توقف، با backup. اگر شک داری، توقف.

## پس از اجرا
ماتریس فاز 04 را اجرا کن. همه شواهد، مسیر `$B` و دستورهای اجراشده در status.json و `docs/fix-programme/http-redirect-server-actions.md` ثبت شوند (بدون اسرار).
