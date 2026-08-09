# Start Here — راهنمای اجرا

This package completes and stabilizes the **existing retail and wholesale websites**. It does **not** create a website builder, SaaS product, multi-tenancy layer, or page editor.

## قبل از شروع

1. این پوشه را در ریشه مخزن واقعی سایت‌های تک‌فروشی و عمده‌فروشی کپی کنید.
2. مطمئن شوید کد، تنظیمات نمونه، migrationها و دستورهای تست در دسترس عامل هستند؛ اما secret واقعی را در چت قرار ندهید.
3. کار را روی branch جدا و با backup قابل بازیابی شروع کنید.

## The single prompt to give Cursor

Copy and send exactly this prompt to Cursor, Codex, Claude Code, Gemini CLI, or another repository-aware coding agent:

```text
Act as the Orchestrator and Architect for this repository unless the active task assigns another role. Follow the repository's AGENTS.md files exactly. Open Retail-Wholesale-Completion-Package/MASTER.md and execute it as the authoritative completion contract. Before changing code, follow the MASTER reading order, inspect the actual repository, verify documentation against code, and complete the required AI-DOS preflight report. Check .ai-dos/tasks/active.yaml for overlapping task or file claims and claim this work using the repository's existing schema before editing. Do not overwrite another claim. Keep .ai-dos/tasks/handoff.md current at every checkpoint and completion. Preserve production data, behavior, integrations, public URLs, and unrelated work. Do not build a website builder, SaaS, multi-tenancy, or page builder. Work incrementally with tests, checkpoints, backups, and rollback instructions. Continue until both retail and wholesale end-to-end acceptance criteria are evidenced and docs/PLATFORM-READINESS-REPORT.md is generated, or stop safely at a documented blocker requiring human authorization.
```

Do not ask the agent to run an individual numbered file. `MASTER.md` orchestrates all files.

## Cursor execution protocol

Cursor must first respond with a **Preflight Report**, not code changes. It must include architecture, verified current state, active tasks and file claims, completed/remnant work, risks, missing/stale documentation, quality commands, proposed scope/non-goals, acceptance criteria, affected files, risk level, rollback, validation, branch/worktree, and ownership. After preflight and a conflict-free claim, it may proceed autonomously through bounded checkpoints unless an approval gate in `MASTER.md` is reached.

If `.ai-dos/`, its task registry, or handoff file is absent, Cursor must report that fact and propose the smallest compatible initialization based on `AGENTS.md`; it must not invent a competing governance format silently.

## Required reading order

`MASTER.md` → `00_SYSTEM_RULES.md` → files `01` through `13` in numeric order → `99_PLATFORM_READINESS_REPORT_TEMPLATE.md`.

## Expected outputs in the target repository

- `docs/01-current-system-audit.md`
- `docs/02-target-architecture.md`
- `docs/implementation-progress.md`
- `docs/test-and-acceptance-evidence.md`
- `docs/deployment-runbook.md`
- `docs/PLATFORM-READINESS-REPORT.md`

The last report must conclude with exactly one verdict: **GO**, **GO WITH CONDITIONS**, or **NO-GO**.
