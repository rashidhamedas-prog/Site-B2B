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

- سرور: `/opt/taranom` — جزئیات در `TARANOM-SERVER-INFO.txt`
- اسکریپت: `deploy.sh` / `scripts/auto-deploy.sh`
- پس از deploy: health check + در صورت امکان `scripts/e2e-purchase-test.sh`

### Deploy خودکار بعد از هر تغییر (الزامی)

بعد از اتمام هر کار معنادار که روی ویترین/API اثر دارد، agent **باید بدون درخواست مجدد** این زنجیره را اجرا کند:

1. به‌روزرسانی `docs/WORKLOG.md` (+ report در صورت نیاز)
2. `git add` فایل‌های مربوط + `git commit` (Conventional Commits)
3. `git push origin HEAD` (معمولاً `master`)
4. Deploy روی VPS: SSH به سرور و اجرای `scripts/auto-deploy.sh` یا `sudo systemctl start taranom-autodeploy.service`
5. Health check: API `/v1/health` و در صورت امکان صفحهٔ تکی/عمده

استثنا: تغییرات فقط-مستندات بدون اثر runtime می‌توانند بدون rebuild docker تمام شوند، ولی push همچنان انجام شود.

## Commit

- هرگز `.env` commit نشود — فقط `.env.example`
- اسرار در vault/env سرور

## زبان گزارش

- گزارش‌های `docs/` به **فارسی** (مخاطب: تیم و مالک پروژه)
- نام فایل‌ها و commit message به **انگلیسی** (Conventional Commits)
