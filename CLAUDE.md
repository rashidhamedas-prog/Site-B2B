Guidance for Claude Code when working in this repository.Keep this file concise; offload detail to @imports and .claude/ configs.

Bootstrap Protocol (run once per project, or when capabilities change)
Before writing or modifying code, verify the environment is ready.Use plan mode first; surface a plan before any edit.

1. Inspection (parallelize via subagents)
Map: structure, build system, package manager, lockfiles, runtimes, versions
Catalog: production + dev dependencies with pinned versions
Identify: Docker, CI/CD, IaC, deploy targets, DB + ORM + migrations
Read: README, ADRs, CONTRIBUTING, existing docs
Flag: security issues, outdated deps, technical debt
2. Capability Detection
Infer from project goals: Frontend, Backend, DB, Cloud, Testing, AI, Browser-Automation, Crawler, Maps, Auth, Payments, Image/OCR/PDF, Messaging, Monitoring, Logging, Performance, Security, Deployment, DevOps, Analytics, SEO, Mobile, Desktop, CLI, Infra.

3. Skill Discovery (priority order)
Official MCP servers — https://github.com/modelcontextprotocol/servers
Official SDKs / APIs / templates / plugins
Actively maintained, well-documented OSS
Community-approved tools
Reject: abandoned, unlicensed, low-adoption, untested, or insecure.

4. Quality Gates
Score each candidate: security, popularity, maintenance, update cadence, docs, performance, scalability, compatibility, production readiness. Install only the top candidate.

5. Install & Verify
Auto-install via the project's package manager when supported.
On failure, emit ONE OS-aware, ordered, executable bash script (no prose) and wait for completion.
Verify every MCP / SDK / plugin / CLI / env var / runtime before proceeding.
Tooling Conventions
Package managers (prefer over vanilla):

Node: pnpm > bun > npm
Python: uv > poetry > pip
Rust: cargo | Go: go mod | Multi-runtime: mise / asdf
MCP servers to prefer: filesystem, git, github, linear, sentry, playwright, postgres, supabase, cloudflare, vercel, stripe, sequential-thinking, context7.

Quality gates (enforce via hooks):

TypeScript strict | Biome or ESLint+Prettier | Ruff+Black (Py) | rustfmt+clippy | golangci-lint
Husky / lefthook / pre-commit on every commit
Tests: Vitest/Jest, pytest, cargo test, go test, Playwright (e2e)
Git: Conventional Commits (feat/fix/chore/refactor/docs/test/perf/ci). Short-lived branches, rebase before merge, squash-merge, linear history. Never commit secrets — use .env.example + vault.

Claude Code Workflow
Plan mode for any non-trivial change; never edit blindly.
Subagents (.claude/agents/) for parallel investigation — one per layer.
Hooks (.claude/settings.json) to enforce lint+format+typecheck on every Write/Edit.
Slash commands (.claude/commands/) for repeated flows: /bootstrap, /review, /release, /test-changed.
Use read-only tools first (Glob, Grep, Read) before writing.
Small, verifiable commits; rerun relevant tests after each.
Ask before irreversible ops (migrations, deletes, prod deploys).
Use /rewind checkpoints before risky edits.
Code Standards (project-specific only — don't restate universal principles)
Layered architecture: domain → application → infra; clear boundaries
Type-safe end-to-end; fail fast at boundaries
Structured JSON logs with correlation IDs; OpenTelemetry when feasible
Security: input validation, output encoding, least privilege, secrets via env/vault
a11y + i18n from day one when user-facing
Profile before optimizing; set explicit SLOs
CI/CD
GitHub Actions / GitLab CI with caching (pnpm store, uv cache, cargo registry)
Mandatory pipeline: lint → typecheck → test → build → SAST (CodeQL/Trivy) → license check
Preview deploy per PR; atomic, reversible migrations; trunk-based + feature flags
Project Memory (persist in .claude/memory.json)
Installed tools / MCPs / SDKs / plugins + versions + rationale
Architecture decisions → ADRs in docs/adr/
Known risks and debt items
Skip re-discovery unless a capability changes.
Pre-Implementation Output
Concise readiness report, then code:

Tech stack & versions
Architecture overview (1 paragraph; diagram if helpful)
Recommended MCPs / SDKs / plugins + install status
Missing deps, security warnings, perf suggestions, opportunities
Hard Rules
Never code before bootstrap completes.
Never duplicate existing functionality — extend or refactor.
Prefer official, maintained, documented, secure, scalable solutions.
Document trade-offs in ADRs; minimize technical debt.
Think like a Staff Engineer: long-term maintainability > short-term speed.
After meaningful changes: update docs/WORKLOG.md, add session report if needed, commit to git (see docs/conventions.md).

Imports (extend per project)
@docs/conventions.md@docs/WORKLOG.md@docs/reports/README.md@.claude/memory.json@.claude/commands/log-work.md