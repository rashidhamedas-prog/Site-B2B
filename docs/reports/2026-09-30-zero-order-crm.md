# Zero-order CRM desk — TASK-20260930-001

Extends `/admin/customers/marketing` with a **نوله‌ها** tab for registered customers who have no settled purchase. No Salesforce clone. SMS LIVE stays OFF.

## Surfaces

- Admin tab `mtab=zero` + optional `bucket=` aging filter
- `GET /v1/marketing/zero-order` — paginated cohort (enrollment-independent)
- `GET /v1/marketing/activation-stats` — convert windows 30/90d + weekly signup
- `PATCH /v1/customers/:id/marketing/follow-up` — schedule next CALL/SMS
- `POST /v1/marketing/zero-order/backfill` — AdminOnly enroll missing
- Today queue enriched with `priority`, `agingBucket`, `hasCheckoutIntent`
- Templates: `retail.activation.no_buy_3d` / `retail.activation.no_buy_7d` (automation off); wholesale reuses existing nudge templates

## Scoring

Pure helpers in `zero-order-scoring.ts`: aging buckets fresh→recycle; priority 0–100 from recency + open checkout intent + wholesale PENDING + callback/no-call.

## Security

- Admin JWT only; backfill `@AdminOnly`
- Notes HTML-stripped; phone not in outbox payloads (unchanged contract)
- New SMS templates default OFF

## Validation

- `zero-order-scoring.spec.ts` ok
- `admin-customer-workspace.spec.ts` ok
- api + web `tsc --noEmit` exit 0
