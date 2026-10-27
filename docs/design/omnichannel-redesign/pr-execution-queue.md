# صف اجرای PRهای بازطراحی (پس از PR-0 و drain-resume)

منبع: `stage2-design.md` + `00-CURSOR-MASTER-PROMPT.md` · GO حامد ۲۷ اکتبر ۲۰۲۶

**رد:** PR-0 (انجام‌شده) · PR-12 Worker domain/vault/`TELEGRAM_API_URL`  
**آخر:** PR-14 ربات‌ها  
**در پرواز:** Drain-resume → [PR #113](https://github.com/rashidhamedas-prog/Site-B2B/pull/113) · Health → شاخه `feat/omnichannel-health-readonly` · طرح: `pr1-health-plan.md`

| # | PR | ریسک | depends | parallel_prep | gate |
|---|---|---|---|---|---|
| 0 | Drain-resume (#113) | med | PR-0 | — | CODE |
| 1 | Health read-only | low | drain | yes | CODE |
| 2 | Status UI | low | PR-1 | yes | CODE |
| 3 | Idempotency | high | PR-2 | yes (draft) | CODE + DB backup owner |
| 4 | HOLD on unknown | med | PR-3 | yes | CODE |
| 5 | Cap/quiet at claim | low | PR-4 | yes | CODE |
| 6 | Audit + roles | med | PR-5 | yes | CODE |
| 7 | Delete/Edit + backup | high | PR-6 | yes | CODE; canary delete owner |
| 8 | Coverage matrix | low | PR-7 | yes | CODE |
| 9 | Composer | med | PR-8 soft | yes | CODE; bulk Owner+GO |
| 10 | Channel settings + templates | med | PR-9 | yes | CODE; LIVE values owner |
| 11 | Media validation | low | PR-10 soft | yes | CODE |
| 12 | Alerts (PR-13) | low | PR-11 | yes | CODE; chat ids owner |
| 13 | Refactor god-service (PR-15) | med | PR-13 | no | CODE |
| 14 | Bots (PR-14) | med | soak | docs only | owner secrets + CODE |

جزئیات فایل‌کلیم PR-1: معمار در handoff / پاسخ ایجنت architect.
