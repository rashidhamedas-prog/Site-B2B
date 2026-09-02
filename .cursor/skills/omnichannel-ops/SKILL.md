---
name: omnichannel-ops
description: Verify Omnichannel soak, workers, outbox lag, and backups without enabling connectors or destination canary.
---

# /omnichannel-ops

Specialize `.cursor/agents/omnichannel-ops.md`, then collect live evidence only.

Allowed: health, worker status, SELECT counts, alerts script, disposable restore-drill.

Forbidden: enable connectors/auto-publish, live Telegram, DELETE outbox, restore onto `taranom_db`.
