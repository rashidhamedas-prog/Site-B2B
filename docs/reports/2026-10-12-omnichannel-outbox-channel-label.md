# Outbox channel mislabel (sales_partner → تکی)

## Symptom

Admin `/admin/omnichannel` queue showed `sales_partner.*` rows labeled **تکی** while the operator only configured wholesale messenger destinations.

## Root cause

1. Shared `omnichannel_outbox_events` mixes messenger publish, SMS/marketing, search, and sales-partner domain events.
2. `SalesPartnerService.emit` stamped `channel: 'RETAIL'` even though these events are not messenger storefront work.
3. Worker lease list did not include `sales_partner.*`, so rows stayed **PENDING** forever.
4. UI `channelLabel(row.channel)` mapped any `RETAIL` to «تکی», which operators read as a Telegram destination.

## Fix

| Layer | Change |
|-------|--------|
| Emit | `channel: null` for sales-partner outbox events |
| Lease + worker | Lease + ACK `sales_partner.*` (audit already written at emit) |
| UI | Domain labels (همکار / پیامک / سیستم); channel-scope filters by configured bot channels |
| Clear waiting | Default `scope=channel` so SMS/search/partner rows are not cancelled from the publish console |

## Validation

- `bulk-requeue-category.spec`, `outbox-lease.spec`, `outbox.service.spec`, `omnichannel-phase-acceptance.spec`
- `admin-omnichannel-outbox-label.spec.ts`
