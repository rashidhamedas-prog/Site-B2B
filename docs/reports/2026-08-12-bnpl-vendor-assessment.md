# BNPL Vendor Assessment (Phase 5) — blocked pending contracts

**Date:** 2026-08-12  
**Rule:** Naming a provider ≠ integration. No live adapters without APPROVED contract + official API docs + sandbox credentials.

| Provider | Score (provisional /100) | Status | Notes |
|----------|--------------------------|--------|-------|
| SnappPay | N/A | **BLOCKED** | Skeleton DISABLED; await official Merchant API |
| DigiPay | N/A | **BLOCKED** | Same |
| Tara | N/A | **BLOCKED** | Same |
| AzkiVam | N/A | **BLOCKED** | Same |

Scoring weights (when docs arrive): security 25, API/docs 15, settlement/refund 15, reliability 15, commercial fit 15, support 10, implementation cost 5.

Registry rows exist in `payment_providers` with `enabled=false`, `contractStatus=NOT_STARTED`. Checkout eligibility excludes them.
