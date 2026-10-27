# Omnichannel PR-2 — Status UI

**شاخه:** `feat/omnichannel-status-ui` · **GO:** حامد ۲۷ اکتبر، بستهٔ بازطراحی

## محتوا
- بج «موفق با هشدار» (کهربایی) برای `SUCCEEDED` + `warnings:*`
- متن هشدار فارسی از `deliveryWarningLabel` (نه فقط کلمهٔ «هشدار»)
- `ERROR_LABELS.unsupported_media`
- دکمهٔ تلاش دوباره برای non-retryable مخفی → «اول تصویر را اصلاح کنید»
- API: `retryDelivery` برای `unsupported_media` → 400

## تست
`npx tsx apps/web/src/components/admin/admin-omnichannel-delivery-warning.spec.ts`
