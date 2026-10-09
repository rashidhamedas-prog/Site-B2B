# GA4 admin checklist — retail property 547378194

Do these in the retail property only. Do not copy the wholesale property `547352333`.

| Item | Status | Action |
|---|---|---|
| 1. Web stream for `poshaktaranom.ir` | NEEDS ACCESS | Confirm the stream host is `www.poshaktaranom.ir` and the measurement id matches `NEXT_PUBLIC_GA4_RETAIL_ID` / admin marketing setting. |
| 2. Enhanced measurement | NEEDS ACCESS | Turn **off** “Page changes based on browser history events”. The app sends `page_view`. Leave scroll on only if a single scroll per page is acceptable. |
| 3. `purchase` key event | NEEDS ACCESS | Mark `purchase` as a key event. |
| 4. Partner `sign_up` | NOT APPLICABLE yet | Mark it only after auth pages call `trackPartnerAuth`. |
| 5. Unwanted referrals | NEEDS ACCESS | Add `web.mydigipay.com`, `www.mydigipay.com`, `api.mydigipay.com`, `uatweb.mydigipay.info`, `payment.zarinpal.com`, `sandbox.zarinpal.com`, `www.zarinpal.com`, `zarinpal.com`, `cpg.torobpay.com`. Do not add `poshaktaranom.ir`. The payment layout also queues `gtag('set','ignore_referrer',true)` only when `document.referrer` is one of these hosts. The admin list is still required. |
| 6. Cross-domain | NOT APPLICABLE | `.ir` and `.com` are separate sites and properties. Do not link them. |
| 7. Data retention 14 months | NEEDS ACCESS | Set only if the business accepts the historical change. Say so before saving. |
| 8. Internal traffic | NEEDS ACCESS | Define internal traffic, leave the data filter in **Testing**. Do not activate it. Do not rely on a VPN IP alone. |
| 9. Search Console `.ir` | NEEDS ACCESS | Confirm the property is `www.poshaktaranom.ir`, not `.com`. |
| 10. Google Ads | NOT APPLICABLE | No ads account was connected in Windsor. Do not link one that is unused. |
| 11. Currency and timezone | NEEDS ACCESS | Timezone `Asia/Tehran`. Currency IRR. |
| 12. Custom dimensions | NEEDS ACCESS | Create only `contact_method` and `sales_channel` if reports need them. Do not register partner codes. |
| 13. DebugView | NEEDS ACCESS | Use DebugView for a test device. Do not filter production reports with it. |
| 14. BigQuery export | NOT APPLICABLE | Future option. Do not enable without an owner. |
| 15. User access | NEEDS ACCESS | Review users with the owner before removing anyone. |

Google tag inside `GTM-NKBCGQJV`: `send_page_view` = false. Do not add a second GA4 Event tag on custom event `page_view`, `purchase`, or other names this app already sends with `gtag`. That would double-count once the command queue is replayed.

Redact query parameters in the stream if the callback URL still contains `Authority` or `paymentId`. The manual page_view allowlist does not control enhanced-measurement hits on `/payment/callback`, which sits outside the retail layout.
