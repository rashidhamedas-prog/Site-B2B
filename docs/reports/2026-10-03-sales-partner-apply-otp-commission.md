# Sales-partner apply OTP + eligibility + per-product commission

Date: 2026-10-03  
Task: `TASK-20261003-001`  
Depth: skill-top **full**

## Executive outcome

ثبت‌نام همکار بازاریاب دیگر با OTP فارسی/انگلیسی و تایمر ۲ دقیقه‌ای پایدار می‌شود؛ باگ ریدایرکت ۴۰۱ که کاربر را از فرم بیرون می‌انداخت بسته شد؛ مجاز کردن محصول با پورسانت محصولی (`scope=PRODUCT`) ذخیره می‌شود.

## Maryam Norouzi (live DB)

| Field | Value |
| --- | --- |
| applicationId | `cf7ef9a3-e947-4195-92f3-64146feacae1` |
| phone | `09010282085` |
| status | `PENDING_OTP` |
| createdAt | 2026-10-01 22:18 UTC |
| updatedAt | 2026-10-02 20:06 UTC (latest OTP request) |
| otp_requested audits | **3** |
| application.submitted | **0** |
| profile | none |
| users row | `CUSTOMER`, **`isActive=false`** |

Root cause (Evidence): OTP never verified successfully. Contributing bugs:

1. Persian OTP digits not normalized → verify fail → `401` → `apiClient` redirected `/sales-partnership` to `/portal/login` (user left OTP step; row stayed `PENDING_OTP`).
2. Inactive CUSTOMER account would have blocked a clean post-verify path; code now reactivates CUSTOMER on successful verify.
3. Resend worked (3 OTP audits) but completion never happened.

**Remediation after deploy:** مریم یک‌بار دیگر کد پیامک را وارد کند (ارقام فارسی/انگلیسی هر دو OK). اگر SMS نرسید، از «ارسال مجدد» بعد از ۲ دقیقه. در صورت نیاز، ادمین می‌تواند پس از verify دستی بررسی کند — وضعیت باید `PENDING_REVIEW` شود نه مستقیم APPROVED.

## Findings → fixes

| ID | P | Issue | Fix |
| --- | --- | --- | --- |
| F1 | P0 | Wrong OTP → 401 → forced redirect off apply page | `apiClient` skips redirect for `/otp/verify` and `/sales-partner-applications/verify` |
| F2 | P0 | FA/AR OTP & nationalId rejected | DTO `normalizeOtpCode`; apply-form `toAsciiDigits`; `OtpService.verify` normalizes; frontend normalize |
| F3 | P1 | Resend timer 60s (wanted 120 for SP) | `OTP_SALES_PARTNER_RESEND_COOLDOWN_SECONDS` default **120** for `sales_partner*` purposes |
| F4 | P1 | Apply UI hang if promise never settles busy | `try/finally` on submit/resend |
| F5 | P1 | Product allow felt broken (vendor margin / prompt / 0% preview) | Inline % + persist PRODUCT rule; margin uses same % |
| F6 | P1 | No per-product commission UI | Upsert `sales_commission_rules` scope=`PRODUCT` from catalog admin |

## Architecture notes

- Eligibility table stays allow/deny + images + margin audit.
- Commission resolution unchanged: `PARTNER_PRODUCT > PARTNER_CATEGORY > PRODUCT > CATEGORY > PROGRAM`.
- Enabling with `commissionPercentOverride` deactivates prior PRODUCT rules for that SKU and inserts a new versioned row.
- Draft/ledger continue to snapshot percent at price/earn time.

## Validation run

- `otp-cooldown.spec.ts` OK (incl. SP 120s + Persian OTP verify)
- `sales-partner-apply-form.spec.ts` OK (FA phone/nid)
- `phone.util.spec.ts` OK
- `sales-commission-policy.spec.ts` OK
- `apps/web` `tsc --noEmit` OK
- `apps/api` `tsc` shows pre-existing errors in `erp-inventory.service.spec.ts` only (unrelated)

## SEO/GEO

N/A — admin + authenticated apply OTP flow; no public indexable template change.

## Slack

No matching threads for بازاریاب/OTP/ثبت.

## Next

1. Owner approve → commit + push + VPS deploy (set env optional; code default 120).
2. Smoke: apply OTP timer 120; FA digits; wrong OTP stays on form; enable product + save %; Maryam retry verify.
3. Independent Reviewer + Security residual (OTP auth + PII).
