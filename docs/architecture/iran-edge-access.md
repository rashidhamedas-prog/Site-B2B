# Iran storefront edge access

Audience: implementers operating `poshaktaranom.ir` (retail) and `poshaktaranom.com` (wholesale).

## 1. Goals, non-goals, assumptions

**Goal:** A shopper on a normal Iranian residential IP (MCI, Irancell, Shatel, Rightel, …) opens either storefront in a normal browser without a VPN.

**Non-goals:** Moving the VPS, changing checkout/payments, replacing Next/nginx, enabling a new CDN account without owner credentials, or documenting third-party VPN software on the origin.

**Assumptions (labeled):**

- Confirmed 2026-10-02: both zones use Cloudflare NS and had **regressed to orange-cloud** (AAAA + `alt-svc: h3`) after the 2026-09-14 gray-cloud fix. Target remains **DNS-only** for shop A records.
- Confirmed: nginx and UFW do not country-block. Ports 80/443 allow anywhere.
- Confirmed: seven Iranian check-host nodes (Tehran / Isfahan / Shiraz, country `IR`) get HTTP 200 on both hostnames over IPv4, and TCP 443 to the origin in ~80–120 ms.
- Confirmed: the same nodes see Cloudflare A + AAAA, and some PoPs (`188.114.99.0`) take ~3.2–3.6 s while others (`188.114.96.3`, `104.21.x`) take ~0.3–0.7 s.
- Confirmed: this operator workstation exits via `5.75.200.102`, so it is not an Iran-residential vantage point.
- Assumption: “must enable VPN from an Iran IP” is a browser + residential-ISP failure on the Cloudflare path (IPv6 / HTTP/3 / anycast / JS challenge), not an application 4xx/5xx.
- Open: we did not drive a real MCI/Irancell handset in this session.

**Success criteria:**

1. Phone or PC on a home Iran IP, VPN off, opens `https://www.poshaktaranom.ir/` and `https://poshaktaranom.com/` to HTML `200` with `x-taranom-channel` set.
2. Public DNS for both hostnames has A records only (no AAAA) *or* an Iran-compatible edge in front.
3. Rollback is a single Cloudflare toggle back to the previous proxy/IPv6/HTTP3 values.

## 2. System context

```text
Iran residential browser
    → ISP DNS / DPI / IPv6 / UDP:443
        → Cloudflare anycast (188.114.x / 104.21.x / 172.67.x + AAAA + h3)
            → origin 5.75.200.102:443 nginx
                → Next web (RETAIL on .ir, WHOLESALE on .com)
Googlebot / foreign VPN
    → Cloudflare (usually IPv4, working PoP)
        → same origin
```

Trust boundary that matters here is **the public edge**, not the app. The app never sees a request that dies on IPv6, QUIC, or a Cloudflare interstitial.

## 3. Current delivery (target after 2026-10-02)

| Item | Evidence |
| --- | --- |
| Origin | Hetzner `5.75.200.102`, nginx TLS, Docker `web` |
| DNS | Cloudflare NS; shop A `@` / `www` / `api` **DNS-only** → origin IPv4 |
| Resolved A | Must be `5.75.200.102`, not `104.21.*` / `172.67.*` / `188.114.*` |
| AAAA | None on shop hostnames |
| HTTP/3 | Off at origin (HTTP/2). Must not advertise `alt-svc: h3` |
| SSL if any record is re-proxied | Full (strict) only. Never Flexible |
| App geo-block | None. nginx `geo` is only Torob rate-limit exemption |
| UFW | `80/443 ALLOW Anywhere` |
| GSC 15 Aug–11 Sep | Iran clicks: `.ir` 99, `.com` 53 (SERP clicks, not a load proof) |

Orange-cloud was turned on around 2026-08-30 / 2026-09-06 to cut Iran→Nuremberg TTFB. Before that, gray-cloud from Iran still loaded (home ~1317 ms). See `docs/reports/2026-08-30-vps-ttfb-diagnostic.md`.

## 4. Root cause

The sites are **not banned nationwide** and the **application does not reject Iran**.

The failure mode that matches “VPN off → dead, VPN on → works” for **both** `.ir` and `.com` is the **Cloudflare orange-cloud path** used by real browsers:

1. **AAAA + Happy Eyeballs.** Orange-cloud publishes IPv6. Iranian IPv6 is often broken or filtered. The browser tries IPv6 first and hangs until timeout. A VPN usually forces IPv4.
2. **HTTP/3 / QUIC.** The edge advertises `h3`. Many Iranian ISPs drop or stall UDP/443. The browser waits on QUIC before falling back to TCP.
3. **Anycast variance.** From Iran, some Cloudflare PoPs are fine (~0.3 s) and some are ~3.3 s (`188.114.99.0`). A residential ISP that only reaches a bad/filtered PoP looks like “the site never opens.”
4. **Challenge pages (secondary).** Bot Fight / High security / Under Attack can show a JS interstitial that check-host’s HTTP client never sees. The Cursor browser could not even pass Cloudflare’s own dashboard challenge.

Datacenter probes in Iran use IPv4 + HTTP/1.1, which is why check-host reports 200 while shoppers still need a VPN.

## 5. Ruled out

| Hypothesis | Why it is not the root |
| --- | --- |
| nginx / UFW country deny | No deny; 80/443 open; origin TCP 443 from 7 IR nodes ~80–120 ms |
| App WAF / `CF-IPCountry` | No such logic in `nginx/nginx.conf` |
| DNS poisoning of these names | Iranian nodes resolve the real Cloudflare A/AAAA set |
| Origin down | Foreign and IR-hosting HTTP 200; `Server: cloudflare`, `x-taranom-channel` present |
| Only `.com` filtered | `.ir` has the same orange-cloud + AAAA + h3 behavior |

## 6. Target architecture

Keep the modular monolith and Hetzner origin. Change **only the public edge** so the primary audience (Iran) hits a path that already works.

**Phase 0 — applied 2026-09-14 (reversible, no app deploy):**

Storefront A `@`/`www` on both zones are DNS-only. Free plan cannot disable IPv6 while proxied.

**If a later re-proxy happens:**

1. Cloudflare Network: **IPv6 Compatibility off**, **HTTP/3 off** on both zones.
2. Security: **Essentially Off**, Bot Fight / Super Bot Fight **off**, not Under Attack.
3. If shoppers still need a VPN: DNS A `@` and `www` → **DNS only (gray cloud)** on both zones. Origin already has Let’s Encrypt; Full (strict) can stay for a later re-proxy.
4. Do not add origin AAAA.

**Phase 1 — if gray-cloud TTFB or origin listing becomes a problem:**

Put an **Iran-compatible CDN** (typically Arvancloud) in front of the same origin. Cloudflare may remain NS or a secondary path for Googlebot, but Iranian browsers must not depend on CF anycast + AAAA + h3.

**Phase 2 — hygiene (mandatory):** do not share the public website **IP or SNI** with unrelated long-lived tunnels. A listed origin IP or a shop hostname used as tunnel TLS front recreates this outage even after gray-cloud. Keep tunnel listeners off `www.poshaktaranom.ir` / `poshaktaranom.com`.

```text
Phase 0 origin mode
Iran browser --IPv4/TCP--> 5.75.200.102 nginx --> Next

Phase 1 Iran CDN
Iran browser --IPv4/TCP--> Arvan edge --> 5.75.200.102 nginx --> Next
Other / Googlebot --> current or CF IPv4 --> same origin
```

## 7. Security

- Gray-cloud **exposes** `5.75.200.102`. That IP is already public in historical DNS and this repo.
- TLS stays on origin (existing certificates). Do not switch Cloudflare SSL to Flexible.
- Do not commit API tokens. The helper script reads `CLOUDFLARE_API_TOKEN` from the environment only.
- Softening Bot Fight is an availability choice for an Iran-only shop; rate limits on `/v1` stay in nginx.
- No change to auth, payments, or admin guards.

## 8. Rollout and rollback

1. Snapshot current DNS (A/AAAA, proxied flag) and Network/Security toggles.
2. Apply Phase 0 `--mode network` (IPv6/HTTP3/security). TTL is 300 s.
3. From a phone on home data, VPN off, open both homes.
4. If still dead, `--mode origin` (gray-cloud). Recheck.
5. Rollback: restore proxied=true and previous Network toggles. Cache rules already in the account stay inert while gray.

No VPS rebuild is required. Do not run `auto-deploy` for this change.

## 9. Tests

- `node --test scripts/cloudflare-iran-edge.spec.mjs`
- After apply: `Resolve-DnsName www.poshaktaranom.ir -Type AAAA` must be empty; `curl -sI https://www.poshaktaranom.ir/` must **not** send `alt-svc: h3` if HTTP/3 is off; `Server` is `nginx` when gray, `cloudflare` when still proxied.
- Iran phone, VPN off: both homes render.

## 10. Decisions requiring confirmation

- Owner Cloudflare login or API token (Zone DNS + Zone Settings Edit) to apply Phase 0 live.
- Whether Phase 1 should be Arvancloud (account + NS/CNAME) versus staying on origin IPv4.
- Whether the public website should keep sharing `5.75.200.102` with other services.
