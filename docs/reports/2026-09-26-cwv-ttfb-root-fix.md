# SEO/GEO Decision Report — poshaktaranom.ir + poshaktaranom.com — 2026-09-26

حالت اجرا: `incident` + `audit` (Core Web Vitals Assessment: Failed)

## Executive outcome

هر دو ویترین روی موبایل به‌خاطر **LCP بالای ۲٫۵ ثانیه** در PSI/CrUX مردودند؛ INP و CLS مشکلی ندارند. ریشهٔ مشترک **TTFB میدانی ۱٫۴–۱٫۶ ثانیه** است که با `stale-while-revalidate=60` روی HTML ویترین تشدید می‌شد. اصلاح کش HTML + هیرو mobile-first پیاده شد. ادعای Pass فوریٔ ۲۸روزهٔ field CWV نمی‌شود.

## Scope & evidence

| منبع | دسترسی | نتیجه |
|------|--------|--------|
| GSC Wizard MCP | لاگین شد؛ اشتراک trial تمام | API غیرقابل استفاده (`payment_required`) |
| GSC UI (مرورگر) | `rashidhamedas@gmail.com` | `sc-domain:poshaktaranom.com` کامل؛ `sc-domain:poshaktaranom.ir` CWV «داده کافی نیست» |
| PSI موبایل | 2026-09-26 | هر دو Failed روی LCP |
| Slack | جستجو | نتیجه‌ای مرتبط نبود |
| Origin SSH | VPS | HIT سریع؛ STALE ~۰٫۸s؛ بنر موبایل ~۶۴–۷۰KB |

### PSI / CrUX (موبایل، This URL)

| سایت | Field LCP | Field INP | Field CLS | Field TTFB | Field FCP | Lab Perf | Lab LCP |
|------|-----------|-----------|-----------|------------|-----------|----------|---------|
| `www.poshaktaranom.ir/` | **3.2–3.3 s** | 152–153 ms Good | 0 Good | **1.4 s** | 2.4 s | 86 | 3.9 s |
| `poshaktaranom.com/` | **3.0 s** | N/A | 0.01 Good | **1.6 s** | 2.5 s | 90 | 3.2 s |

Lab insights مشترک: render-blocking ~330–390ms؛ unused JS ~134–142KiB؛ image delivery ~44–72KiB.

### GSC `sc-domain:poshaktaranom.com` — CWV موبایل (آخرین آپدیت ۹/۲۳/۲۶)

| وضعیت | جزئیات |
|-------|--------|
| Poor | 0 |
| Need improvement | **16 URL / 2 issues** |
| Good | 0 |
| LCP > 2.5s | Need improvement — Validation **Started** — 16 URL |
| INP > 200ms | Need improvement — Validation **Passed** — 16 URL |
| LCP > 4s | 0 |

### GSC indexing `.com` (۹/۲۱/۲۶)

| دلیل | تعداد | اقدام |
|------|------:|--------|
| Page with redirect | 77 | عمدی (legacy WP/shop/`/retail`) — Validate Fix نزن |
| Excluded by noindex | 21 | عمدی (account/checkout/admin) |
| Discovered – not indexed | 22 | Passed |
| Crawled – not indexed | 3 | کیفیت/تقاضا — صفحه‌سازی اجباری نکن |
| Duplicate, Google chose different canonical | 1 | پایش نمونه |
| Not found (404) | 1 | Validation Started — پایش |
| Alternate page with proper canonical | 1 | طبیعی |

### GSC `sc-domain:poshaktaranom.ir`

- Overview زنده است؛ پیام‌های نخوانده ۳ عدد.
- CWV property: **Not enough data** — ارزیابی Failed کاربر از **PSI CrUX روی URL** است نه گزارش گروهی GSC دامنه.

## Findings

| ID | P | نوع | دامنه | شاهد | علت |
|----|---|-----|-------|------|-----|
| CWV-01 | P0 | Evidence | هوم تک+عمده | Field TTFB 1.4–1.6s؛ middleware `SWR=60` | پس از ~۲ دقیقه HTML از کش خارج می‌شود → LCP نمی‌تواند Good شود |
| CWV-02 | P1 | Evidence | هیرو | ۲ preload + img با `fetchPriority=high`؛ img پیش‌فرض دسکتاپ | رقابت پهنای باند روی موبایل |
| CWV-03 | P2 | Inference | Lab | unused JS / render-blocking | بودجه JS؛ GTM از قبل deferred |
| IDX-01 | — | Evidence | `.com` | ۷۷ redirect / ۲۱ noindex | رفتار صحیح؛ Validate Fix نزن |

## Delivery (این نشست)

1. `STOREFRONT_HTML_CACHE_CONTROL = public, s-maxage=60, stale-while-revalidate=86400`
2. هیرو retail/wholesale: mobile-first `img` + یک `preload` با `imageSrcSet`
3. تست واحد قرارداد کش؛ tsc web پاس

CMS همچنان با on-demand revalidate + warm تازه می‌شود؛ `s-maxage=60` حفظ شده.

## QA & release

- [ ] Deploy → هدر زنده `stale-while-revalidate=86400`
- [ ] هوم HIT/STALE TTFB از origin و از ایران
- [ ] HTML فقط یک `fetchPriority="high"` برای LCP
- [ ] بعد از ۲۸ روز field: Validate Fix فقط برای LCP>2.5s (نه redirect/noindex)

## Measurement

KPI: field LCP p75 موبایل هوم < 2.5s؛ TTFB p75 < 0.8s. Guardrail: تأخیر دیده شدن ادیت CMS ≤ ~۶۰s + warm.

Next review: ۷ روز پس از deploy (روند CrUX) و ۲۸ روز برای Pass رسمی.
