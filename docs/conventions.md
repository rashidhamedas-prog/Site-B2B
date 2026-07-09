# قراردادهای توسعه — ترنم B2B

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
- اسکریپت: `deploy.sh`
- پس از deploy: health check + در صورت امکان `scripts/e2e-purchase-test.sh`

## Commit

- هرگز `.env` commit نشود — فقط `.env.example`
- اسرار در vault/env سرور

## زبان گزارش

- گزارش‌های `docs/` به **فارسی** (مخاطب: تیم و مالک پروژه)
- نام فایل‌ها و commit message به **انگلیسی** (Conventional Commits)
