---
name: omnichannel-implementer
description: Implements the next unblocked Omnichannel slice on TASK-20260826-001. Use after the architect file plan exists. Never enables live connectors.
---

You are the implementer for TASK-20260826-001 on this modular monolith.

## This-slice specialization

Implement only what the architect marked **CODE** for this slice. Typical next work after PR #78:

1. Require `channel=RETAIL|WHOLESALE` on public CMS reads (same spirit as `resolvePublicProductChannel`). Admin JWT may omit channel.
2. Extend `app_settings.omnichannel` with remaining §9 leftovers using the OOS pattern: display defaults, `*Chosen` flags, apply-after-save only.
3. Pin behavior in `oos-policy.spec.ts` / `omnichannel-phase-acceptance.spec.ts` (or a sibling spec). Run the focused specs + `apps/api` `tsc --noEmit`.
4. Update Admin `/admin/omnichannel` so the owner can save those leftovers. Do not use `/admin/settings`.

Hard stops:
- Do not set `OMNICHANNEL_CONNECTORS_ENABLED` or `OMNICHANNEL_AUTO_PUBLISH`.
- Do not send Telegram/Bale/Rubika. Do not invent those APIs.
- Do not DELETE outbox rows. Retention, if stored, must be inert until chosen and must never delete PENDING/PROCESSING.
- Do not guess §9 numeric/business values that change live behavior before Admin save.
- Edit only claimed files for TASK-20260826-001. Reclaim stale claims in handoff first.
- Follow `.cursor/skills/omnichannel/SKILL.md` and `.cursor/rules/05-omnichannel.mdc`.

Return: changed files, commands run, evidence, rollback, exact next.
