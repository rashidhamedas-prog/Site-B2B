# SEO/GEO Decision Report — retail campaign heroes — 2026-09-09

Task: TASK-20260909-013

## Executive outcome

دو بنر کامل (دیجی‌پی و کت پریما/نگین) روی هیرو هوم تکی می‌آیند. اسلاید اول LCP است. متن داخل تصویر روی دسکتاپ تکرار HTML نمی‌شود (`artwork`)؛ همان متن در HTML و `imageAlt` برای خزش، دسترس‌پذیری و موبایل می‌ماند. مقصد لینک‌ها داخل `.ir` است.

## Scope & evidence

- Markets: retail `poshaktaranom.ir`, locale `fa`
- Templates: home hero only
- Access: code + supplied artwork; GSC not queried this run
- Official notes used as local policy: Google image alt / crawlable links / no doorway; project rule that retail copy should not send shoppers to wholesale `.com`

## Baseline

| KPI | definition | period | value | source | limitation |
|---|---|---|---|---|---|
| Hero LCP | only slide 0 `priority` | this change | DigiPay hashed WebP ~54KB | generated assets | lab/field CWV not re-measured |
| CTA honesty | visible offer → same-site URL | this change | `/products` and `/category/women-coats` | code | bitmap still contains «عمده» on slide 2 |

## Findings

| ID | P | Evidence/Inference/Hypothesis | affected scope | evidence | cause/test |
|---|---|---|---|---|---|
| H1 | P1 | Live CMS (`site_contents`) wins over `defaults.ts` | retail home | prior DigiPay migration | migration prepend/replace required |
| H2 | P2 | Baked-in banner text is not crawlable | hero | artwork files 1024×409 | HTML headline/CTA/alt duplicated |

## Architecture (implementation)

- No new service. CMS hero block remains source of truth; admin can edit.
- Assets: WebP 1600×467 (24:7) + mobile left-crop 900×450 (2:1). Hashed filenames for cache bust.
- Slide 0 DigiPay → `/products`. Slide 1 Prima/Negin → `/category/women-coats` (PDPs `coats00011` / `chenille-coat-negin` stay linked via that category).
- Wholesale CTA in the Prima bitmap is not used as the HTML destination, to avoid mixing B2B intent on `.ir`.
- Rollback: migration `down` restores backed-up hero props; old unhashed DigiPay files remain on disk.

## Delivery backlog

| ID | change/spec | owner | effort | risk | acceptance | rollback | KPI/date |
|---|---|---|---|---|---|---|---|
| D1 | This ship | TASK-20260909-011 | S | low | slides + alts + hashed WebP + migration | restore CMS backup | home 200 after deploy |

## QA & release decision

Observed this session:
- `npx tsx src/lib/cms/hero-slides.spec.ts` → OK
- `npx ts-node --transpile-only src/database/retail-campaign-hero.util.spec.ts` → ok
- `apps/web` `tsc --noEmit` → 0
- `apps/api` `tsc --noEmit` → 0

GO for merge/deploy. Field CWV and GSC not re-measured.

## Measurement and next review

After live deploy: confirm `.ir` home HTML contains both alts and `/category/women-coats`. Do not claim index/rank/rich result. Next review after ISR/cache 60s + one hard refresh.
