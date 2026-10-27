# PR-0 — توقف auto-deploy بدون تأیید + تخلیه صف worker پیش از restart

**تاریخ:** ۲۰۲۶-۱۰-۲۷ (تهران) · **وضعیت:** فقط طرح؛ هیچ PR، کد، env یا تغییر سروری انجام نشده.
**منبع:** بررسی فقط-خواندنی مخزن `rashidhamedas-prog/Site-B2B` شاخه master.

---

## ۱. سازوکار فعلی (از روی فایل‌های مخزن)

| # | مسیر deploy | جزئیات | تأیید انسانی؟ |
|---|---|---|---|
| A | **systemd timer** `deploy/systemd/taranom-autodeploy.timer` | `OnBootSec=2min`، `OnUnitActiveSec=3min` ← سرویس oneshot `taranom-autodeploy.service` (User=tnadmin، `ExecStart=/bin/bash /opt/taranom/scripts/auto-deploy.sh`، `TimeoutStartSec=1800`) | **خیر** — هر merge به master حداکثر حدود ۳ دقیقه بعد خودکار روی production می‌رود |
| B | **CI** `.github/workflows/ci.yml` job deploy | فقط `workflow_dispatch` روی master/main، `environment: production`، از راه SSH با `TARANOM_DEPLOY_FORCE=1` همان `auto-deploy.sh` را اجرا می‌کند | دستی (dispatch)؛ approval وابسته به تنظیم environment در GitHub (**تأیید نشده**) |
| C | **قاعده Cursor** `.cursor/rules/auto-deploy.mdc` (alwaysApply) | به agentها می‌گوید بعد از هر تغییر خودشان push و deploy کنند | **خیر** — با قاعده GO حامد تعارض مستقیم دارد |

**مراحل `scripts/auto-deploy.sh`:**
1. `flock` روی `/tmp/taranom-autodeploy.lock` (جلوی اجرای هم‌زمان را می‌گیرد).
2. `git fetch` و مقایسه HEAD با `origin/master`؛ اگر برابر بود خارج می‌شود (مگر `TARANOM_DEPLOY_FORCE=1`).
3. `git reset --hard origin/master` و اجرای دوباره خودش با `TARANOM_DEPLOY_BUILD=1`.
4. source کردن `.env`، سپس `docker compose build api web worker` و `up -d`.
5. توقف `worker-b`، و ساخت دوباره nginx با `--force-recreate`.
6. health check روی `localhost:4000/v1/health`، ۲۴ بار با فاصله ۵ ثانیه.
7. در پایان prune.
8. **هیچ مرحله drain صف ندارد.**

**worker:**
- سرویس `worker` در docker-compose: کانتینر `taranom_worker`، `restart: unless-stopped`، با `node dist/worker.main`، healthcheck از heartbeat `/tmp/omnichannel-worker.heartbeat`.
- **`stop_grace_period` ندارد**، پس پیش‌فرض ۱۰ ثانیه Docker اعمال می‌شود و بعد SIGKILL.
- `worker.main.ts` تابع `enableShutdownHooks` را صدا می‌زند، اما `onModuleDestroy` در `outbox-worker.service.ts` فقط interval دوثانیه‌ای را پاک می‌کند و **منتظر tick در حال اجرا نمی‌ماند**.
- ارسال روبیکا تا حدود ۴۵ ثانیه طول می‌کشد. پس restart در میانه ارسال، رکورد را PROCESSING/نامعلوم رها می‌کند و خطر **ارسال تکراری یا HOLD** دارد.

**تأییدنشده‌ها (باید روی سرور با دسترسی خواندنی و GO دیده شوند):**
- آیا timer روی سرور واقعاً `enabled/active` است (`systemctl list-timers`). این از فایل‌های مخزن و سند فنی استنباط شده است.
- آیا نسخه نصب‌شده unit و اسکریپت در `/opt/taranom` با مخزن یکی است.
- آیا environment «production» در GitHub reviewer اجباری دارد.
- آیا `worker-b` جای دیگری روشن می‌شود.

## ۲. تغییر پیشنهادی

1. **deploy فقط با تأیید دستی:**
   - timer فقط `fetch` می‌کند و اگر commit جدید بود اعلان می‌دهد (log و در صورت تمایل پیام به کانال ادمین)، ولی **build نمی‌کند**.
   - build فقط وقتی انجام می‌شود که فایل `/opt/taranom/.deploy-approved` وجود داشته باشد و محتوایش `SHA=<commit دقیق>` و `GO=<مرجع تأیید حامد>` باشد.
   - SHA باید با `origin/master` برابر باشد، وگرنه رد می‌شود.
   - فایل بعد از مصرف حذف می‌شود و رکوردی با زمان، SHA، GO و نتیجه در `/opt/taranom/deploy.log` ثبت می‌شود.
   - `TARANOM_DEPLOY_FORCE=1` دیگر نمی‌تواند از شرط تأیید عبور کند.
   - **گزینه ساده‌تر:** timer را کلاً disable کنیم و deploy فقط از مسیر CI انجام شود، با reviewer اجباری روی environment.
2. **قفل deploy:** پنجره ممنوع، مثلاً هنگام انتشار گروهی یا وجود رکورد PROCESSING. مقدار آن در D10 باز است.
3. **drain صف پیش از restart:**
   - پیش از build/up، اسکریپت فلگ drain را ست می‌کند، با فایل یا ردیف DB، تا worker ادعای (claim) کار جدید را متوقف کند.
   - بعد منتظر می‌ماند تا PROCESSING به صفر برسد، حداکثر ۱۲۰ ثانیه.
   - سپس `docker compose stop worker` اجرا و بعد build/up انجام می‌شود.
   - بعد از سالم بودن health، فلگ drain برداشته می‌شود.
   - در کد worker، `onModuleDestroy` منتظر tick در حال اجرا می‌ماند (Promise جاری) و در این مدت claim جدید نمی‌گیرد.
   - در compose، `stop_grace_period: 90s` به سرویس worker اضافه می‌شود.
   - اگر drain به timeout برسد، deploy **متوقف** می‌شود (نه kill) و گزارش می‌دهد.
4. **قاعده Cursor:** متن `.cursor/rules/auto-deploy.mdc` عوض می‌شود به: «هیچ push به master یا deploy بدون GO کتبی حامد؛ فقط شاخه و PR».

## ۳. فایل‌های اثرپذیر
| فایل | تغییر |
|---|---|
| `scripts/auto-deploy.sh` | شرط approval-file، حذف bypass با FORCE، drain، log |
| `deploy/systemd/taranom-autodeploy.service` / `.timer` | حالت فقط اعلان (یا حذف timer) |
| `.github/workflows/ci.yml` | ارسال SHA/GO به اسکریپت؛ پیشنهاد reviewer اجباری |
| `docker-compose*.yml` (سرویس worker) | `stop_grace_period: 90s` |
| `apps/api/src/.../outbox-worker.service.ts` | فلگ drain و صبر برای tick جاری در `onModuleDestroy` |
| `.cursor/rules/auto-deploy.mdc` | حذف دستور deploy خودکار |
| `docs/deploy.md` (جدید) | روال GO → approval file → deploy |

## ۴. ریسک‌ها
- **merge همین PR خودش deploy می‌شود**، چون timer فعلی هنوز خودکار است. اولین deploy با همان سازوکار قدیمی انجام می‌شود (بدون drain). پس باید در زمان خالی بودن صف merge شود.
- اگر اسکریپت جدید باگ داشته باشد، deploy ممکن است گیر کند. این مشکل امنیتی نیست، ولی تحویل اصلاحات را عقب می‌اندازد.
- با drain طولانی، deploy تا ۲ دقیقه کندتر می‌شود.
- فایل‌های سرور در `/opt/taranom` با `git reset --hard` بازنویسی می‌شوند. اما unit نصب‌شده در `/etc/systemd` با merge عوض **نمی‌شود** و نصب دستی لازم دارد.

## ۵. بازگشت (Rollback)
1. revert همان commit روی master. فقط با GO، چون revert هم deploy می‌شود.
2. در حالت اضطراری روی سرور: `systemctl stop taranom-autodeploy.timer`، یا بازگرداندن unit قبلی و `systemctl daemon-reload`.
3. برای deploy دستی تأییدشده: ساخت approval file با SHA مورد نظر.
4. حذف `stop_grace_period` بی‌خطر است.

## ۶. طرح تست
1. **محلی/staging:** commit جدید بدون approval file باید **build نشود** و فقط log ثبت شود. با approval file دارای SHA غلط باید رد شود. با SHA درست باید deploy انجام شود و فایل حذف شود.
2. `TARANOM_DEPLOY_FORCE=1` بدون approval باید رد شود.
3. **drain:** یک ارسال ساختگی ۶۰ ثانیه‌ای (mock) در PROCESSING، سپس deploy. انتظار: worker تا پایان ارسال صبر کند، رکورد SUCCEEDED شود و بعد restart انجام شود. بدون تکرار و بدون HOLD.
4. **timeout در drain:** deploy متوقف شود و worker قدیمی همچنان کار کند.
5. `docker compose stop worker` در میانه tick: لاگ «drained» پیش از ۹۰ ثانیه.
6. ارسال روی canary پس از deploy (با GO).
7. بازبینی `.cursor/rules`: agent دیگر دستور deploy ندارد.

## ۷. چه چیزی GO حامد می‌خواهد
| اقدام | GO؟ |
|---|---|
| نوشتن این طرح | خیر (انجام شد) |
| **ساخت شاخه و PR** (تغییر کد در GitHub) | **بله — GO ۱** |
| **merge به master** | **بله — GO ۲**. با timer فعلی، merge یعنی deploy به production. زمان merge با صف خالی هماهنگ شود |
| **تغییر سرور**: نصب unit جدید، `daemon-reload`، disable/enable timer، بررسی `systemctl list-timers` | **بله — GO ۳ جدا** |
| فعال‌کردن reviewer اجباری روی environment در GitHub | بله (تنظیم مخزن) |
| deployهای بعدی | هرکدام GO و approval file با SHA |

**ترتیب پیشنهادی:** GO۳-الف (فقط خواندن وضعیت timer روی سرور) ← GO۱ (PR) ← بازبینی ← GO۲ (merge در صف خالی) ← GO۳-ب (نصب unit جدید) ← تست canary.
