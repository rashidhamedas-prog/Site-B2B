# PR-12 Token vault + egress path (BALE / RUBIKA) — file plan (plan only, no code)

Source: `stage2-design.md` §5.4 (vault pattern) · §6 row PR-12 (re-scoped) · `stage1-requirements.md` REQ-S1 · REQ-S2 (Telegram **deferred**) · `req-technical.md` §3 tokens · `00-CURSOR-MASTER-PROMPT.md` Telegram egress ban · GO حامد ۲۹ اکتبر ۲۰۲۶ — **ARCHITECT ONLY**.

Gate: **CODE** · **independent of PR-11** (parallel OK) · **soft after PR-10** only if health/settings need «configured ✓» fingerprint display · Preferred worktree: `D:/proje/Site-B2B-pr12`.

## 0. Headline finding / re-scope

**Stage2 row PR-12 historically bundled Worker custom domain + `TELEGRAM_API_URL` + vault move for Telegram.** Package `continue-119` / master prompt **rejected** that Telegram work. This GO **reopens PR-12 narrowly:**

| In scope | Out of scope (explicit) |
| --- | --- |
| Harden **BALE** + **RUBIKA** token path: vault-first, scrubber, fingerprint-only admin | Change **`TELEGRAM_API_URL`**, Worker custom domain, Cloudflare Worker, DNS |
| Configurable **egress base URL** for Bale/Rubika (`BALE_API_URL` / `RUBIKA_API_URL`) mirroring `telegramApiBase` shape | Move **`TELEGRAM_BOT_TOKEN`** off env; change Telegram resolve/upload mode |
| Shared **provider-egress** helper + Telegram **structure stub only** (types/comments/tests asserting TG path unchanged) | Enabling connectors / live mass send / FORCE deploy |

Vault already encrypts Bale/Rubika via `omnichannel-token-vault` + `OMNICHANNEL_VAULT_KEY`. Gaps: env fallback still allowed in prod for all providers; API bases hardcoded (`BALE_API` / `RUBIKA_API`) with no audited override; no single egress resolver; Telegram still env-primary — **must stay that way this PR**.

## 1. Invariants

- **HR-2 / master prompt:** Telegram continues to use current `telegramApiBase` → `TELEGRAM_API_URL` (workers.dev or whatever is live). **No edit** to that function’s production behavior, Worker domain, or `TELEGRAM_MEDIA_UPLOAD_MODE` policy.
- **HR-3 / REQ-S1:** tokens never in logs, UI, CSV, errors (even masked); scrubber for `\d+:[A-Za-z0-9_-]{35}` and opaque Rubika tokens in error paths.
- **Vault:** ciphertext only in `omnichannel.secret.vault` settings; AAD bound to `secretRef`; admin shows fingerprint + `updatedAt` only.
- **BALE/RUBIKA production (D-1):** prefer vault overlay; if `OMNICHANNEL_VAULT_STRICT_MESSENGERS=true`, **reject env-only** for `BALE_*` / `RUBIKA_*` secretRefs (Telegram exempt).
- **Connectors stay off in CI;** no new send-enable flags.
- **Do not invent chat IDs** or paste tokens into docs/tests (use fixtures / fake tokens in unit only).

## 2. Existing behavior vs gaps

| Piece | Today | Gap for this PR |
| --- | --- | --- |
| `resolveProviderToken` | vault overlay then `process.env[secretRef]` for all | Prod should not silently use env for BALE/RUBIKA when strict |
| `BALE_API` / `RUBIKA_API` | hardcoded constants | Need optional env base like Telegram (Iran egress / mirror) **without** touching TG |
| Telegram | `TELEGRAM_API_URL` + env token | **Leave alone**; add structural hooks only |
| Admin secrets UI | PUT/DELETE secrets, fingerprint | Ensure BALE/RUBIKA rotate path audited; TG rotate UI may show «فاز تلگرام» disabled |

## 3. Target design (implementer contract)

### 3.1 `provider-egress.ts` (NEW)

```ts
// Conceptual — not code to paste as final
resolveMessengerApiBase(provider: 'BALE' | 'RUBIKA' | 'TELEGRAM', env): string
```

- **BALE:** `BALE_API_URL` if set & valid https URL → else `https://tapi.bale.ai`
- **RUBIKA:** `RUBIKA_API_URL` if set → else `https://botapi.rubika.ir/v3`
- **TELEGRAM:** **delegate unchanged** to existing `telegramApiBase(env)` — no new Telegram env keys; no Worker domain logic

Adapters `bale.adapter.ts` / `rubika.adapter.ts` call `resolveMessengerApiBase` instead of raw constants (constants remain defaults).

### 3.2 Vault policy

| Item | Behavior |
| --- | --- |
| `resolveProviderToken` | Unchanged signature; when strict + provider ∈ {BALE,RUBIKA} + vault miss → `null` (adapter fails closed with `token_missing`, not env leak) |
| Telegram | Always keep current vault-then-env (structure ready: document `TELEGRAM_BOT_TOKEN` vault entry shape; **do not** require vault or clear env) |
| PUT secrets | Existing Owner + goRef; audit fingerprint before/after only |
| Log scrubber | Centralize in `redactProviderError` / shared scrub used by Bale+Rubika paths |

### 3.3 Health / admin (read-only deltas)

- Secret status for BALE/RUBIKA: `source: vault | env | both | none` (existing) — when strict, warn `env_ignored` if both present.
- **Do not** add Telegram egress ping / custom domain cards (PR-1 already shows host-only; leave ping null).

### 3.4 API

No new public routes required. Optional:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `secrets` (existing) | Ensure response never includes plaintext; add `strictMessengers` boolean from env |

## 4. Data model

**No migration required** if vault blob already stores BALE/RUBIKA entries. Optional: none.

## 5. UI

- Minimal: secrets panel copy that Bale/Rubika must be vault-backed when strict; Telegram row note «توکن تلگرام در فاز جدا — مسیر فعلی تغییر نمی‌کند».
- Prefer tiny edit in existing AdminOmnichannel secrets section **or** PR-10 channel settings «configured ✓» — **do not** rebuild wizard.
- Flag: `OMNICHANNEL_VAULT_STRICT_MESSENGERS` (api+worker same value) — document in `.env.example` **without** secret values.

## 6. Files to claim (`file_claims`)

Branch: `feat/omnichannel-pr12-vault-egress-bale-rubika` · worktree **`D:/proje/Site-B2B-pr12`**.

| File | Action |
| --- | --- |
| `apps/api/src/modules/omnichannel/provider-egress.ts` | NEW — resolve BALE/RUBIKA bases; TG delegates to `telegramApiBase` |
| `apps/api/src/modules/omnichannel/provider-egress.spec.ts` | NEW — BALE/RUBIKA override; **assert Telegram base equals `telegramApiBase` and ignores BALE/RUBIKA envs** |
| `apps/api/src/modules/omnichannel/omnichannel-token-vault.ts` | EDIT — only if shared scrub / strict helper belongs here (prefer keep crypto pure) |
| `apps/api/src/modules/omnichannel/omnichannel-token-vault.spec.ts` | EDIT — BALE/RUBIKA encrypt roundtrip; no real tokens |
| `apps/api/src/modules/omnichannel/services/omnichannel-token-vault.service.ts` | EDIT — status `env_ignored` when strict |
| `apps/api/src/modules/omnichannel/adapters/telegram.adapter.ts` | EDIT — **`resolveProviderToken` only** (strict branch for BALE/RUBIKA); **do not change `telegramApiBase` body** |
| `apps/api/src/modules/omnichannel/adapters/bale.adapter.ts` | EDIT — use `resolveMessengerApiBase('BALE')` |
| `apps/api/src/modules/omnichannel/adapters/bale.adapter.spec.ts` | EDIT — base URL override tests |
| `apps/api/src/modules/omnichannel/adapters/rubika.adapter.ts` | EDIT — use `resolveMessengerApiBase('RUBIKA')` |
| `apps/api/src/modules/omnichannel/adapters/rubika.adapter.spec.ts` | EDIT |
| `apps/api/src/modules/omnichannel/adapters/telegram-errors.ts` | EDIT — scrubber hardening if needed |
| `apps/api/src/modules/omnichannel/provider-capabilities.ts` | EDIT — apiBase from resolver (public, no secrets) |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — only if secrets DTO gains `strictMessengers` |
| `apps/api/src/modules/omnichannel/services/omnichannel.service.ts` | EDIT — **minimal** secrets list/put path if status shape changes |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — short Telegram deferred note in secrets UI (conflict-sensitive — keep tiny) |
| `.env.example` | EDIT — `BALE_API_URL`, `RUBIKA_API_URL`, `OMNICHANNEL_VAULT_STRICT_MESSENGERS` (placeholders only) |
| `apps/api/scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr12-vault-egress.md` | EDIT/NEW |

**Do not touch:** Cloudflare Worker project, DNS, `TELEGRAM_API_URL` values in deploy env, `telegram-media.ts` upload mode defaults, media scan (**PR-11**), unanswered alerts (**PR-13**), bots (**PR-14**), SMS, connector CI flags, inventing Instagram/Bale unofficial APIs, moving TG token to vault.

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Strict vault for BALE/RUBIKA | Flag default **false** until Owner confirms vault entries exist on Iran |
| D-2 | Empty `BALE_API_URL` | Fall back to official `tapi.bale.ai` |
| D-3 | Telegram structure-ready | Types + comment + spec lock that `resolveMessengerApiBase('TELEGRAM') === telegramApiBase()`; no PUT force to vault |
| D-4 | Dual source (vault+env) | Prefer vault; log fingerprint-only audit `token_source=vault` |
| D-5 | AdminOmnichannel conflict | Prefer secrets status text only; avoid tab IA fights with PR-10/11 |

## 8. Tests required

1. `provider-egress.spec.ts` — BALE/RUBIKA env override; invalid URL throws; Telegram path identical to `telegramApiBase`.
2. Strict mode: BALE env-only → null token; vault present → token; TELEGRAM env-only still works.
3. Adapter specs: request URL uses overridden base; error redaction has no token substring.
4. Acceptance: changing `BALE_API_URL` in unit test redirects fetch; **no** test mutates `TELEGRAM_API_URL` behavior.

## 9. Must-do vs owner-gated

| Must-do | Owner-gated |
| --- | --- |
| provider-egress + adapter wiring + scrubber + specs | GO before merge/deploy |
| Structure-ready Telegram delegation (unchanged path) | Confirm BALE/RUBIKA vault entries on Iran before enabling strict |
| `.env.example` placeholders | Set `BALE_API_URL` / `RUBIKA_API_URL` only if ops need mirror — **Owner supplies values, not invent in docs** |
| WORKLOG + report | Enable `OMNICHANNEL_VAULT_STRICT_MESSENGERS` |
| | No FORCE / SKIP_DRAIN; no TG Worker/domain work |

## 10. Rollback

Disable strict flag; unset `BALE_API_URL` / `RUBIKA_API_URL` → official defaults. Revert PR. Telegram path never changed → no TG rollback needed.

## 11. Non-goals (hard)

- **`TELEGRAM_API_URL` / Worker domain / Cloudflare / DNS**
- **Moving `TELEGRAM_BOT_TOKEN` from env to vault** (Telegram phase later)
- Media validation (**PR-11**); unanswered alerts (**PR-13**); bots inbound (**PR-14**)
- Connector enable; inventing chat IDs; SMS; secrets in docs

## 12. Sequence / conflicts

0. **Parallel with PR-11**; no hard dep on PR-10.
1. Soft dependency **for PR-13 messenger notify**: PR-13 panel alerts can ship without PR-12; **owner_chat_id push via Bale/Rubika** should land after PR-12 vault/egress harden.
2. **Conflict avoid:** do not rewrite `omnichannel.service.ts` secrets block broadly; do not fight PR-10 channel-settings forms — secrets stay connection/secretRef inventory. Avoid editing `telegramApiBase` (even “cleanup”) — reviewers treat any TG URL diff as out of scope.
