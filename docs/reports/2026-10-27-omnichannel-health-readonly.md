# 2026-10-27 — Omnichannel PR-1 Health read-only

## Scope
Read-only admin health for کانال انتشار after drain-resume. GO حامد ۲۷ اکتبر ۲۰۲۶ for the redesign package; this PR does **not** merge/deploy.

## Delivered
- `GET /v1/omnichannel/health` (same JWT/admin guards as status)
- Worker `beat()` writes `/tmp/omnichannel-worker.provider-gate.json` (or env sibling) with `{at, connectorsEnabled, disabledProviders, workerId}` — no secrets
- Admin strip: provider cards + red mismatch banner (Persian: تست موفق ولی ارسال واقعی ممکن است DEAD شود)
- `emergencyHold` always `false` until PR-10; no HOLD write; no connector enable; no Telegram egress/vault/`TELEGRAM_API_URL` change

## Branch
`feat/omnichannel-health-readonly` (from `fix/omnichannel-drain-resume`)

## Tests
- `npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-health.spec.ts`
- `npx tsx apps/web/src/components/admin/admin-omnichannel-health.spec.ts`
- `apps/api` / `apps/web` `tsc --noEmit`

## Rollback
Revert the feature branch / PR. Snapshot file absence = worker unknown (safe). No migration.

## Ops note (post-deploy, no live send)
To verify mismatch: set `OMNICHANNEL_DISABLED_PROVIDERS` only on the worker process → refresh `/admin/omnichannel` → red banner; clear env → banner clears.
