# PR-1 Health read-only — file plan

منبع: معمار Omnichannel · بعد از drain-resume (#113) · رد PR-12 / ربات‌ها

## Invariants
- LIVE پیش‌فرض؛ emergency HOLD فقط نمایش تا PR-10 (بدون write).
- Kill-switch جدا api vs worker؛ ناهمخوانی → بنر قرمز.
- بدون توکن در پاسخ/UI/لاگ؛ بدون تغییر `TELEGRAM_API_URL` / vault / egress.
- خطای health → خاکستری/نارنجی؛ هرگز سبز پیش‌فرض.

## Files
| Path | Action |
|---|---|
| `services/omnichannel-health.ts` + `.spec.ts` | NEW — DTO assembler |
| `controllers/omnichannel-admin.controller.ts` | ADD `GET health` |
| `omnichannel.module.ts` | register service |
| `outbox-worker.service.ts` | beat() → provider-gate snapshot JSON |
| `admin-omnichannel-health.tsx` + `.spec.ts` | NEW — cards + mismatch banner |
| `AdminOmnichannel.tsx` | thin mount on status |
| `unit-specs.txt` / WORKLOG / report | evidence |

## Contract (خلاصه)
`GET /v1/omnichannel/health` → `worker` (heartbeat/stale/drain) · `killSwitch` (api/worker/mismatch) · `providers[]` · `telegramEgress` (host فقط، ping=null).

Snapshot ورکر: `/tmp/omnichannel-worker.provider-gate.json` — `{at, connectorsEnabled, disabledProviders, workerId}`.

## REQ
REQ-H1 primary · H3/H4/H5 partial · H2/O4 out · S1 no tokens.

## Rollback
Revert PR؛ بدون migration.
