# GA4 event dictionary (retail)

| Event | Trigger | Parameters | Source file | Key event | PII check | Test |
|---|---|---|---|---|---|---|
| page_view | First load, pathname change, refresh, back/forward. One per id+path. | page_location, page_path, page_title, send_to | `GoogleAnalytics.tsx` | no | query allowlist | stub regression in `retail-analytics.spec.ts` |
| view_item_list | Product list rendered | items, item_list_name, item_list_id | `retail-analytics.ts`, catalog caller | no | product fields only | item mapper spec |
| select_item | Helper ready; card click not wired (catalog claim) | items, list name/id | `retail-analytics.ts` | no | product fields only | not wired |
| view_item | Product page shown | currency IRR, value, items | `RetailPdpAnalytics.tsx` | no | product fields only | item mapper spec |
| add_to_wishlist | Wishlist toggle adds an item | currency IRR, value, items | `retail-wishlist.ts` | no | no phone/email | helper |
| add_to_cart | Cart add succeeds | currency IRR, value, items | `retail-cart.ts` | no | product fields only | spec runs on retail host |
| remove_from_cart | Cart remove succeeds | currency IRR, value, items | `retail-cart.ts` | no | product fields only | helper |
| view_cart | Cart drawer shows rows | currency IRR, value, items | `RetailCartDrawer.tsx` | no | product fields only | helper |
| begin_checkout | Checkout entry | currency IRR, value, items | checkout page | no | no address | helper |
| add_shipping_info | Shipping method saved | shipping_tier, items | checkout page | no | tier label only | helper |
| add_payment_info | Payment method chosen | payment_type, items | checkout page | no | provider code only | helper |
| purchase | Client, after paid verify, once per transaction_id | transaction_id, value, currency IRR, items, shipping, coupon | `RetailConversion.tsx` | yes, panel | no payer PII | dedupe spec |
| refund | No tracked refund flow | — | — | no | — | NOT APPLICABLE |
| search | Helper ready; catalog search box not wired | search_term, stripped | `retail-analytics.ts` | no | drops phone-like terms | spec |
| contact_click | Click on contact links in retail | contact_method | `GoogleAnalytics.tsx` | no | method only | spec |
| sign_up / login | Helper ready; auth pages not wired | method=sales_partner | `retail-analytics.ts` | sign_up optional | method only | param sanitizer spec |
| affiliate_catalog_view | First catalog payload | sales_channel=affiliate | `SalesPartnerCatalog.tsx` | no | no partner id | helper |
| affiliate_link_copied | Share link copied | sales_channel=affiliate | `SalesPartnerCatalog.tsx` | no | no code dimension | helper |
| affiliate_landing_view, affiliate_signup_start, affiliate_link_created, affiliate_order_created, affiliate_payment_link_sent | Helpers ready, call sites not wired | sales_channel=affiliate | `retail-analytics.ts` | order event optional | no person id | helper |

Item fields when present: `item_id` (SKU, else product id), `item_name`, `item_brand` `Taranom`, `item_category`, `item_variant` as `color / size`, `price`, `quantity`, `discount`, `index`, list id and name.
