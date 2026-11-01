# فاز 02 — اصلاح سمت مخزن

## 1. nginx/nginx.conf: یک hop با هاست‌های هاردکد
از `$host` استفاده نکن (خطر open redirect دارد و www.com را دو‌hop می‌کند):
```nginx
server {
  listen 80;
  server_name poshaktaranom.ir www.poshaktaranom.ir;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://www.poshaktaranom.ir$request_uri; }
}
server {
  listen 80;
  server_name poshaktaranom.com www.poshaktaranom.com;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://poshaktaranom.com$request_uri; }
}
server {
  listen 80;
  server_name api.poshaktaranom.com;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 301 https://api.poshaktaranom.com$request_uri; }
}
server { listen 80 default_server; server_name _; return 444; }
```
- `$request_uri` کوئری‌استرینگ را حفظ می‌کند.
- اگر روی :80 از قبل `default_server` دیگری وجود دارد، یکی بماند.
- بلوک‌های 443، ریدایرکت‌های https و `.ir/about` دست نخورند.

## 2. compose: mount پوشه (اجباری)
- bind فایل تکی `nginx.conf` حذف شود. پوشه `./nginx` به صورت فقط‌خواندنی mount شود؛ مثلاً `./nginx:/etc/nginx/taranom:ro` و `command`/include طوری تنظیم شود که `/etc/nginx/taranom/nginx.conf` بارگذاری شود (یا معادل تمیز آن). هدف این است که جایگزین شدن فایل با `git reset` کانفیگ قدیمی را در کانتینر باقی نگذارد.
- `'80:80'` و `'443:443'` منتشر بمانند. volumeهای `/var/www/certbot` و cert دست نخورند.
- مسیرهای cert و include در کانفیگ با mount جدید هم‌خوان باشند.

## 2.1 HSTS (فقط روی بلوک‌های 443)
در هر `server` با `listen 443 ssl` این خط اضافه شود:
`add_header Strict-Transport-Security "max-age=31536000" always;`
- includeSubDomains اضافه نشود (مگر همه زیردامنه‌ها https بودنشان تأیید شده باشد؛ پیش‌فرض بدون آن).
- preload ممنوع است.
- روی بلوک‌های :80 اضافه نشود.
- اگر `location`ای خودش `add_header` دارد، هدر HSTS همان‌جا هم تکرار شود (در nginx، add_header از سطح بالاتر به ارث نمی‌رسد).

## 3. deploy واقعاً nginx را به‌روز کند (`scripts/auto-deploy.sh`)
- deploy با mount پوشه کار کند. در هر deploy: ابتدا `docker compose exec nginx nginx -t`، سپس `up -d nginx --no-deps --force-recreate` (یا `nginx -s reload`) **بدون شرط**.
- بعد از آن: `docker exec <nginx> nginx -T | grep -q 'return 301 https://www.poshaktaranom.ir'`. اگر پیدا نشد، deploy شکست بخورد و لاگ بدهد.
- SHA deployشده در فایل/لاگ ثبت شود تا بتوان آن را با master مقایسه کرد.

## 4. بررسی سلامت بعد از deploy (در auto-deploy.sh یا اسکریپت جدا)
```bash
for h in poshaktaranom.ir www.poshaktaranom.ir poshaktaranom.com www.poshaktaranom.com; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: $h" "http://127.0.0.1/about?hc=1")
  case "$h" in *.ir) exp="https://www.poshaktaranom.ir/about?hc=1";; *) exp="https://poshaktaranom.com/about?hc=1";; esac
  [ "$out" = "301 $exp" ] || { echo "HTTP redirect FAIL $h: $out"; exit 1; }
done
```

بررسی سلامت HSTS: `curl -skI --resolve www.poshaktaranom.ir:443:127.0.0.1 https://www.poshaktaranom.ir/ | grep -qi 'strict-transport-security: max-age=31536000'` (برای poshaktaranom.com هم). اگر تطبیق نشد، deploy شکست بخورد.

## 5. CI
- گام `nginx -t` (با همان mount پوشه compose) روی `nginx/nginx.conf` با `nginx:stable` اضافه شود. در CI از cert خودامضای موقت استفاده کن و هیچ کلید واقعی وارد مخزن نشود.
- تست کانتینری: هدر HSTS روی 443 بدون preload و includeSubDomains، و نبود HSTS روی :80.
- تست کانتینری: درخواست با `Host:` برای هر چهار هاست، انتظار `301` با Location دقیق و کوئری حفظ‌شده.

## 6. PR، merge و deploy (GO حامد 1405/08/10 ساعت 14:42)
1. یک PR جدا باز کن. همه CIها باید سبز باشند (lint، build، تست‌ها، `nginx -t` با mount پوشه، تست‌های کانتینری، deploy-lock-tests). اگر حتی یک چک قرمز یا pending بود، merge نکن.
2. فقط اگر همه چک‌ها سبز و PR mergeable/clean باشد، **squash-merge** به master (بدون force-push). `SHA=$(git rev-parse origin/master)` را بگیر و SHA کامل (40 کاراکتر) را در status.json ثبت کن.
3. **تنها نوشتن مجاز با SSH در فاز 02:** فایل تأیید را با قالب `deploy/deploy-approval.example.json` (همان قالبی که `scripts/auto-deploy.sh` می‌خواند) به صورت اتمیک بنویس:
```bash
ssh -p 3031 -i <key-path> -o IdentitiesOnly=yes tnadmin@185.213.167.61 \
  "cd /opt/taranom && umask 077 && cat > deploy-approval.json.tmp <<JSON
{
  \"commit\": \"$SHA\",
  \"goRef\": \"Hamed GO 1405/08/10 14:42 — http→https redirect fix\",
  \"approvedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
}
JSON
python3 -m json.tool deploy-approval.json.tmp >/dev/null && mv deploy-approval.json.tmp deploy-approval.json && ls -l deploy-approval.json"
```
   - مالک `tnadmin` باشد (همان کاربر سرویس `taranom-autodeploy`)، با دسترسی 600 یا هر چیزی که docs یا اسکریپت لازم دارد.
   - **allowlist نوشتن فاز 02:** فقط `deploy-approval.json.tmp` و `deploy-approval.json` در `/opt/taranom`، با `cat >`، `python3 -m json.tool`، `mv`، `ls -l`. هیچ نوشتن دیگری مجاز نیست. دستورهای فقط‌خواندنی فاز 01 برای پایش مجازند.
   - `sudo systemctl start taranom-autodeploy.service` و `TARANOM_DEPLOY_FORCE` استفاده نشوند. منتظر تایمر بمان.
4. حدود 3 تا 6 دقیقه صبر کن. با `journalctl -u taranom-autodeploy --no-pager --since -10min` (فقط‌خواندنی) پایان deploy برای همان SHA را تأیید کن. اگر پس از 15 دقیقه deploy نشد، توقف و گزارش.
5. بررسی سلامت بخش 4، سپس فاز 04.
6. **در صورت شکست:**
   - `git revert <squash-sha>` در شاخه جدا، PR، CI سبز، merge (force-push هرگز).
   - فایل تأیید جدید را به همان روش اتمیک با SHA کامل revert و goRef `Hamed GO 1405/08/10 14:42 — revert http redirect fix` بنویس.
   - منتظر deploy بمان. بررسی کن رفتار سایت به حالت قبل برگشته باشد (همان خروجی ماتریس خط پایه فاز 01: https کانونیکال 200، `www.poshaktaranom.ir/about` 200).
   - توقف و گزارش.

نکته: اگر علت (b) یا (c) باشد، این فاز به‌تنهایی مشکل را حل نمی‌کند. فاز 03 لازم است.
