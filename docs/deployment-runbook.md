# Deployment Runbook — پوشاک ترنم (Retail + Wholesale)

Executable ops guide for this repository. Derived from evidenced scripts and configs only. **Never paste secret values into tickets, chat, or this file.**

| Field                  | Value                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| App dir (VPS)          | `/opt/taranom`                                                                                                 |
| Primary branch         | `master` (also accepts `main` in some scripts)                                                                 |
| Compose file           | `docker-compose.yml`                                                                                           |
| Auto-deploy            | `scripts/auto-deploy.sh` + `deploy/systemd/taranom-autodeploy.{service,timer}`                                 |
| Manual bootstrap       | `deploy.sh`, `scripts/redeploy-server.sh`                                                                      |
| CI                     | `.github/workflows/ci.yml` (`lint-and-build`; `deploy` only on `workflow_dispatch` + `production` environment) |
| Public wholesale       | `https://poshaktaranom.com`                                                                                    |
| Public retail          | `https://www.poshaktaranom.ir` (apex redirects to www)                                                         |
| Public API             | `https://api.poshaktaranom.com`                                                                                |
| Admin UI               | `/admin` on the web app (via storefront host)                                                                  |
| Health (authoritative) | `GET /v1/health` on API (container port `4000`)                                                                |

**Production actions below marked ⛔ HUMAN AUTHORIZATION REQUIRED must not be executed by an agent without explicit human approval for that change window.**

---

## 0. Release readiness checklist

Complete before any production deploy:

1. **Artifact / commit** — record `git rev-parse HEAD` and short SHA that will be on `origin/master`.
2. **Lockfile** — `package-lock.json` present; CI uses `npm ci`.
3. **Config keys present (values never recorded here)** — at minimum from `.env.example` / `deploy.sh` checks:
   - `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`
   - `REDIS_PASS`
   - `JWT_SECRET`
   - `MEILI_MASTER_KEY`
   - `MINIO_USER`, `MINIO_PASS`, `MINIO_BUCKET`
   - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_RETAIL_URL`
   - Payment/SMS/Telegram/CRM keys as required by the release (`ZARINPAL_*`, `IDPAY_*`, `SMS_*`, `TELEGRAM_*`, `CRM_API_KEY`)
   - `DB_SYNC` must be `false` in production (TypeORM `migrationsRun` when `NODE_ENV=production` and `DB_SYNC` ≠ `true`)
4. **Environment parity** — production `.env` lives only on the VPS (`/opt/taranom/.env`, mode `600`). Do not commit it.
5. **Migrations / backfills** — list pending TypeORM migrations under `apps/api`; note whether release needs expand-only schema. Idempotent safety-net: `scripts/apply-production-schema.sql`.
6. **Feature flags / sandbox** — confirm `ZARINPAL_SANDBOX` and payment callback URLs match intended environment.
7. **Third-party** — SMS, payment gateways, Telegram: smoke in sandbox or non-destructive check only.
8. **Capacity / monitoring owner / window / comms** — name on-call owner, deploy window, and stakeholder notice.
9. **Backup status** — see §2. Do not proceed with data-affecting release until a usable checkpoint exists (or an accepted exception is recorded in handoff).

---

## 1. Preflight (baseline)

### 1.1 Local / CI (no production impact)

```bash
# From repo root
git status
git rev-parse --short HEAD

npm ci
# Gates mirrored by CI (.github/workflows/ci.yml):
npx --yes ts-node --transpile-only src/modules/auth/auth.otp.logic.spec.ts   # cwd: apps/api
npx tsc --noEmit   # apps/web
npx tsc --noEmit   # apps/api
npm run build      # apps/web (NEXT_PUBLIC_API_URL set for build)
npm run build      # apps/api
```

Optional local stack (README):

```bash
cp .env.example .env   # fill locally; never commit
docker compose up postgres redis minio minio-init meilisearch -d
# API / web in dev as documented in README.md
```

### 1.2 Production baseline — ⛔ HUMAN AUTHORIZATION REQUIRED

SSH (public host/port/user are already documented; key is a secret — do not print key material):

```bash
ssh -i <path-to-deploy-key> -p 2222 wholesale-admin@5.75.200.102
cd /opt/taranom
git rev-parse HEAD
git log -1 --oneline
docker compose ps
curl -sf http://localhost:4000/v1/health; echo
curl -sf -o /dev/null -w "web %{http_code}\n" http://localhost:3000
curl -sf -o /dev/null -w "wholesale %{http_code}\n" https://poshaktaranom.com/
curl -sf -o /dev/null -w "retail %{http_code}\n" https://www.poshaktaranom.ir/
```

Record baseline HTTP codes and API health JSON (no tokens). Optionally note approximate TTFB for home pages (performance-first).

Stop auto-deploy during risky windows:

```bash
sudo systemctl stop taranom-autodeploy.timer
# re-enable after verify: sudo systemctl start taranom-autodeploy.timer
```

---

## 2. Backup / checkpoint

### 2.1 Evidence status

| Capability                                                                       | Status                 | Evidence                                                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Named Docker volumes (`postgres_data`, `redis_data`, `minio_data`, `meili_data`) | Evidenced              | `docker-compose.yml`                                                                                                           |
| `.env` copy during redeploy                                                      | Evidenced              | `scripts/redeploy-server.sh` → `/tmp/taranom.env.bak`                                                                          |
| Ad-hoc `pg_dump` / `pg_restore -l` verification                                  | Historically practiced | `docs/reports/2026-07-11-server-redeploy.md`, `docs/reports/2026-08-01-production-hardening-history-rewrite.md`                |
| Checked-in automated backup cron / off-box sync                                  | **PARTIAL**            | `scripts/backup-postgres.sh` + `/etc/cron.d/taranom-postgres-backup` (2026-08-10). Off-box sync still open                     |
| Documented restore procedure with RPO/RTO drill evidence                         | **PASS** (disposable)  | `scripts/restore-drill-disposable.sh`; VPS drill 2026-08-09/10: 36 tables, RTO ~10s into `taranom_restore_drill` (not live DB) |
| MinIO object restore runbook                                                     | **UNKNOWN**            | Volume + historical snapshot mention only                                                                                      |

**Verdict for readiness reports:** backup/restore = **PASS** for automated Postgres dump + disposable restore rehearsal. Off-box replication and MinIO restore remain open.

### 2.2 Recommended checkpoint (production) — ⛔ HUMAN AUTHORIZATION REQUIRED

Run on VPS as an authorized operator. Store dumps in an access-controlled location outside the git tree. Do **not** commit dumps.

```bash
cd /opt/taranom
TS=$(date -u +%Y%m%dT%H%M%SZ)
COMMIT=$(git rev-parse HEAD)
mkdir -p "/var/backups/taranom/${TS}"   # or authorized ops path
echo "commit=${COMMIT}" > "/var/backups/taranom/${TS}/META.txt"

# PostgreSQL logical dump (DB_USER/DB_NAME from env — do not echo passwords)
set -a; source .env; set +a
docker exec -t taranom_postgres pg_dump -U "${DB_USER:-taranom}" -d "${DB_NAME:-taranom_db}" -Fc \
  > "/var/backups/taranom/${TS}/postgres.dump"

# Verify dump is listable (not a full restore drill)
docker run --rm -v "/var/backups/taranom/${TS}:/b" postgres:16-alpine \
  pg_restore -l /b/postgres.dump | head

# Optional: image tags for app rollback
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'taranom|api|web' || true

# Optional: MinIO / media — UNKNOWN formal procedure; if used, record tool + prefix + operator only
```

Handoff must record: checkpoint id (`TS`), commit SHA, migration head (if known), rollback owner, and whether dump listing succeeded.

### 2.3 Restore sketch (not rehearsed in-repo) — ⛔ HUMAN AUTHORIZATION REQUIRED

```bash
# ONLY with approved recovery plan; expect downtime
# 1) Stop writers: docker compose stop api web
# 2) Restore dump into postgres (exact flags depend on dump format and whether DB must be recreated)
# 3) docker compose up -d api web && docker compose restart nginx
# 4) Re-run §5 smoke
```

If restore cannot guarantee order/inventory/payment correctness, **stop** and execute the approved forward-fix / data-reconciliation plan — do not “hope” an application image rollback fixes data.

---

## 3. Migration notes

| Mechanism                             | When                                                 | Notes                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeORM migrations                    | API startup in production                            | `migrationsRun: true` when `NODE_ENV=production` and `DB_SYNC` ≠ `true` (`apps/api/src/config/database.config.ts`). Prefer expand-then-contract. **Source of truth** for schema changes.                                                  |
| `scripts/apply-production-schema.sql` | After container up in `auto-deploy.sh` and CI deploy | Idempotent safety-net; **not** a full migration mirror (see §3.1). Failures log WARNING and continue in `auto-deploy.sh`. CI (`set -euo pipefail`) fails the job; CI also restarts API after applying (`.github/workflows/ci.yml:79-88`). |
| `apps/api/src/database/sql/*`         | Manual / historical                                  | Ad-hoc scripts (channel-split, retail-b2c, warehouse, wholesale-color-select, …). **Not** run by CI deploy. Prod apply status: UNKNOWN.                                                                                                   |
| `DB_SYNC=true`                        | Bootstrap only                                       | Forbidden as steady-state production setting (see historical redeploy report).                                                                                                                                                            |
| Local generate/run                    | Dev                                                  | `cd apps/api && npm run migration:generate` / `npm run migration:run` (README).                                                                                                                                                           |

**Compatibility rule:** application rollback must remain compatible with schema already applied (expand-only). Destructive down-migrations are not evidenced as safe on production.

**Data-affecting migrations / backfills:** ⛔ HUMAN AUTHORIZATION REQUIRED.

### 3.1 Migrations vs `apply-production-schema.sql` (Phase-4 guidance)

**Do not treat the safety-net as equivalent to “all migrations ran.”**

| Concern                                          | TypeORM migrations                                                                                        | `apply-production-schema.sql`                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog                                          | 10 `*.ts` under `apps/api/src/database/migrations/` (categories → blog phase-2)                           | Single SQL file; header says mirrors `20260717-001` only (`:1-5`)                                                                                                                                                                                                                                                                               |
| Overlap                                          | Specs/discounts/shipping; product stock + inventory_movements; order idempotency + payment unique indexes | Same areas, mostly `IF NOT EXISTS` / idempotent                                                                                                                                                                                                                                                                                                 |
| Covered by SQL but **missing** TypeORM migration | —                                                                                                         | Historically: `products.viewCount`, `categories.bannerUrl`, `orders.torobClid`, wholesale color columns — **promoted** in `20260809-001` and **verified on VPS** 2026-08-09 (`migrations` id=11 `PromoteSqlOnlyEntityColumns1786276800001`; columns+indexes present). Those DDL blocks were **narrowed out** of the safety-net (file retained). |
| Covered by migrations but **missing** from SQL   | Categories create, variant library, hero content migrations, blog SEO phase 1–2                           | If `migrationsRun` is skipped/fails, safety-net will **not** create these                                                                                                                                                                                                                                                                       |
| Data mutation                                    | Stock backfill in `20260720-001`                                                                          | Same style backfill (`:92-98`) on every deploy when `stock=0`                                                                                                                                                                                                                                                                                   |
| Deploy failure policy                            | Migration failure can prevent healthy API start                                                           | `auto-deploy.sh` continues after SQL WARNING; CI deploy aborts                                                                                                                                                                                                                                                                                  |

**After `20260809-001` lands (narrow safety-net — do not delete yet):**

**DONE 2026-08-09 (prod `3146aae`):** confirmed `PromoteSqlOnlyEntityColumns1786276800001` in production `migrations` (id=11) and columns/indexes `viewCount`, `allowWholesaleColorSelect`, `minWholesaleColors`, `bannerUrl`, `torobClid`, `IDX_products_viewCount`, `IDX_orders_torobClid`. Safety-net narrowed by removing those redundant sections; file kept as emergency bridge for overlapping older migrations. Do **not** delete the safety-net until Path C (`database/sql/*` channel-split etc.) is also promoted or explicitly frozen with ops evidence.

**Recommended single-path sequence (ops):**

1. Confirm `DB_SYNC` is not `true` in production `.env`.
2. Deploy/build → start API → let TypeORM apply pending migrations (`migrationsRun`).
3. Run `scripts/apply-production-schema.sql` only as **safety-net / bridge** until promoted columns are verified on VPS and the file is narrowed (see note above). Keep it idempotent; do not treat the header “mirrors 20260717” as complete.
4. CI path: restart API after safety-net, then health-check (`.github/workflows/ci.yml:87-99`). Prefer the same restart after manual `auto-deploy` if schema columns were just added.
5. New schema work: **add a TypeORM migration first**; update safety-net only if a hotfix must land before the next API image that contains the migration.
6. Do not add new one-off files under `database/sql/` without a migration twin and an ops record of apply.

**Rollback notes (schema-aware):**

- Roll back **application** git SHA / images only when the previous release is compatible with the **already-expanded** schema (expand-then-contract).
- Do **not** run TypeORM `down()` or reverse-engineer DROP COLUMN from the safety-net on production without ⛔ human authorization and a restore plan.
- Safety-net is not reversible as a unit; unique partial indexes and stock backfill are not paired undo steps.
- If schema is wrong or half-applied: stop deploy traffic decisions per §6; restore from authorized checkpoint (§2.3) or forward-fix with a new expand-only migration — never “hope” image rollback removes columns.
- Before risky schema releases: record migration head (`SELECT * FROM migrations` — **NOT RUN** this session) and dump listing in handoff.

---

## 4. Deploy steps

### 4.1 Local compose (non-production / staging-like)

```bash
cp .env.example .env   # set secrets locally
docker compose up -d --build
sleep 15
curl -sf http://localhost:4000/v1/health; echo
curl -sf -o /dev/null -w "web %{http_code}\n" http://localhost:3000
docker compose ps
docker compose logs api --tail=50
```

Full first-time server bootstrap (SSL + build): `bash deploy.sh` on a Linux host with Docker — still requires a prepared `.env`.

### 4.2 Push to trigger server poll (usual path)

From a developer machine after gates pass:

```bash
git push origin HEAD:master
```

On VPS, timer runs `scripts/auto-deploy.sh` which:

1. `flock` lock `/tmp/taranom-autodeploy.lock` (skip if busy)
2. `git fetch origin master`; if HEAD ≠ `origin/master`, `git reset --hard origin/master` and re-exec
3. Source `.env`, `docker compose build api web`, `up -d api web`, `restart nginx`
4. Pipe `scripts/apply-production-schema.sql` into postgres
5. Poll `http://localhost:4000/v1/health` up to ~120s; exit 1 if unhealthy

### 4.3 Immediate VPS deploy — ⛔ HUMAN AUTHORIZATION REQUIRED

```bash
ssh -i <path-to-deploy-key> -p 2222 wholesale-admin@5.75.200.102
cd /opt/taranom
# Preferred:
bash scripts/auto-deploy.sh
# Or:
sudo systemctl start taranom-autodeploy.service
journalctl -u taranom-autodeploy.service -n 100 --no-pager
```

### 4.4 GitHub Actions deploy — ⛔ HUMAN AUTHORIZATION REQUIRED

Job `deploy` in `.github/workflows/ci.yml` runs only when:

- `workflow_dispatch`, and
- ref is `master`/`main`, and
- GitHub Environment `production` + secret `VPS_SSH_KEY` are configured.

Remote steps: hard reset to `origin/master`, rebuild `api`/`web`, restart nginx, apply schema safety-net, restart API, health-check.

### 4.5 Canary / staged

**Not evidenced** as a separate canary environment. Closest practice: deploy off-peak, smoke §5, observe §7 window, then keep or roll back. Nginx resolves upstreams via Docker DNS (`resolver 127.0.0.11`) so rebuilds avoid sticky 502s without manual upstream IP edits.

---

## 5. Smoke tests (no real financial impact)

Prefer localhost and read-only HTTPS checks. Do **not** complete live paid checkout or issue real refunds in smoke.

### 5.1 Health (required)

```bash
curl -sf http://localhost:4000/v1/health
# Expect HTTP 200 and success payload
```

Public (after nginx):

```bash
curl -sf https://api.poshaktaranom.com/v1/health
```

### 5.2 Wholesale storefront

```bash
curl -sf -o /dev/null -w "%{http_code}\n" https://poshaktaranom.com/
curl -sf -o /dev/null -w "%{http_code}\n" https://poshaktaranom.com/products
# Expect 200 (or documented redirect chain ending in 200)
```

### 5.3 Retail storefront

```bash
curl -sf -o /dev/null -w "%{http_code}\n" https://www.poshaktaranom.ir/
# apex should redirect to www:
curl -sf -o /dev/null -w "%{http_code} %{redirect_url}\n" https://poshaktaranom.ir/
```

### 5.4 Admin

```bash
curl -sf -o /dev/null -w "%{http_code}\n" https://poshaktaranom.com/admin
# Expect 200 or auth redirect (3xx) — not 5xx
```

Optional build-artifact checks (post-deploy, on VPS): `scripts/server-verify-deploy.sh` greps checkout/admin chunk markers inside `taranom_web` and restarts `web`/`nginx`.

### 5.5 API catalog / jobs / webhooks (lightweight)

```bash
curl -sf "http://localhost:4000/v1/products?limit=1" | head -c 200; echo
# Webhook/payment: confirm callback URLs only; do not fire live capture
# Jobs/queues: UNKNOWN dedicated job UI — check API logs for crash loops:
docker compose logs --tail 80 api
```

### 5.6 Optional E2E purchase path (creates order — staging/local only)

`scripts/e2e-purchase-test.sh` verifies environment identity → health → product → login → **creates a CASH wholesale order** → exact status/totals asserts → checks `/products` and `/checkout`.
**⛔ Staging / local / disposable stacks only.** Do **not** run against production. No SQL activate/password `UPDATE`. Host allowlists are immutable (`E2E_ALLOWED_*` overrides fail closed). Historical VPS CASH order `ORD-2026-00008-9C0117` is **superseded**.

#### 5.6.1 Provision E2E identity (required before first run)

```bash
# Generates a random deployment UUID and writes scripts/fixtures/e2e-expected-identity.json
bash scripts/provision-e2e-identity.sh disposable   # or: local | staging

# Put the printed values on the API compose/.env (never on production):
#   DEPLOYMENT_IDENTITY=<uuid>
#   APP_ENV=disposable
# Restart API so GET /v1/env-identity returns { deploymentId, environment, nonProduction: true }.
# Optional VPS copy: sudo cp scripts/fixtures/e2e-expected-identity.json /etc/taranom/
```

The harness compares fixture `expectedDeploymentId` to `GET /v1/env-identity` (`curl --max-redirs 0`) **before** login or order create. Mismatch/absent → exit.

```bash
# Staging/local/disposable only — never production
E2E_TARGET=local \
E2E_ALLOW_MUTATION=1 \
E2E_PHONE='09xxxxxxxxx' \
E2E_PASSWORD='use-staging-only-secret' \
E2E_PRODUCT_ID='<seeded-product-uuid>' \
API_URL=http://127.0.0.1:4000/v1 \
WEB_URL=http://127.0.0.1:3000 \
bash scripts/e2e-purchase-test.sh
```

Negative guards (no mutation): `bash scripts/_negative-e2e-guards.sh`

### 5.7 Observability smoke

```bash
docker compose ps
docker compose logs --tail 40 api
docker compose logs --tail 40 web
docker compose logs --tail 20 nginx
journalctl -u taranom-autodeploy.service -n 50 --no-pager
```

---

## 6. Proceed / rollback decision

Observe for an agreed window (suggest **15–30 minutes** after smoke) using §7 signals.

### 6.1 Rollback triggers (objective)

Roll back or stop traffic and escalate if any of:

| Trigger                              | Signal                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Error rate                           | Sustained 5xx on nginx/API or `/v1/health` failing after retries                            |
| Latency                              | Home/API markedly worse than preflight baseline (operator judgment; no SLO file evidenced)  |
| Payment / order / inventory mismatch | Orders succeeding without stock decrement, double charge reports, gateway callback failures |
| Authorization failure                | Mass 401/403 on previously working admin/customer sessions; OTP/login outage                |
| Job backlog                          | Growing failed retries / stuck workers in API logs (if applicable to release)               |
| SEO / routing                        | Wrong host canonical redirects, retail↔wholesale mixup, `/_next/static` 404 storm           |
| Data reconciliation                  | Counts/totals diverge from pre-deploy checkpoint expectations                               |

### 6.2 Application rollback (schema-compatible) — ⛔ HUMAN AUTHORIZATION REQUIRED

```bash
cd /opt/taranom
sudo systemctl stop taranom-autodeploy.timer   # avoid immediate re-deploy
PREV=<known-good-sha>   # from checkpoint META
git fetch origin
git reset --hard "$PREV"
docker compose build api web
docker compose up -d api web
docker compose restart nginx
# Re-check health — do NOT blindly re-run destructive downs
curl -sf http://localhost:4000/v1/health; echo
```

If schema was expanded in a forward-only way, keep schema; only roll app code/images.

### 6.3 Data recovery

If application rollback cannot restore correctness → execute approved restore (§2.3) or forward-fix. Owner and checkpoint id must already be in handoff.

---

## 7. Monitoring

| Source                  | How                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| API health              | `curl -sf http://localhost:4000/v1/health`                                                            |
| Compose status          | `docker compose ps`                                                                                   |
| Container logs          | `docker compose logs -f api` / `web` / `nginx`                                                        |
| Auto-deploy             | `systemctl status taranom-autodeploy.timer`; `journalctl -u taranom-autodeploy.service`               |
| Edge                    | Nginx access/error logs inside `taranom_nginx`; rate-limit zones `api` / `auth` in `nginx/nginx.conf` |
| Dependency healthchecks | Postgres `pg_isready`, Redis ping, Meili `/health`, MinIO `/minio/health/live` (compose)              |

No dedicated APM/Sentry runbook is evidenced as required for go-live in these scripts; treat container health + HTTPS smoke + logs as the minimum.

---

## 8. Recovery checkpoint template (copy into handoff)

```text
checkpoint_id: <UTC timestamp>
git_commit: <sha>
schema_note: <migrations / safety-net applied?>
backup_artifacts: <operator-only reference ids — no secrets>
backup_verify: <pg_restore -l ok | UNKNOWN>
rollback_owner: <name>
rollback_trigger: <which §6.1 fired, or n/a>
auth_for_prod: <human who approved>
verify_after: <health + retail + wholesale + admin results>
```

---

## 9. Secrets & redaction

- Never commit `.env`, SSL private keys, SSH keys, dump files, or gateway credentials.
- CI secret name only: `VPS_SSH_KEY` (and optional `VPS_HOST` / `VPS_USER` / `VPS_PORT` overrides).
- Public facts allowed in docs: host `5.75.200.102`, SSH port `2222`, user `wholesale-admin`, domains above.
- Rotate any credential that appears in chat or logs.

---

## 10. Quick reference commands

```bash
# Health (primary)
curl -sf http://localhost:4000/v1/health

# Deploy now (on VPS)
cd /opt/taranom && bash scripts/auto-deploy.sh

# Or via systemd
sudo systemctl start taranom-autodeploy.service
```
