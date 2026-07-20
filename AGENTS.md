# AGENTS.md

## Cursor Cloud specific instructions

This is the **Taranom** B2B wholesale clothing platform: an npm + Turborepo monorepo.
Two runnable apps plus shared packages:

- `apps/api` — NestJS 10 on Fastify (REST API, Swagger). Dev port **4000**, base path `/v1`.
- `apps/web` — Next.js 15 (public site + `/portal` customer panel + `/admin` panel). Dev port **3000**.
- `packages/shared-types`, `packages/persian-utils` — shared TypeScript libraries.

Node is provided via nvm (v22, satisfies the repo's `>=20` engine requirement). The update
script (`npm install`) refreshes workspace dependencies on startup.

### Infra services (Docker) — must be started manually each session

Dependencies (PostgreSQL required; MinIO/Meilisearch/Redis optional) run via `docker compose`.
Docker is pre-installed in the snapshot, but the daemon is **not** auto-started and needs
`sudo`. Start it once per session, then bring up infra:

```bash
sudo dockerd >/tmp/dockerd.log 2>&1 &      # if `docker info` fails; daemon is not auto-started
cd /workspace
sudo docker compose up postgres redis minio minio-init meilisearch -d
```

Non-obvious Docker caveat: this VM runs Docker with the `fuse-overlayfs` storage driver and,
because Docker is v29, the `containerd-snapshotter` feature is disabled in
`/etc/docker/daemon.json`. Do not remove that setting or images will fail to unpack.

`docker compose` commands need `sudo` (the `ubuntu` user is not in the `docker` group).

### Environment file

The apps read a **root** `.env` (the API loads `../../.env`). A gitignored dev `.env` already
exists in the snapshot with `NODE_ENV=development`. If it is missing, copy `.env.example` and set
`NODE_ENV=development` plus the matching `DB_PASS`/`REDIS_PASS`/`MEILI_MASTER_KEY`/`MINIO_PASS`
used by `docker-compose.yml`, and `NEXT_PUBLIC_API_URL=http://localhost:4000/v1`.

Because `NODE_ENV=development`, TypeORM runs with `synchronize: true` and auto-creates all
tables on API startup — **no migrations needed in dev**. Migrations only run when
`NODE_ENV=production`.

### Running the apps (dev)

```bash
cd apps/api && npm run start:dev      # API on :4000  (watch mode)
cd apps/web && npm run dev            # Web on :3000
cd apps/api && npm run seed           # seed admin: phone 09152424624 / Admin@1234
```

Health check: `curl http://localhost:4000/v1/health`. Swagger at `http://localhost:4000/api/docs`.

### Lint / type-check / test / build

- **No working lint or automated test suite ships in the repo.** `apps/api` has no `eslint`
  dependency (its `lint` script errors with `eslint: not found`) and no `jest`/`*.spec.ts`
  (its `test` script errors with `jest: not found`); `apps/web`'s `next lint` is unconfigured and
  prompts interactively. Do not treat these as environment breakage.
- The real quality gate (matching `.github/workflows/ci.yml`) is type-check + build:
  ```bash
  cd apps/web && npx tsc --noEmit
  cd apps/api && npx tsc --noEmit
  cd /workspace && NEXT_PUBLIC_API_URL=http://localhost:4000/v1 npm run build   # turbo build both apps
  ```

### Notes

- MinIO (image uploads) and Meilisearch (product search) degrade gracefully — the API starts and
  serves fine if they are unreachable; only uploads/fast-search are affected.
- Frontend uses `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:4000/v1`). Next.js dev only
  reads env from `apps/web`, not the repo root, so rely on the fallback or export it when building.
