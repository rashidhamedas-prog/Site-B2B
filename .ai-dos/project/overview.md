# Project Overview

- Purpose: Complete and stabilize the existing **retail** (B2C) and **wholesale** (B2B) commerce sites for پوشاک ترنم before any separate website-builder effort.
- Users/stakeholders: End customers (retail `.ir`), wholesale buyers (portal on `.com`), store admins, operators on VPS.
- Technology stack (verified from `package.json`, `apps/*/package.json`, `docker-compose.yml`, `README.md`):
  - Monorepo `taranom-platform` (npm workspaces + turbo)
  - `apps/web`: Next.js 15, React 19, Tailwind
  - `apps/api`: NestJS 10 (Fastify), TypeORM, PostgreSQL
  - Redis, Meilisearch, MinIO
  - Packages: `@taranom/shared-types`, `@taranom/persian-utils`
- Deployment environments:
  - Local: docker compose data services + `npm run start:dev` / `next dev`
  - Production VPS `/opt/taranom` via `scripts/auto-deploy.sh` / GitHub Actions `workflow_dispatch` deploy job
  - Public URLs: wholesale `https://poshaktaranom.com`, retail `https://poshaktaranom.ir` (also www), API `https://api.poshaktaranom.com`
- Source of requirements: `Retail-Wholesale-Completion-Package/MASTER.md` (authoritative for this program); supporting evidence in `docs/B2C.md`, `docs/conventions.md`, `docs/WORKLOG.md`, `README.md`.
- Explicit non-goal: website builder, SaaS multi-tenancy, page builder, template marketplace.
