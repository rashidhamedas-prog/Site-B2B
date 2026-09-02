# §9 leftovers (do not guess live values)

Source residual after PR #78 (`docs/reports/2026-09-01-omnichannel-admin-channel-settings.md`):

| Leftover | Storage pattern | Live apply |
|---|---|---|
| Retail/Wholesale OOS | `app_settings.omnichannel` + `*OosChosen` | Only after Admin save |
| Telegram canary | destination `settings.isCanary` | Unset → enqueue 0 |
| Pack MOQ | product `minOrderQty` already on projection | Do not invent a second MOQ |
| Which edits auto-publish | allowlist in same settings blob + `*Chosen` | Inert until chosen **and** flag on |
| Retry SLA | seconds in same blob + `*Chosen` | Unchosen keeps current backoff |
| CMS public routes | require `channel` like products | Code isolation, not a numeric guess |
| Blog public routes | require `channel` like products/CMS | Code isolation, not a numeric guess |
| Retention | days in same blob + `*Chosen` | Never delete PENDING/PROCESSING |

Default display values are allowed. Changing worker/delivery without `*Chosen` is a defect.
