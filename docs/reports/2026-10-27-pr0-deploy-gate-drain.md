# PR-0: گیت deploy + خالی‌کردن صف قبل از restart

تاریخ: 2026-10-27  
شاخه: `chore/pr0-deploy-gate-drain`  
مرجع: پرامپت GO حامد (اجرای PR بدون merge/deploy)

## وضعیت خواندنی سرور (ایران)

| مورد | واقعیت |
| --- | --- |
| Timer | `taranom-autodeploy.timer` فعال؛ `OnUnitActiveSec=3min` |
| Service | `ExecStart=/bin/bash /opt/taranom/scripts/auto-deploy.sh` |
| اسکریپت نصب‌شده | با نسخهٔ `master` محتوا یکسان (تفاوت هش محلی به‌خاطر CRLF ویندوز) |
| فایل تأیید | وجود نداشت |
| `stop_grace_period` | روی worker نبود |
| Host node | ندارد؛ `python3` و `jq` دارد → گیت با `deploy-gate.py` |

## تغییرات

1. گیت تأیید `deploy-approval.json` (commit کامل + `goRef`)؛ `FORCE` دور نمی‌زند؛ بعد از موفقیت مصرف می‌شود.
2. لاگ `logs/deploy.log` با commit / زمان / goRef.
3. Soft-drain ورکر قبل از recreate (پرچم `/tmp/omnichannel-worker.drain`، حداکثر ۱۲۰ث؛ timeout → abort بدون کشتن).
4. `stop_grace_period: 90s` برای `worker` و `worker-b`.
5. قاعدهٔ agent: بدون GO نوشتاری حامد push به master / deploy ممنوع.
6. یادداشت در workflow برای required reviewers روی Environment `production` (تنظیم دستی در GitHub).

## نصب روی سرور (GO جدا لازم)

1. Merge فقط وقتی صف ارسال خالی است + GO جدا.
2. کپی/تأیید unitهای `deploy/systemd/taranom-autodeploy.*` در صورت تغییر.
3. نوشتن `deploy-approval.json` قبل از هر deploy واقعی.
4. پیشنهاد: در GitHub → Settings → Environments → `production` → Required reviewers.
