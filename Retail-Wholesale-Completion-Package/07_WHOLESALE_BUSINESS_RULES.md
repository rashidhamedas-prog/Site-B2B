# Wholesale Business Rules

Wholesale must not be treated as retail with a cosmetic discount. Discover and document:

- Registration/invitation, verification/approval, organization membership, buyer roles, suspension, and data isolation between accounts.
- Customer group/contract price lists, currency/tax status, effective dates, quantity breaks, MOQ, case/pack multiples, and precedence/conflict rules.
- Catalog/stock visibility, allocation, backorders, lead time, and channel reservations.
- Quote/draft/reorder/upload flows if present; purchase order numbers, cost centers, approvals, credit limits/terms, tax exemption documents, and offline/online payments.
- Shipping rules, split shipments, fulfillment, invoices/credit notes, cancellations, returns, and account statements.

## Wholesale acceptance matrix

Test approved/unapproved/suspended users; multiple organizations/roles; contract/default pricing; boundary quantities; MOQ/pack violations; tax-exempt/taxable; credit available/exceeded; PO/approval and payment paths; inventory contention with retail; duplicate submission; partial fulfillment/cancellation/refund; invoice/order history isolation. All price and permission enforcement must be server-side.

Preflight must identify the owner and claimed implementation/test files for every wholesale journey changed. Record partial or failed journeys in the checkpoint handoff; do not mark the task complete because retail alone passes.
