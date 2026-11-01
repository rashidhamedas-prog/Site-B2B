# فاز 01 — عیب‌یابی فقط‌خواندنی

در این فاز جز `http-redirect-status.json` هیچ فایلی تغییر نکند.

## 1. کنترل شبکه
```bash
env | grep -i proxy
curl -sSI -m10 http://example.com | head -3
```
اگر کنترل غیرعادی بود (مثلاً 500 یا `Server: Pingora`)، شبکه نامعتبر است. با `--noproxy '*'` یا از شبکه دیگری تکرار کن و در گزارش ثبت کن.

## 2. ماتریس http
```bash
for h in poshaktaranom.ir www.poshaktaranom.ir poshaktaranom.com www.poshaktaranom.com; do
  for p in / /about '/?x=1'; do
    echo "== http://$h$p"
    curl -sSI -m15 "http://$h$p" | grep -iE '^HTTP|^location|^server'
  done
done
curl -v -m15 http://poshaktaranom.ir/about -o /dev/null 2>&1 | grep -E '^\*.*Connected|^< '
curl -sSI -m15 --resolve poshaktaranom.ir:80:185.213.167.61 http://poshaktaranom.ir/about
```
- **301 → https درست:** مشکل وجود ندارد. فقط بهبود دو‌hop در فاز 02 بماند.
- **200 روی http:** به هدر `Server` و بدنه نگاه کن (`curl -s http://poshaktaranom.ir/about | head -30`). nginx همان نسخه 443 است؟ صفحه از Next/web است؟ سرور دیگری جواب می‌دهد؟

## 3. بررسی مخزن (فقط خواندن)
- `nginx/nginx.conf`: بلوک‌های `listen 80` و `server_name`ها. آیا `default_server` دیگری یا `location`ای روی :80 هست که به جای redirect، proxy_pass کند؟
- `docker-compose.yml`: سرویس nginx، `ports: 80:80`، bind mount دقیق `nginx.conf` (فایل تکی؛ اگر inode عوض شود، کانتینر نسخه قدیمی را می‌بیند).
- `scripts/auto-deploy.sh`: آیا nginx همیشه recreate/reload می‌شود (`up -d nginx --force-recreate`)؟ در کدام شرط‌ها رد می‌شود؟ SOURCE_SHA یا آخرین SHA deployشده کجا ثبت می‌شود؟ گیت `deploy-approval.json` چه نقشی دارد؟
- `deploy/systemd/taranom-autodeploy.*`، `docs/conventions.md`، `docs/design/omnichannel-redesign/pr0-plan.md`، `SETUP.md`: نصب nginx میزبان، certbot، فایل override.
- `git log -p -- nginx/nginx.conf docker-compose.yml scripts/auto-deploy.sh`: بلوک‌های :80 از چه زمانی هستند؟

## 4. دستورهای فقط‌خواندنی سرور
```bash
sudo ss -ltnp '( sport = :80 or sport = :443 )'
systemctl status nginx apache2 caddy 2>/dev/null | head -20
systemctl list-timers | grep -i taranom
systemctl status taranom-autodeploy.service --no-pager | tail -20
cd /opt/taranom && git rev-parse HEAD && git status --short | head
ls -la /opt/taranom/docker-compose*.yml /opt/taranom/*.override.* 2>/dev/null
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.CreatedAt}}'
docker compose -f /opt/taranom/docker-compose.yml config | sed -n '/^  nginx:/,/^  [a-z]/p' | grep -vE 'environment|=|_KEY|_TOKEN|PASSWORD'
docker inspect <nginx-container> --format '{{json .Mounts}}'
docker exec <nginx-container> nginx -T 2>/dev/null | grep -nE 'listen|server_name|return 301'
diff <(docker exec <nginx-container> cat /etc/nginx/nginx.conf) /opt/taranom/nginx/nginx.conf
journalctl -u taranom-autodeploy --since -2d --no-pager | grep -iE 'nginx|sha|skip|error' | tail -30
```
**مجوز اجرا (GO حامد 1405/08/10، فقط‌خواندنی):** Cursor این دستورها را با SSH مستندشده در `docs/conventions.md` اجرا می‌کند:
`ssh -p 3031 -i <key-path> -o IdentitiesOnly=yes tnadmin@185.213.167.61 '<cmd>'`.
مسیر کلید فقط placeholder است. کلید، رمز یا محتوای `.env` در فایل، لاگ یا چت نیاید. خروجی‌ها را پیش از ثبت در `docs/fix-programme/http-redirect-server-readonly.md` از هر مقدار محرمانه پاک کن.

### فهرست مجاز SSH (فقط این‌ها)
`ss -ltnp`، `sudo -n ss -ltnp` (فقط اگر بدون رمز ممکن باشد)، `systemctl status|is-active|is-enabled|list-timers|cat <unit>`، `journalctl --no-pager ...`، `docker ps`، `docker inspect --format '{{json .Mounts}}'` (نه inspect کامل؛ Env را چاپ می‌کند)، `docker logs --tail N`، `docker compose ps`، `docker compose config --services` و بخش nginx آن بدون `environment`، `docker exec <nginx> nginx -T`، `docker exec <nginx> cat <file>`، `git -C /opt/taranom rev-parse|log|status|diff`، `ls`، `cat` (فقط فایل‌های غیرمحرمانه؛ هرگز `.env` یا کلید)، `head`، `tail`، `grep`، `diff`، `stat`، `curl -sSI` (به localhost)، `uname`، `df`، `uptime`.

### ممنوع مطلق روی SSH
هر نوع نوشتن، ری‌استارت یا ویرایش، از جمله: `docker compose up|down|restart|build|pull|rm`، `docker run|stop|start|restart|rm|exec` (به جز `nginx -T` و `cat`)، `systemctl start|stop|restart|reload|enable|disable|daemon-reload`، `nginx -s`، `rm`، `mv`، `cp`، `tee`، `sed -i`، `>` و `>>`، `touch`، `mkdir`، `chmod`، `chown`، `git pull|fetch|reset|checkout|commit`، `apt`، `certbot`، `crontab -e`، `kill`، `reboot`، و هر ویرایشگری (vi، nano). در فاز 01 نوشتن `deploy-approval.json` هم ممنوع است (آن فقط در فاز 02 مجاز است).
اگر دستوری خارج از فهرست مجاز لازم شد، اجرا نکن و آن را به عنوان تصمیم گزارش کن.

## 5. طبقه‌بندی علت (در status.json)
- **(a) استیل/deploy نشده:** SHA سرور از master عقب است، یا nginx بعد از تغییر recreate نشده است (inode قدیمی، کانتینر قدیمی، deploy به خاطر گیت تأیید متوقف مانده).
- **(b) کانفیگ دیگری mount شده یا override وجود دارد:** مثلاً `/opt/taranom/docker-compose.override.yml`، mount مسیر دیگر، یا فایل nginx ویرایش‌شده دستی روی سرور.
- **(c) سرویس سطح میزبان روی :80:** مثلاً nginx، apache یا caddy میزبان که جلوی docker به :80 جواب می‌دهد.
- **(d) خود مخزن:** کانفیگ مخزن 200 می‌دهد. با `docker run nginx:stable` محلی و `curl -H Host:` آزمایش کن.

مسیر بعدی: (d) و بخش‌های مخزنیِ (a) به فاز 02 می‌روند. (b)، (c) و بخش‌های سرورِ (a) به فاز 03 می‌روند. دو‌hop www.com در هر حالت به فاز 02 می‌رود.
