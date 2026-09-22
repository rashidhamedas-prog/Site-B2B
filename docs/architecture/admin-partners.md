# Admin sales partners

Confirmed: `/admin/partners` is the only invite path. A partner sees their own goods and shipments. The storefront invoice and seller name stay Taranom. Real postage stays with the partner; the customer shipping fee stays with Taranom.

## Decisions

- Edit and delete stay on the existing admin vendor module. There is no new service.
- `PATCH /v1/vendors/:id` updates name, login phone, accept SLA, settlement hold, notes, and status. Phone is written on both `vendors` and the linked `users` row in one transaction. A taken number is 409.
- `DELETE /v1/vendors/:id` is allowed only when the partner has zero products, fulfillment orders, order items, and ledger rows, and the linked user role is `VENDOR`. The vendor row and the login user are hard-deleted so the phone can be invited again.
- A partner with history is not deleted. The screen offers suspend instead. Suspend already disables login.
- Usage counts are admin-only. `GET /v1/partners/me` does not receive them.
- The list stays capped at 200. Search and status filters run in the browser. The ledger still loads only when opened.

## Open

- Typed-name delete is the confirmation. Re-authentication was not added.
- Changing the phone does not revoke the current partner session. Password rotation and suspend do.
