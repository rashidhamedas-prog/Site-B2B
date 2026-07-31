# ChatGPT Handoff — تکمیل Hardening پلتفرم ترنم

تاریخ: 2026-07-31  
منبع پلن: `cursor-project-hardening-plan.md`  
وضعیت: بخشی از Tasks 1–4 و 6/8 در Cursor انجام شده؛ باقی برای ChatGPT / مالک.

**قانون مطلق:** هیچ secret، رمز، token، یا مقدار واقعی `.env` در کد، commit، chat، یا این فایل تکرار نشود.

---

## آنچه Cursor انجام داد (قابل اتکا)

### Task 1 — فقط کد (بدون ops)

| کار | فایل |
|-----|------|
| محتوای credential از `TARANOM-SERVER-INFO.txt` حذف و به stub عمومی تبدیل شد | `TARANOM-SERVER-INFO.txt` |
| `.gitignore` برای secrets / `scripts/tmp-*` / pem | `.gitignore` |
| Seed fail-closed در production (`SEED_ADMIN_PHONE` + `SEED_ADMIN_PASSWORD`) | `apps/api/src/seed.ts` |
| JWT بدون fallback ضعیف در production (min 32 chars) | `auth.module.ts`, `jwt.strategy.ts` |
| README و `scripts/test-admin-login.sh` بدون credential واقعی | `README.md`, اسکریپت |
| متغیرهای seed/OTP در `.env.example` | `.env.example` |

**انجام نشده (نیاز مالک):** rotate همه credentialهای افشاشده، توقف deploy، audit لاگ، `git-filter-repo`/BFG، force-push، GitHub Push Protection.

### Task 2 — Auth / OTP / IDOR / DTO

| کار | جزئیات |
|-----|--------|
| OTP hashed + Redis (`ioredis`) با fallback memory | `apps/api/src/modules/redis/redis.module.ts` |
| `devCode` فقط با `OTP_DEV_EXPOSE_CODE=true` و غیر-production | `auth.service.ts` |
| SMS failure در production → 503، بدون افشای کد | همان |
| OTP حساب B2B PENDING/BLOCKED را ACTIVE نمی‌کند | `verifyRetailOtp` |
| DTO برای OTP / profile / password | `auth/dto/otp.dto.ts` |
| `forbidNonWhitelisted: true` | `main.ts` |
| IDOR: customerId از JWT برای غیر-staff | `order.controller.ts`, `payment.controller.ts` |

### Task 3 — Checkout

| کار | جزئیات |
|-----|--------|
| وضعیت ACTIVE قبل از create | `order.service.ts` |
| shipping فقط server-side (ignore `freeShipping`/fee کلاینت) | همان |
| موجودی atomic با conditional UPDATE (بدون `Math.max(0)`) | `product.service.ts` |
| wallet debit atomic | `customer.service.ts` |
| discount `usedCount` atomic با سقف | `discount.service.ts` |
| `idempotencyKey` روی Order + شماره سفارش با suffix تصادفی | entity + create |
| state transition guard برای Order | `ORDER_TRANSITIONS` |
| rollback بهترین‌تلاش اگر stock/wallet/discount بعد از save شکست بخورد | create |

**محدودیت شناخته‌شده:** stock/wallet هنوز از repository جدا از QueryRunner استفاده می‌کنند (نه یک connection واحد). برای اتمیسیته کامل، متدهای stock باید `EntityManager` بپذیرند.

### Task 4 — Payment

| کار | جزئیات |
|-----|--------|
| مبلغ از order/invoice در DB (نه body) | `payment.service.ts` |
| ownership order ↔ customerId | همان |
| authority باید با مقدار ذخیره‌شده match کند | `verify` |
| sync Order→CONFIRMED و Invoice paidAmount | `verify` |
| unique partial indexes روی authority/refId/idempotencyKey | migration + safety-net SQL |
| DTO برای start/verify/manual | `order/dto/create-order.dto.ts` |

### Task 6 جزئی

- تست منطق OTP: `apps/api/src/modules/auth/auth.otp.logic.spec.ts` (در CI اجرا می‌شود)
- CI: قبل از typecheck این تست را اجرا می‌کند

### Task 8 جزئی

- حذف FALLBACK محصولات ساختگی در `RetailProductGrid.tsx` → empty/error صادقانه
- `Modal.tsx`: focus trap واقعی + restore + Escape + scroll lock

### Migration / safety-net

- `apps/api/src/database/migrations/20260731-001-hardening-payment-order-unique.ts`
- انتهای `scripts/apply-production-schema.sql`

---

## کارهای باقی‌مانده برای ChatGPT (به ترتیب اولویت)

### P0 — Task 1 ops (فقط با تأیید کتبی مالک)

1. توقف auto-deploy / timer موازی روی VPS.
2. Rotate: SSH، PostgreSQL، Redis، MinIO، Meilisearch، JWT، SMS، payment merchants، admin password.
3. Audit لاگ SSH/admin/API برای دسترسی مشکوک.
4. Backup DB، سپس `git filter-repo` یا BFG برای حذف `TARANOM-SERVER-INFO.txt` و credentialها از **کل تاریخچه**.
5. همه cloneها را force-sync؛ GitHub Secret Scanning + Push Protection.
6. Runbook خصوصی خارج از Git.

خروجی مورد انتظار: credentialهای قدیمی کار نکنند؛ secret scan روی HEAD و history پاک.

### P0 — تکمیل اتمیسیته checkout

1. `ProductService.updateVariantStock(manager, ...)` و `CustomerService.updateBalance(manager, ...)` و `DiscountService.recordUse(manager, ...)` با `EntityManager`.
2. کل create داخل یک `queryRunner` واحد.
3. تست concurrency: ۵۰ checkout هم‌زمان روی stock=1 فقط یکی موفق.
4. Wallet/discount از سقف عبور نکنند (تست).

### P0 — Payment تکمیل

1. Outbox برای affiliate postback + retry/dedup.
2. Expiry job برای PENDING payments.
3. Refund state machine + ledger immutable.
4. Reconciliation job درگاه ↔ Payment ↔ Order ↔ Invoice.
5. Rate limit روی start/verify.

### P1 — Task 5 B2B domain (از صفر نسبی)

موجود الان: فقط `creditLimit`/`balance` روی Customer.

باید ساخته شود:

- Entity `Company` + locations + users با نقش‌های `COMPANY_ADMIN|BUYER|APPROVER|ACCOUNTANT`
- Scope همه queryها با `companyId`
- Credit Used / Available / Net 15/30/60/90 + aging + reminders
- Quote workflow (version, line price, approval, expiry → order idempotent)
- PO Number در checkout/invoice/PDF
- Price list / tier / MOQ / carton / approval threshold
- ADR در `docs/adr/`

### P1 — Task 6 کامل

- ESLint/Biome واقعی برای monorepo (الان API فقط script بدون config محکم)
- Jest/Vitest + Supertest integration برای auth/OTP/IDOR/order/payment
- Playwright E2E catalog→checkout B2B و B2C
- Husky + lint-staged
- CI کامل: format → lint → typecheck → unit → integration → build → e2e-smoke → CodeQL → npm audit → Trivy → SBOM
- Branch protection + required checks

### P1 — Task 7 DevOps

- GitHub Environment با approval؛ حذف deploy هر push موازی با timer
- Image digest-pin؛ actions pin به SHA
- API Dockerfile: USER nonroot، healthcheck، cap-drop
- حذف اتکای دائمی به safety-net SQL به‌عنوان منبع حقیقت schema
- Backup رمزگذاری‌شده off-VPS + restore drill
- Blue/green یا rolling + rollback خودکار
- ShellCheck روی `deploy.sh` / `auto-deploy.sh`

### P2 — Task 8 باقی

- Facets API مستقل با count (نه از ۲۴ نتیجه صفحه)
- Wholesale pagination واقعی در URL
- انتقال همه modalهای ادمین به Modal مشترک
- mega-menu keyboard/touch
- axe + Playwright a11y
- reorder / draft / wishlist / autocomplete / abandoned cart (بعد از تأیید محصولی)

### P2 — Task 9

- Sitemap chunk/index از `updatedAt` واقعی
- JSON-LD از CMS/settings (حذف hardcode)
- formatter مرکزی تومان/ریال + catalog فارسی
- Aggregate SQL + index + Redis cache با invalidation
- Pino/JSON logs + correlation ID + redaction
- Sentry + OpenTelemetry
- Lighthouse CI + budget

### P2 — Task 10

- پاک‌سازی `scripts/tmp-*` با اجازه مالک
- README/SETUP/Swagger/runbook هم‌تراز رفتار واقعی
- threat model OWASP ASVS
- load test + failure/rollback drill
- production release تدریجی + ۲۴h monitoring

---

## دستورالعمل اجرایی برای ChatGPT

1. اول `docs/WORKLOG.md` و این فایل را بخوان؛ فایل‌های `scripts/tmp-*` را بدون اجازه دست نزن.
2. هر task را در branch جدا (`hardening/task-N-slug`) با Conventional Commits بساز.
3. بعد از هر تغییر: WORKLOG + در صورت نیاز `docs/reports/YYYY-MM-DD-*.md`.
4. Deploy / force-push / rotate / migration production فقط با تأیید صریح مالک.
5. تست‌ها را واقعاً اجرا کن و نتیجه را بنویس؛ «اجرا نشد» را موفق گزارش نکن.
6. Secret واقعی هرگز در diff/گزارش ننویس.

### نقطه ورود کد (فایل‌های کلیدی)

```
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/redis/redis.module.ts
apps/api/src/modules/order/order.service.ts
apps/api/src/modules/order/order.controller.ts
apps/api/src/modules/payment/payment.service.ts
apps/api/src/modules/product/product.service.ts
apps/api/src/modules/customer/customer.service.ts
apps/api/src/modules/discount/discount.service.ts
apps/web/src/components/retail/RetailProductGrid.tsx
apps/web/src/components/ui/Modal.tsx
cursor-project-hardening-plan.md
```

### Envهای جدید (نمونه فقط)

```
SEED_ADMIN_PHONE=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_EMAIL=
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DEV_EXPOSE_CODE=false
```

Production: `JWT_SECRET` حداقل ۳۲ کاراکتر؛ بدون آن API استارت نمی‌شود.

---

## معیار Done When (از پلن اصلی — هنوز کامل نیست)

- [ ] هیچ secret واقعی در HEAD/history/docs/logs
- [ ] auth/checkout/inventory/wallet/discount/payment در برابر concurrency/replay/IDOR تست‌شده
- [ ] Company Account tenant-safe
- [ ] CI gates اجباری و سبز
- [ ] deploy/migration/backup/restore مستند و آزمایش‌شده
- [ ] UX/a11y/SEO/observability معیارها را پاس کرده‌اند
- [ ] WORKLOG/reports/ADR/memory به‌روز

---

## پیشنهاد ترتیب کار ChatGPT در یک نشست

1. تکمیل QueryRunner واحد برای checkout (P0)  
2. تست‌های integration auth+payment+order  
3. ESLint + Jest واقعی + Playwright smoke  
4. Task 5 Company scaffold + migration  
5. Task 1 ops را فقط اگر مالک تأیید کرد، به‌صورت runbook اجرایی جدا بنویس (اجرا روی سرور توسط انسان)  
