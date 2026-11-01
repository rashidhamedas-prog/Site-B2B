# شروع — http→https برای Site-B2B

**استثنای تأییدشده حامد (۱۴:۴۲، تأیید مجدد ۱۵:۲۶): فقط در این زیپ Cursor خودش deploy-approval.json را می‌نویسد و فاز ۰۳ را با بکاپ/rollback اجرا می‌کند.**

## ممنوع (همه فازها)
force-push · `TARANOM_DEPLOY_FORCE` · `workflow_dispatch` · تغییر `.env` یا env در pm2 · ارسال واقعی SMS یا هر پیام دیگر · تغییر یا حذف داده واقعی (DB، volume) · چاپ اسرار · کلید یا رمز در فایل (فقط `<key-path>`) · reboot · دست زدن به `.ir/about`، ریدایرکت آن به `.com`، canonical یا ساختار URL · HSTS preload یا includeSubDomains. SSH فقط با allowlist هر فاز. هر چیز خارج از آن = توقف و گزارش.

## هدف
هر `http://` با **یک 301** به `https://www.poshaktaranom.ir$request_uri` (برای .ir و www.ir) یا `https://poshaktaranom.com$request_uri` (برای .com و www.com) برود. مقصد نهایی 200 باشد، کوئری حفظ شود و ACME روی http کار کند. حامد گزارش داده: `http://poshaktaranom.ir/about` روی http پاسخ 200 داد. سایت مستقیم از 185.213.167.61 سرو می‌شود (CDN ندارد). nginx مخزن از قبل بلوک :80 دارد، پس احتمالاً سرور با مخزن فرق دارد.

## ریسک‌ها
| ریسک | کاهش |
|---|---|
| قطعی کوتاه هنگام recreate nginx | `nginx -t` پیش از آن، بررسی سلامت فوری، revert |
| HSTS یک سال در مرورگر می‌ماند | فقط max-age، cert هر دو دامنه پیش از آن سالم باشد |
| شکست تمدید cert (ACME) | challenge بدون ریدایرکت، تست 404 در فاز 04 |
| mount پوشه nginx مسیر اشتباه بدهد | `nginx -t` در CI با همان mount |
| تغییر مستقیم سرور (فاز 03) | backup زمان‌دار، حداقل تغییر، بازگردانی و توقف |

## روش کار
1. فقط فایل‌های این زیپ و فایل‌هایی از مخزن را بخوان که هر فاز نام می‌برد.
2. ترتیب اجرا: `01-diagnosis.md` ← `02-repo-fix.md` ← `03-direct-server.md` (فقط اگر علت b یا c باشد) ← `04-verification.md` ← `99-verification-checklist.md`.
3. وضعیت را در `docs/fix-programme/http-redirect-status.json` ثبت کن (phase، status، cause، PR، SHA، شواهد). در شروع آن را بخوان و از فاز ناتمام ادامه بده.
4. هر فاز کدی: شاخه `fix/http-redirect-<phase>`، یک PR، CI کامل.
5. فقط اگر همه چک‌ها سبز و PR mergeable/clean باشد، **squash-merge** کن. deploy فقط از راه تایمر `taranom-autodeploy` و فایل تأیید (فاز 02) انجام شود.
6. پس از deploy، بررسی سلامت فاز 02 و ماتریس فاز 04 را اجرا کن.
7. در هر شکست: revert commit (یا بازگردانی backup فاز 03)، تأیید برگشت رفتار به حالت قبل، **توقف** و گزارش.
8. گزارش نهایی: علت (a/b/c/d) با شواهد، PRها و SHAها، نتیجه ماتریس، و فقط تصمیم‌های واقعی باقی‌مانده برای حامد.
