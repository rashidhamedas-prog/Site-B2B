# Iran storefront edge access

Audience: implementers operating `poshaktaranom.ir` (retail) and `poshaktaranom.com` (wholesale).

## 1. Goals, non-goals, assumptions

**Goal:** A shopper on a normal Iranian residential IP (MCI, Irancell, Shatel, Rightel, …) opens either storefront in a normal browser without a VPN.

**Locked 2026-10-10:** shop DNS (`poshaktaranom.com`, `www`, `api.poshaktaranom.com`, `poshaktaranom.ir`, `www.poshaktaranom.ir`) stays **proxied**. IPv6 compatibility and HTTP/3 stay **off** (no AAAA, no `alt-svc: h3`). Do not gray-cloud these names. Direct TLS to `5.75.200.102` times out from most Iranian networks even though TCP/443 connects. Rollback to gray-cloud requires `scripts/cloudflare-iran-edge.mjs --mode origin --apply --confirm-gray`.

**Non-goals:** Moving the VPS, changing checkout/payments, replacing Next/nginx, enabling a new CDN account without owner credentials, or documenting third-party VPN software on the origin.

**Assumptions (labeled):**

- Confirmed 2026-10-10: shop names are proxied, IPv6 and HTTP/3 are off, and Iran HTTPS to the wholesale apex returns 200. The 2026-10-02 gray-cloud target is retired.
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
| DNS | Cloudflare NS; shop A `@` / `www` / `api` **proxied**. Origin stays `5.75.200.102` |
| Resolved A | Cloudflare anycast (`104.21.*` / `172.67.*` / `188.114.*`), never the raw origin, for shop names |
| AAAA | None on shop hostnames |
| HTTP/3 | Off at origin (HTTP/2). Must not advertise `alt-svc: h3` |
| SSL if any record is re-proxied | Full (strict) only. Never Flexible |
| App geo-block | None. nginx `geo` is only Torob rate-limit exemption |
| UFW | `80/443 ALLOW Anywhere` |
| GSC 15 Aug–11 Sep | Iran clicks: `.ir` 99, `.com` 53 (SERP clicks, not a load proof) |

Orange-cloud was turned on around 2026-08-30 / 2026-09-06 to cut Iran→Nuremberg TTFB. Before that, gray-cloud from Iran still loaded (home ~1317 ms). See `docs/reports/2026-08-30-vps-ttfb-diagnostic.md`.

## 4. Root cause

**Supersedes the 2026-10-02 gray-cloud conclusion for shoppers.** Measured 2026-10-10 from seven Iranian check-host nodes:

- TCP/443 to `5.75.200.102` succeeded in ~70–100 ms on every node.
- HTTPS to gray-cloud `https://poshaktaranom.com/` **timed out (~19 s)** on Tehran, Isfahan, and Shiraz. One Qom node returned 200.
- The same nodes fetched proxied `https://www.poshaktaranom.ir/` in ~0.5 s.
- After proxying the wholesale names, those nodes returned **200 in ~0.4–0.7 s** (one Shiraz node 2.5 s) via Cloudflare addresses, with `x-taranom-channel: WHOLESALE`. No AAAA. No `alt-svc: h3`.

The application does not reject Iran. The failure is **TLS to the raw Hetzner address** on Iranian paths. Gray-cloud exposes that address. Orange-cloud with IPv6 and HTTP/3 off does not.

The 2026-10-02 notes below described an earlier orange-cloud regression (AAAA + HTTP/3). Those two settings are already off on the Free plan for these zones and must stay off. They are not a reason to un-proxy the shops.

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
| Only the `.com` name is nationally filtered | After proxy, Iranian nodes reach `.com` over TLS in under a second. The timeout was the raw origin address |

## 6. Target architecture

Keep the modular monolith and Hetzner origin. Change **only the public edge** so the primary audience (Iran) hits a path that already works.

**Phase 0 — locked 2026-10-10 (reversible only with `--confirm-gray`):**

Storefront A records are proxied. IPv6 compatibility and HTTP/3 are off, so the proxied names have no AAAA and do not advertise HTTP/3. Keep it that way. Gray-cloud is the outage, not the fix.

**If a later re-proxy happens:**

1. Cloudflare Network: **IPv6 Compatibility off**, **HTTP/3 off** on both zones.
2. Security: **Essentially Off**, Bot Fight / Super Bot Fight **off**, not Under Attack.
3. If shoppers still need a VPN, do **not** gray-cloud the shop. Re-check that IPv6 and HTTP/3 are off and that Iran HTTPS hits a Cloudflare address. Gray-cloud is an explicit rollback only.
4. Do not add origin AAAA. SSL stays **Full (strict)**.

**Phase 1 — only if Cloudflare anycast from Iran is slow again:**

Put an Iran-compatible CDN in front of the same origin. Do not fall back to publishing `5.75.200.102` on the shop names.

**Phase 2 — hygiene (mandatory):** do not share the public website **IP or SNI** with unrelated long-lived tunnels. A listed origin IP or a shop hostname used as tunnel TLS front recreates this outage even after gray-cloud. Keep tunnel listeners off `www.poshaktaranom.ir` / `poshaktaranom.com`.

```text
Locked path
Iran browser --IPv4/TCP--> Cloudflare (no AAAA, no h3) --> 5.75.200.102 nginx --> Next

Do not use
Iran browser --TLS--> 5.75.200.102   (TCP connects, HTTPS times out)
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
4. Keep `--mode proxy`. Do not run `--mode origin` unless rolling back on purpose (`--confirm-gray`).
5. Rollback to gray-cloud: `--mode origin --apply --confirm-gray`. That publishes `5.75.200.102` again and brings the Iran TLS timeout back.

No VPS rebuild is required. Do not run `auto-deploy` for this change.

## 9. Tests

- `node --test scripts/cloudflare-iran-edge.spec.mjs`
- After apply: `Resolve-DnsName www.poshaktaranom.ir -Type AAAA` must be empty; `curl -sI https://www.poshaktaranom.ir/` must **not** send `alt-svc: h3` if HTTP/3 is off; `Server` is `nginx` when gray, `cloudflare` when still proxied.
- Iran phone, VPN off: both homes render.

## 10. Decisions requiring confirmation

- Owner Cloudflare login or API token (Zone DNS + Zone Settings Edit) to apply Phase 0 live.
- Whether Phase 1 should be Arvancloud (account + NS/CNAME) versus staying on origin IPv4.
- Whether the public website should keep sharing `5.75.200.102` with other services.
