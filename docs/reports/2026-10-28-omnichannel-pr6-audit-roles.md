# 2026-10-28 — Omnichannel PR-6: Audit + roles

**شاخه:** `feat/omnichannel-pr6-audit-roles` (از `origin/master` = `158f0fd6`، شامل PR-5 #126) · **Merge/Deploy:** فقط با GO نوشتاری حامد · برنامه: `docs/design/omnichannel-redesign/pr6-audit-roles-plan.md` · GO package: `cursor-continue-119-to-end` 2026-10-28 (open PR authorized; parent merges/deploys).

## خلاصه

Audit از قبل بخشی داشت؛ RBAC نداشت. این PR ستون‌های `goRef`/`source`، تریگر append-only، نقش‌های VIEWER/PUBLISHER/OWNER پشت `OMNICHANNEL_RBAC_ENABLED` (پیش‌فرض خاموش)، GO-ref برای Owner-tier از جمله **requeue-by-category زنده**، و audit برای CRUDهای بی‌صدا را اضافه می‌کند — بدون egress/vault/SMS/کانکتور زنده.

## تغییرات

| # | تغییر | فایل |
| --- | --- | --- |
| 1 | Migration additive: `goRef`, `source` default `panel`, `users.omnichannelRole`, trigger UPDATE/DELETE → exception | `20261028-002-omnichannel-audit-rbac.ts` |
| 2 | ماتریس خالص + resolve نقش (allowlist `OMNICHANNEL_OWNER_USER_IDS`) | `omnichannel-rbac.ts` |
| 3 | `OmnichannelAdminGuard` → `omnichannelRole`؛ `OmnichannelRoleGuard` + `@OmnichannelMinRole` / `@RequiresGoRef` / `@OmnichannelOwnerWhenLive` | guards + decorators + controller |
| 4 | `audit()` با `goRef`/`source`؛ listAudits برمی‌گرداند goRef/source + payload خلاصه‌شده | `omnichannel.service.ts` |
| 5 | Audit برای create/patch connection/destination/template و media alt | همان |
| 6 | Owner+goRef روی live requeue (گارد + دفاع در سرویس) | controller + service |
| 7 | `.env.example` برای flag + allowlist (commented، پیش‌فرض خاموش) | `.env.example` |

## Migration / backup gate

- **Migration yes:** `20261028-002-omnichannel-audit-rbac` (additive nullable columns + default `source` + optional role column + append-only trigger).
- Plan §6: **no full dump required** for additive nullable columns + trigger only; still follow Iran ops baseline — list a recent Postgres dump under `/var/backups/taranom` (or run `scripts/backup-postgres.sh`) **before** applying migrate on production.
- This agent does **not** deploy or run migrate on Iran. Parent/owner: GO → backup listable → migrate → restart api → leave `OMNICHANNEL_RBAC_ENABLED` unset/false until allowlist mapped.
- `down()` only on disposable DB.

## تست

- جدید/به‌روز: `omnichannel-rbac.spec.ts`, `omnichannel-role.guard.spec.ts`, `omnichannel-admin.guard.spec.ts`, `20261028-002-omnichannel-audit-rbac.spec.ts`, `omnichannel-phase-acceptance.spec.ts` (رشته‌های گارد Owner/goRef/requeue)
- ثبت در `apps/api/scripts/unit-specs.txt`
- `tsc --noEmit` در `apps/api` (+ `apps/web` اگر لازم)

## Rollback

`OMNICHANNEL_RBAC_ENABLED=false` (یا unset) → هر ADMIN مثل قبل. ستون‌ها/تریگر بی‌ضرر می‌مانند.

## غیرهدف

egress/PR-12، vault، SMS، PR-14 bots، mass DEAD retry، FORCE، live channel posts، UI redesign (PR-10).
