# Sales-partner `PENDING_OTP` status label (TASK-20261007-005)

## Problem

Admin `/admin/sales-partners` showed the raw enum `PENDING_OTP` on application cards while other statuses used Persian badges (e.g. «تأیید شده»).

## Root cause

- Application lifecycle includes `PENDING_OTP` (OTP apply flow; open-application index).
- Web map `SP_APP_STATUS_FA` / `spAppStatusLabel` covered review/approved/rejected but **omitted** `PENDING_OTP` (and `CANCELLED`).
- Fallback was `|| status`, so the badge rendered the English code.
- API list/detail did not emit `statusLabel` for applications (unlike partner profiles).

## Fix (architecture-aligned)

1. **API policy** — `SALES_PARTNER_APPLICATION_STATUSES` + `humanApplicationStatus()` as the server source of truth.
2. **API admin payloads** — `listApplications` / `getApplication` include `statusLabel`.
3. **Web** — exhaustive `SP_APP_STATUS_FA` (`satisfies Record<SpApplicationStatus, string>`), aliases (`NEED_INFO`), tone for `PENDING_OTP`, `spAppStatusLabel(status, apiLabel)` ignores raw echo.
4. **Admin UX** — filter chip «منتظر OTP», amber hint on card/drawer; review actions stay gated (not reviewable until OTP completes).

## Validation

- `apps/api`: `npx ts-node --transpile-only src/modules/sales-partner/sales-partner-policy.spec.ts` → **OK**
- `apps/web`: `sp-labels.spec.ts` via api `ts-node` → **OK**
- Lint on touched files: clean

## Non-goals

- Changing OTP send/verify behavior
- Auto-approving or moving `PENDING_OTP` rows into the admin review inbox
