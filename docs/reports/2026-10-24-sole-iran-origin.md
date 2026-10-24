# مبدأ تولید واحد ایران — بازنشستگی هتزنر از دیپلوی

- تاریخ: `2026-10-24`
- تسک: `TASK-20261024-003`
- عمق: skill-top کامل

## حکم

فروشگاه زنده از قبل روی ایران (`185.213.167.61`) بود؛ مسیر دیپلوی عامل‌ها و CI هنوز هتزنر (`5.75.200.102`) را هدف می‌گرفت. این کار ایران را **تنها** مبدأ تولید رسمی کرد، بکاپ زمان‌بندی‌شده روی ایران نصب کرد، و هتزنر را از دیپلوی/سرویس قرنطینه کرد.

## تغییرات ریپو

| حوزه | تغییر |
| --- | --- |
| قوانین Cursor | `sole-iran-origin.mdc` + بازنویسی `auto-deploy.mdc` |
| CI | defaults → `185.213.167.61` / `tnadmin` / `3031` |
| systemd | `taranom-autodeploy.service` → `User=tnadmin` |
| Runbook / conventions / edge / blog deploy | SSH و origin ایران |
| بکاپ | `scripts/install-postgres-backup-cron.sh` |
| قرنطینه DE | `scripts/decommission-hetzner-origin.sh` |
| E2E | denylist شامل IP ایران + هتزنر |

## وابستگی ایران → آلمان

بررسی روی ایران: `SMS_EGRESS_BASE_URL` خالی؛ هیچ ارجاعی به `5.75.200.102` در `.env` / compose؛ استک فقط کانتینرهای محلی. وابستگی runtime به آلمان یافت نشد.

## Ops (اجرا در همان جلسه)

| گام | نتیجه |
| --- | --- |
| GitHub secrets `VPS_*` | به ایران (`185.213.167.61` / `3031` / `tnadmin` + کلید storefront) |
| ایران `usermod -aG docker tnadmin` | انجام شد |
| بکاپ | cron `/etc/cron.d/taranom-postgres-backup`؛ one-shot `20261024T081607Z` با `pg_restore_list=ok` (~2.1MB) |
| autodeploy ایران | timer `enabled` + `active` با `User=tnadmin` |
| وابستگی IR→DE | `SMS_EGRESS_BASE_URL=` خالی؛ بدون ارجاع IP هتزنر در `.env`/compose |
| هتزنر | `docker compose down`؛ autodeploy `disabled`/`inactive`؛ ۰ کانتینر در حال اجرا؛ marker `/etc/taranom/HETZNER_DECOMMISSIONED` |
| Smoke زنده | `poshaktaranom.com` 200، `www.poshaktaranom.ir` 200، `api.../v1/health` ok |

## نکات ops اضافه‌شده حین اجرا

- درخت `/opt/taranom` ایران تا این کار `.git` نداشت؛ با کلید `github_deploy` منتقل‌شده از هتزنر، `git init` + `fetch/reset` به `origin/master` انجام شد (`.env` حفظ شد).
- یونیت systemd اول با `User=wholesale-admin` شکست می‌خورد (`status=217`)؛ به `tnadmin` اصلاح شد.
- استک هتزنر یک‌بار بعد از قرنطینه دوباره دیده شد → `compose down` مجدد + `systemctl mask` برای timer/service.

## باقی‌ماندهٔ انسانی

- **حذف فیزیکی VM هتزنر** از کنسول Hetzner Cloud (CLI محلی `hcloud` موجود نبود). استک خاموش و autodeploy mask است.
- بکاپ off-box / MinIO زمان‌بندی‌شده هنوز follow-up است (فقط Postgres روزانه در این کار).

## Rollback

بازگرداندن DNS به هتزنر بدون sync داده از ایران **ممنوع** است (گزارش `seo-day-05-server-rollback-readiness.md`). Rollback عملیاتی = اصلاح قوانین/CI به ایران + روشن نگه‌داشتن استک ایران.
