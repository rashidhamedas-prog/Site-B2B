# Admin order queues — architecture and delivery

Date: 2026-09-13  
Task: TASK-20260913-008

## Confirmed problem

The `/admin/orders` chips were filters only. List actions, detail buttons, customer steppers, and `ORDER_TRANSITIONS` disagreed:

- Detail offered PROCESSING → CONFIRMED; the API rejects that jump.
- COMPLETED was a tab with no inbound transition (DELIVERED only went to REFUNDED).
- Customer retail stepper used a `PACKING` status that the API never writes.
- Portal stepper put PROCESSING before CONFIRMED.
- Labels were copied in Badge, dashboard, admin list, and storefront.

## External references (not copied; used as constraints)

- [Vendure DefaultOrderProcess](https://docs.vendure.io/current/core/core-concepts/orders): explicit FSM, `nextOrderStates`, ship/deliver as fulfillment outcomes.
- [Medusa aggregate fulfillment status](https://github.com/medusajs/medusa/blob/5296f511/packages/core/core-flows/src/order/utils/aggregate-status.ts) and [admin payment/fulfillment filters](https://github.com/medusajs/medusa/pull/14399): queue filters at the database, not in the browser.
- WooCommerce operational vocabulary: pending → processing → completed / cancelled / refunded.
- Slack public search for order-status decisions returned no messages in this workspace.

This store stays on a **single operational status** (not Medusa’s split payment_status + fulfillment_status). Scale and team size do not justify a second machine.

## Decisions

1. `@taranom/shared-types` owns labels, admin queues, customer stepper, transitions, and queue actions.
2. Happy path: `AWAITING_PAYMENT` → (payment capture) `PENDING_REVIEW` → `CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `COMPLETED`.
3. Allowed skips stay: review → processing; confirmed → shipped (via tracking).
4. Payment capture still owns unpaid → review. Admin cannot click that jump.
5. Staff-only `GET /v1/orders/status-counts`. Unknown `status` query is 400. Tracking can set SHIPPED only from CONFIRMED/PROCESSING (or update an already-shipped row).

## Non-goals

- No new statuses (`PACKED` stays unused).
- No live connector / payment adapter change.
- No split of payment vs fulfillment columns.

## Rollback

Revert the shared catalog + `order.service` transition import. Existing rows keep their status strings.
