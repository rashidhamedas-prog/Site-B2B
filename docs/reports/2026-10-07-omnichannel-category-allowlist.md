# Omnichannel auto-publish category allowlist

**Task:** TASK-20261007-003  
**Date:** 2026-10-07  
**Depth:** full (skill-top + ECC + parallel specialists)

## Goal

Only products in admin-selected categories should auto-publish to messenger channels.

## 2026 research folded in

| Source pattern | Applied here |
| --- | --- |
| Master catalog + destination eligibility rules | Shared product catalog; allowlist is automation eligibility, not a second catalog |
| Release gate before publish | `evaluateCategoryAllowlistGate` before auto CREATE / intent |
| Empty allowlist safe deploy | Absent/`[]` = open (LIVE keeps posting until admin selects) |
| Audit skip reason | `autoSyncRemote` returns `category_not_allowed` |
| Manual vs auto | Manual publish stays unrestricted |

Reference repos/patterns considered: Shopify Flow category/tag conditions + publish-to-channel; PIM channel readiness gates (ChannelDock/Cartozo-style eligibility).

## Design

- **Field:** `autoPublishCategoryIds: string[]` on `app_settings` key `omnichannel`
- **Match:** primary `products.categoryId` ∪ `product_category_membership.categoryId`
- **Empty:** no filter
- **Non-empty + miss + no live post:** skip (`category_not_allowed`)
- **Non-empty + miss + live post:** `publishable=false` → existing `withdrawAction`
- **Scope v1:** one list for RETAIL+WHOLESALE; PRODUCT sources only

## Files

- `publication-automation.ts` (+ spec)
- `oos-policy.ts` (+ spec)
- `omnichannel.dto.ts`
- `omnichannel.service.ts` / `omnichannel.module.ts`
- `AdminOmnichannel.tsx` / `admin-omnichannel-ui.tsx`

## Validation

```
publication-automation.spec.ts: ok
oos-policy.spec.ts: ok
```

Security (same session): no medium+ findings; admin-only PATCH; UUID + max 200; connectors unchanged.

## Rollback

Clear `autoPublishCategoryIds` to `[]` via admin save, or remove the key from the jsonb row. No schema migration.

## Non-goals

- Per-channel allowlists
- Parent/child category inheritance
- Blocking manual publish
- Enabling connectors
