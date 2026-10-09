# UTM standard — retail

Use lowercase values on links we control. Do not rewrite inbound UTMs in middleware.

| Channel | utm_source | utm_medium | Example utm_campaign |
|---|---|---|---|
| Instagram organic | `instagram` | `organic_social` | `affiliate_launch_1405_07` |
| Telegram | `telegram` | `organic_social` | campaign name |
| Rubika | `rubika` | `organic_social` | campaign name |
| Bale | `bale` | `organic_social` | campaign name |
| Torob click | `torob` | `cpc` | category or campaign |
| SMS | `sms` | `sms` | campaign name |
| Sales partner | `affiliate` | `affiliate` | campaign name |

Avoid `ig`, `IG`, `social`, and mixed case. `l.instagram.com` referrals cannot be renamed from the site. Bio and story links should use the row above.

Example:

`https://www.poshaktaranom.ir/?utm_source=instagram&utm_medium=organic_social&utm_campaign=affiliate_launch_1405_07`

Allowed on the recorded page path: the `utm_*` keys, click ids (`gclid`, `fbclid`, and the other ids in `sanitizeAnalyticsSearch`), plus `q`, `query`, `search`, `page`, `sort`, `color`, `size`, `category`, `collection`.
