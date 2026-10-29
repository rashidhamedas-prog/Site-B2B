# 2026-10-29 — CURSOR-FIX: checkout auth redirects, payment, /account host, solid login UI

**Branch:** `fix/checkout-auth-redirects` (from `origin/master`)  
**Source package:** Desktop `cursor-fix-package.zip`  
**Deploy:** GO حامد 2026-10-29 → push `master` + Iran auto-deploy

## مشکل

قیف فروش قبل از `/payments/start` می‌شکست: روی خرده (`www.poshaktaranom.ir`) مسیر عمومی `/checkout` با ۴۰۱ به `/portal/login` می‌رفت و middleware آن را به عمده (`poshaktaranom.com`) می‌فرستاد. هم‌زمان `.com/account` به `.ir/account` می‌رفت و سشن از بین می‌رفت. UI ورود با `backdrop-filter` سنگین بود.

## تغییرات (A→D در یک برنچ)

| لایه | خلاصه |
|------|--------|
| **A** | `resolveShopperLoginUrl` + هر دو handler ۴۰۱ در `api.ts`؛ گزینه `authRedirect: false`؛ حذف auto-redirect ۳۰۰ms مهمان عمده؛ CTA «ورود برای ثبت سفارش» |
| **B** | `payments/start` با `resolveOwnCustomerId` مثل orders؛ لینک B2C در retail password login؛ در production بدون merchant → خطا به‌جای sandbox خاموش؛ checkout خرده با soft state + `authRedirect: false` |
| **C** | `.com/account*` → همان‌دامنه `/portal/login`؛ `clearCookie` با `Secure`/`SameSite`؛ حذف `/account` `/login` `/cart` `/checkout` از robots Disallow |
| **D** | `auth.css` جامد؛ حذف glass/blur/confetti/framer از مسیرهای ورود؛ OTP `maxLength={6}`؛ label مرئی |

## تست

- Unit: `shopper-auth-redirect`, `panel-host-lock`, `robots-policy`, `safe-redirect`, `shopper-channel`, `payment-core.hardening` — OK  
- `apps/web` `tsc --noEmit` — OK  
- E2E: `checkout.spec.ts` به‌روز شد؛ `checkout-auth.spec.ts` اضافه شد (نیاز به runner محلی)

## پذیرش دستی بعد از deploy

1. `.ir`: سبد → checkout روی همان host؛ ۴۰۱ → `/account?redirect=%2Fcheckout` نه `.com`  
2. OTP → checkout → زرین‌پال production (نه sandbox) → cancel → callback همان host  
3. `.com/account` نباید به `.ir` برود  
4. صفحات ورود بدون `backdrop-filter`

## باقیمانده

- OTP/فرم تکمیل حساب **داخل** خود checkout (فعلاً بنر + لینک به `/account`)  
- حذف فایل مرده `Confetti.tsx`  
- اجرای Playwright روی runner خارجی  
- تنظیم ادمین `retailCallbackUrl` به `https://www.poshaktaranom.ir/payment/callback` (ops، نه کد)

## Rollback

`git revert` روی merge این برنچ پس از GO؛ بدون migration.
