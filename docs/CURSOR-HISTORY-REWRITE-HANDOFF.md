# تحویل امنیتی به Cursor — Fresh clone اجباری

تاریخ: 2026-08-01

تاریخچه Git این repository برای حذف دو مسیر دارای credential بازنویسی و تمام ۲۸ branch به‌صورت کنترل‌شده force-push شد. استفاده از clone، branch، stash مبتنی بر commit یا worktree قدیمی ممنوع است؛ SHAهای قبلی دیگر مبنای معتبر repository نیستند.

## اقدام الزامی Cursor

1. اگر تغییر commit‌نشده‌ای در clone قدیمی وجود دارد، فقط patch فایل‌های کد غیرحساس را خارج از repository ذخیره کنید. فایل env، credential، حافظه عامل یا تنظیمات سرور را منتقل نکنید.
2. پوشه clone قدیمی را archive یا rename کنید و از آن `pull`، `rebase`، `merge` یا `push` نزنید.
3. repository را تازه clone کنید:

```bash
git clone https://github.com/rashidhamedas-prog/Site-BtoB.git
cd Site-BtoB
git status
git log -1 --oneline
npm ci
```

4. اگر لازم است روی branch قبلی ادامه دهید، همان branch بازنویسی‌شده را از `origin` checkout کنید؛ commitهای clone قدیمی را merge نکنید.
5. هر patch نگه‌داری‌شده را خط‌به‌خط بازبینی و فقط روی branch جدید اعمال کنید.

## نتیجه عملیات

- دو مسیر حساس از تمام تاریخچه حذف شدند: `TARANOM-SERVER-INFO.txt` و `.claude/memory.json`.
- Gitleaks 8.30.1 با checksum معتبر، ۱۰۷ commit بازنویسی‌شده را اسکن کرد: صفر finding.
- SSH production فقط key-based است و password قدیمی حساب lock شده است.
- credentialهای داخلی PostgreSQL، Redis، MinIO، Meilisearch و JWT rotate شده‌اند.
- checkout hardening و تراکنش واحد موجودی/کیف پول/تخفیف در master باقی مانده است.
- production، API و هر دو دامنه پس از عملیات سالم بررسی شدند.

## قوانین ادامه کار

- هیچ secret یا مقدار واقعی env در code، docs، chat، memory یا commit نوشته نشود.
- `.Codex/memory.json` فقط metadata غیرحساس نگه دارد.
- قبل از push، secret scan و تست‌های مرتبط اجرا شوند.
- deploy، migration production و هر rotation بعدی باید backup و health/rollback evidence داشته باشد.

## موارد بیرونی باقی‌مانده

توکن‌های ارائه‌دهندگان بیرونی مانند SMS، payment و CRM فقط از پنل همان ارائه‌دهنده قابل rotate هستند و باید توسط مالک حساب انجام و سپس روی production تنظیم شوند. مقدار جدید نباید داخل repository ثبت شود.
