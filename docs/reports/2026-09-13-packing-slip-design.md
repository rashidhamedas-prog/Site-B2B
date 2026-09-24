# 2026-09-24 — A5 packing slip: Minimalist Swiss / Atelier Redesign

Visual-only minimal redesign of the admin برگه بسته (`/admin/orders`).
Based on Swiss typography principles and high-contrast monochrome printing standards.

## Principles

1. **Zero decorative fills / zero ink waste**: Removed heavy green title bars, colored background fills, and decorative rails. Pure white background with crisp black and neutral ink (`#0f172a`, `#334155`, `#64748b`).
2. **Hairline precision**: Clean dividers at 0.5pt to 1.25pt separating functional sections without visual clutter.
3. **Typographic hierarchy**:
   - Vazirmatn variable font exclusively (no extra fonts loaded).
   - Recipient Name: 18px / weight 800 (bold, high-impact readability for delivery).
   - Recipient Address: 11.5px / line-height 1.6 (clean, easy scanning).
   - Recipient Phone: 13.5px / tabular figures.
   - Postal Code: 10 individual segmented boxes (6.2mm × 7.8mm) with a 5+5 group gap and 14px centered digits.
   - Order Number: 15px / weight 800 in a minimalist framed box.
   - Pick checklist: 10px clean rows with 3.8mm square checkbox for physical pen verification.
4. **Printer compatibility**: Perfect contrast on both laser and thermal A5/A4 printers with zero gray smudging.

## Files
- `apps/web/src/components/admin/AdminPackingSlip.tsx`
- `apps/web/src/components/admin/packing-slip.css`
- `apps/web/src/lib/packing-slip.spec.ts` (passing)
