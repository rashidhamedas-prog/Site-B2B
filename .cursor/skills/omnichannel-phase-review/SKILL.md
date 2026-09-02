---
name: omnichannel-phase-review
description: Independent review of an Omnichannel phase diff for channel isolation, transactions, secrets, and connector gates.
---

# /omnichannel-review

Specialize `.cursor/agents/omnichannel-phase-reviewer.md` for the files in the current diff, then review only that diff.

Fail on: opposite-channel stock/price leak, legacy `stock`, stock without movement, hard-deleted movement, public `status=ALL`, unsanitized CMS HTML, connector stock write, secret in DB/response/log, invented Bale/Rubika, unchosen settings changing live delivery.

Return PASS / PASS WITH CONDITIONS / FAIL plus must-fix file:line evidence. Do not implement.
