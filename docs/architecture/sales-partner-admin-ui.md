# Sales Partner Admin + Partner UI — Architecture

Status: implementation-ready  
Date: 2026-09-28  
Channel: retail sales-partner program (`.ir`) — isolated from Vendor `/partners`

## 1. Goals / non-goals

**Goals**

- Professional admin console for همکار بازاریاب: dashboard, applications, partners, orders, catalog, rules, payouts, settings, reports + audit history.
- Matching partner portal UX (mobile-first) with the same status vocabulary, KPI semantics, and brand tokens.
- Full sync: shared labels, report shape, empty/loading/error states, toman IRR display rules.

**Non-goals**

- No Vendor/affiliate merge.
- No invented sales targets or guaranteed income.
- No new order types or price-setting by partners.
- No paid 21st component paste when daily quota is exhausted (adapt patterns only).

## 2. Confirmed facts

| Fact | Evidence |
|------|----------|
| Admin UI is one monolithic tab file with thin reports | `AdminSalesPartners.tsx` |
| API already exposes applications, partners, orders, catalog, rules, payouts, settings, audits, reports | `sales-partner-admin.controller.ts` |
| Reports lack program-wide commission balances | `programReport()` |
| Partner home/commissions/orders are functional but sparse | `SalesPartnerHome.tsx` et al. |
| Brand tokens: `#1B5C4A` / `#C9A84C` / `#F6F1E8` | existing shell + stitch prompts |
| 21st free retrievals: 0 remaining today | `get_usage` |
| Stitch MCP `user-stich` discovery error; browser Stitch logged in but One Tap iframe blocks agent input | MCP + browser evidence |
| Stitch prompt prepared | `docs/prompts/stitch-sales-partner-admin-fa.md` |

## 3. Assumptions

1. Editors stay ADMIN-only for attribution/payout/settings.
2. Dashboard KPIs use existing sample caps (≤500 drafts/apps) — documented as sample, not warehouse OLAP.
3. Partner «گزارش» is personal aggregates from their drafts + ledger only.

## 4. Module map

| Module | Owner | Notes |
|--------|-------|-------|
| `sales-partner` API | Nest | Enrich `reports` + partner `report` |
| Admin UI | Next client | Split shared kit + dashboard/history |
| Partner UI | Next client | Home/commissions/orders/shell sync |
| Shared labels | Web | Single FA map for statuses/actions |

## 5. Data / API

**`GET /admin/sales-partners/reports`** (extended)

```ts
{
  applications: { total, byStatus, pendingReview },
  partners: { total, byStatus, active },
  drafts: { sampleSize, byStatus, converted, customerConfirmRate },
  commissions: { held, available, paid, reversed }, // program rollup
  payouts: { count, paidIrr },
  note: string,
  generatedAt: string
}
```

**`GET /sales-partners/report`** (new, partner JWT)

```ts
{
  drafts: { total, byStatus, awaiting, converted },
  commissions: { held, available, paid, reversed },
  note: string,
  generatedAt: string
}
```

Audits unchanged; UI maps `action` → FA label.

## 6. Security

- No new privilege escalation; ADMIN + `sales_partner` purpose only.
- Masked phones remain; IBAN stay masked.
- Attribution change still requires reason ≥8 chars server-side.

## 7. UI design direction (21st patterns + Stitch brand)

Inspired by catalog patterns (KPI cards, status-badge tables, timeline history) without retrieving paid source:

- Admin orders: row click + «مشاهده جزئیات» opens a read-only RTL drawer (`GET /admin/sales-partners/orders/:id`) for DRAFT and later statuses; converted rows still link to `/admin/orders/:id`. No confirmation tokens or unmasked phones.
- Admin: ops dashboard like existing `AdminDashboard` + filtered tables.
- Partner: cream mobile shell, emerald primary, gold focus ring.
- Motion: opacity/transform ≤300ms; respect `prefers-reduced-motion`.
- a11y: `aria-label` on icon buttons, focus-visible, semantic links.

## 8. Phases

1. API report enrich + partner report endpoint + unit assertion.
2. Shared UI kit (badge, KPI, section, empty).
3. Admin rewrite (dashboard default + polished tabs + history).
4. Partner panel polish + report page.
5. WORKLOG, smoke, deploy.

## 9. Decisions requiring confirmation

| ID | Question | Safe default |
|----|----------|--------------|
| U1 | Export CSV for reports | Defer; screen-only |
| U2 | Real-time websocket KPIs | Poll/manual refresh only |
| U3 | Stitch visual as pixel-perfect source | Prompt + brand tokens until export available |

## 10. Rollback

Revert UI files + report enrichment; no schema migration in this slice.
