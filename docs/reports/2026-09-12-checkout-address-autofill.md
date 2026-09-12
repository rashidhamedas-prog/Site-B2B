# Checkout autofill from saved / default address

TASK-20260912-007. Residual of the structured checkout form (004) and plaque DTO whitelist (006).

## Problem

Shoppers save a full Iranian address in the account panel (recipient, mobile, province, city, street, alley, plaque, unit, postal). At checkout they expected:

1. The default address to fill those same inputs automatically.
2. Clicking a saved address to copy every field into its own input.

What actually happened:

- The API stores one composed `street` (`خیابان …، کوچه …، پلاک …، واحد …`). Extra keys are not columns.
- Retail `/retail/checkout` only read `localStorage` and never applied `me.addresses` / `isDefault`.
- Selecting a saved row spread the composed line into `street` and left alley/plaque/unit empty.

## Change

- `hydrateShippingAddress` / `parseComposedStreet` reverse the compose suffixes into dedicated fields.
- `pickDefaultAddress` prefers `isDefault`, else the first row.
- Retail and wholesale checkout apply that hydration on load and on saved-row click.
- Retail checkout loads `/auth/me/profile` addresses when the shopper is logged in.
- Account edit uses the same hydrate so کوچه/پلاک/واحد reappear in the form.

No schema change. No new JS dependency. Checkout stays `no-store`.

## Validation

- `npx tsx src/lib/shipping-address.spec.mts` (cwd `apps/web`) → `shipping-address spec ok` (exit 0)
- `npx tsc --noEmit` (cwd `apps/web`) → exit 0
- Live VPS HEAD `be18707` (includes autofill `b8c8821`). API health 200 after `--no-cache` api rebuild. `.ir` / `.com` / checkout 200. TTFB home `.ir` ~0.27s.

