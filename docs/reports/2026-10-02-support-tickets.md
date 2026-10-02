# Support Tickets — 2026-10-02

## Goal
Professional ticket support for retail (`.ir`) and wholesale (`.com`) with admin desk.

## Research (standard)
- Practice: ticket + message thread, explicit FSM, channel isolation, rate-limit create/reply; no websocket in v1.
- Repo: [MackHatch/real-time-chat-support](https://github.com/MackHatch/real-time-chat-support) — reuse status/assignment patterns (skip Socket.IO).
- Repo: [kodustech/kodus-helpdesk](https://github.com/kodustech/kodus-helpdesk) — Nest+Next monorepo helpdesk shape.
- Repo: [escalated-dev/escalated-nestjs](https://github.com/escalated-dev/escalated-nestjs) — REST tickets/replies/actions (skip SLA/KB/CSAT).
- Rejected: event-sales ticketing and AI/Kafka SaaS stacks (wrong problem / overkill).

## Delivered
- Tables: `support_tickets`, `support_ticket_messages` (migration `20261002-002-support-tickets`).
- API `/v1/support/tickets` — customer create/list/detail/reply; admin list/filter/reply/internal note/status.
- FSM: OPEN ↔ IN_PROGRESS ↔ WAITING_CUSTOMER ↔ RESOLVED ↔ CLOSED (reopen from CLOSED→OPEN).
- Channel from JWT purpose; optional `orderId` ownership check; Redis rate limits.
- UI: `/account/support`, `/portal/dashboard/support`, `/admin/support`.
- Staff module `support` for ADMIN / CUSTOMER_SERVICE / SALES_MANAGER.

## Non-goals (v1)
Attachments, live chat, SLA automation, email/SMS notify, guest tickets.

## Verify
- `npx ts-node --transpile-only src/modules/support/support-ticket.fsm.spec.ts`
- `npx ts-node --transpile-only src/modules/support/support-ticket.ownership.spec.ts`
- Post-deploy: `/v1/health`, admin route redirects unauth, account nav shows پشتیبانی.
