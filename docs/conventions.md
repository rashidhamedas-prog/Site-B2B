# قراردادهای توسعه — ترنم B2B

## سرعت سایت (الزامی — اولویت اول)

سرعت لندینگ و صفحات پرترافیک **اولویت شماره ۱** است. جزئیات اجرایی در `.cursor/rules/performance-first.mdc`.

خلاصه:
- هوم تکی/عمده بدون لیست سنگین محصول (حداکثر ~۱۲–۱۶ کارت)
- فقط یک LCP image با `priority`
- Suspense برای below-fold؛ بدون waterfall غیرضروری
- اسکریپت‌های شخص‌ثالث بعد از idle

---

## قانون ویترین قابل‌تنظیم (الزامی)

هر رفتار یا محتوای قابل‌مشاهده در سایت‌های عمده/تکی **باید از ادمین قابل تغییر باشد** — نه فقط hard-code در کد:

| نوع تغییر | محل تنظیم |
|-----------|-----------|
| بلوک‌ها، هیرو، محصولات، بنر دسته، FAQ، کروم | `/admin/site-content` |
| هزینه ارسال، پرداخت، SMS، تم، مارکتینگ | `/admin/settings` |
| بنر مربعی هر دسته | `/admin/categories` → فیلد بنر ۱:۱ |
| فعال/غیرفعال مشتری CRM | `/admin/customers` |

پیش‌فرض‌های کد (`defaults.ts` و مشابه) فقط fallback هستند؛ بعد از ذخیره در ادمین، مقدار ذخیره‌شده اولویت دارد.

## گزارش‌دهی بعد از هر تغییر (الزامی)

هر agent (Cursor / Claude Code) **بعد از اتمام کار**:

1. **`docs/WORKLOG.md`** — یک ورودی با تاریخ و خلاصه ۳–۵ خطی
2. **`docs/reports/YYYY-MM-DD-<topic>.md`** — برای تغییرات بزرگ (چند فایل، deploy، باگ مهم)
3. **`.claude/memory.json`** — به‌روز risks، deploy state، آخرین تست
4. **`git commit`** — پیام Conventional Commits، مثلاً:
   - `fix(web): product gallery layout`
   - `docs: add session report 2026-07-09`

## ساختار docs

```
docs/
  WORKLOG.md              # ایندکس زمانی (همیشه به‌روز)
  conventions.md          # این فایل
  reports/                # گزارش‌های تفصیلی هر جلسه
  adr/                    # تصمیم‌های معماری (در صورت نیاز)
```

## Deploy

- **مبدأ تولید واحد:** سرور ایران `tnadmin@185.213.167.61:3031` مسیر `/opt/taranom`
- هتزنر/آلمان (`5.75.200.102`) از مدار تولید خارج است — دیپلوی یا dual-deploy ممنوع
- اسکریپت: `scripts/auto-deploy.sh` (+ `deploy/systemd/taranom-autodeploy.*`)
- پس از deploy: health check + در صورت امکان `scripts/e2e-purchase-test.sh`
- جزئیات: `docs/deployment-runbook.md` و قانون `.cursor/rules/sole-iran-origin.mdc`

### Deploy فقط با GO نوشتاری حامد (الزامی)

**بدون GO نوشتاری حامد، push به `master` یا deploy ممنوع است.**

بعد از اتمام کار معنادار:

1. به‌روزرسانی `docs/WORKLOG.md` (+ report در صورت نیاز)
2. `git add` فایل‌های مربوط + `git commit` (Conventional Commits)
3. باز کردن PR؛ merge/`push` به `master` فقط با GO همان تغییر
4. Deploy **فقط روی ایران** و فقط با فایل تأیید:
   - روی VPS: `/opt/taranom/deploy-approval.json` با `commit` (SHA کامل) و `goRef`
   - `TARANOM_DEPLOY_FORCE=1` این گیت را دور نمی‌زند
   - `ssh -p 3031 -i <id_ed25519_taranom_storefront_ir> -o IdentitiesOnly=yes tnadmin@185.213.167.61`
   - سپس `cd /opt/taranom && bash scripts/auto-deploy.sh` یا `sudo systemctl start taranom-autodeploy.service`
5. Health check: API `/v1/health` و در صورت امکان صفحهٔ تکی/عمده

قبل از recreate، worker soft-drain می‌شود (حداکثر ۱۲۰ث؛ در صورت timeout، deploy متوقف و worker کشته نمی‌شود). `stop_grace_period` ورکر ۹۰ث است.

## Commit

- هرگز `.env` commit نشود — فقط `.env.example`
- اسرار در vault/env سرور

## زبان گزارش

- گزارش‌های `docs/` به **فارسی** (مخاطب: تیم و مالک پروژه)
- نام فایل‌ها و commit message به **انگلیسی** (Conventional Commits)
