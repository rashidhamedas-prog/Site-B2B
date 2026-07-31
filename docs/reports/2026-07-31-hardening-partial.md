# گزارش: Hardening جزئی پلتفرم ترنم

**تاریخ:** 2026-07-31  
**منبع:** `cursor-project-hardening-plan.md`  
**Handoff باقی‌مانده:** [chatgpt-hardening-handoff.md](./chatgpt-hardening-handoff.md)

## هدف

اجرای حداکثر hardening کدی بدون rotate credentialهای live، بدون rewrite تاریخچه Git، و بدون deploy/push (تأیید مالک لازم است).

## انجام‌شده

1. **Task 1 کد:** پاک‌سازی فایل‌های credential، seed fail-closed، JWT prod، gitignore، README/اسکریپت
2. **Task 2:** OTP Redis+hash، fail-closed production، DTO، forbidNonWhitelisted، IDOR، عدم auto-approve B2B
3. **Task 3:** shipping server-side، stock/wallet/discount atomic، idempotencyKey، state transitions، ACTIVE gate
4. **Task 4:** مبلغ از DB، authority match، sync order/invoice، unique indexes
5. **Task 6/8 جزئی:** unit check OTP در CI، حذف fake products، Modal focus trap
6. Migration + safety-net SQL

## تست

- `npx tsc --noEmit` در `apps/api` → موفق
- `auth.otp.logic.spec.ts` → موفق
- تست concurrency ۵۰تایی / E2E / secret scan history → انجام نشد (handoff)

## ریسک / باقی‌مانده

- Credentialهای قبلی در تاریخچه Git هنوز ممکن است باشند → Task 1 ops
- Checkout هنوز یک QueryRunner واحد برای stock ندارد
- Company Account / Playwright / Sentry / backup off-box → handoff

## API / DB / env

- ستون جدید: `orders.idempotencyKey`
- Index یکتا (partial): payments.authority، payments.refId، orders.idempotencyKey
- Env نمونه: `SEED_ADMIN_*`, `OTP_*` در `.env.example`
