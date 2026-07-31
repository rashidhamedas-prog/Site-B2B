# برنامه جامع اصلاح، امن‌سازی و ارتقای پلتفرم ترنم

## هدف و شیوه استفاده

این سند دستورکار اجرایی Cursor برای رساندن پلتفرم B2B/B2C ترنم به سطح production-grade است. کارها دقیقاً به ترتیب نوشته‌شده انجام شوند. هر task باید در یک branch/PR کوچک، قابل بازبینی و دارای تست مستقل باشد. تا زمانی که معیار پذیرش یک task کامل نشده، task بعدی شروع نشود.

> **هشدار امنیتی:** هیچ secret، رمز، token، credential یا مقدار فایل `.env` در commit، log، گزارش، screenshot یا پیام PR تکرار نشود. عملیات rotate/revoke، پاک‌سازی تاریخچه Git، force-push، migration production، حذف داده و deploy فقط با تأیید صریح مالک پروژه انجام شود.

## قانون اجباری ثبت تغییرات برای Cursor و Codex

برای هر تغییر، حتی اگر کوچک باشد:

1. قبل از ویرایش، `git status` و مستندات مرتبط خوانده شود و فایل‌های untracked متعلق به کاربر دست‌نخورده بمانند.
2. خلاصه تغییر در `docs/WORKLOG.md` درج شود.
3. برای تغییر مهم، گزارش `docs/reports/YYYY-MM-DD-<slug>.md` ساخته شود.
4. تصمیم معماری در `docs/adr/NNNN-<slug>.md` و حافظه ابزارها/ریسک‌ها در `.Codex/memory.json` ثبت شود.
5. گزارش شامل هدف، علت، فایل‌ها، API/DB/env، migration، تست‌های اجراشده، نتیجه، ریسک و کار باقی‌مانده باشد.
6. متغیر جدید فقط با مقدار نمونه امن در `.env.example` مستند شود؛ مقدار واقعی هرگز commit نشود.
7. بعد از هر task، format، lint، typecheck، test و build مرتبط اجرا و نتیجه واقعی ثبت شود؛ نتیجه اجرا‌نشده «موفق» نوشته نشود.
8. commitها Conventional Commits و کوچک باشند؛ deploy و force-push بدون اجازه مالک ممنوع است.

## Tasks

- [ ] **Task 1 — مهار فوری افشای اسرار و دسترسی production**
  - ابتدا deploy خودکار production متوقف و یک incident report خصوصی ایجاد شود.
  - همه credentialهای افشاشده شامل admin، PostgreSQL، Redis، MinIO، Meilisearch، JWT، SMS/payment API و SSH rotate/revoke شوند؛ لاگ‌های SSH، admin، API و DB برای دسترسی مشکوک audit شوند.
  - `TARANOM-SERVER-INFO.txt`، credentialهای ثابت `apps/api/src/seed.ts`، `README.md` و `scripts/test-admin-login.sh` پاک‌سازی شوند. seed در production فقط secret یک‌بارمصرف/تصادفی بپذیرد و بدون آن fail شود.
  - پس از backup و تأیید مالک، فایل حساس با `git-filter-repo` یا BFG از کل تاریخچه پاک و clones/forks هماهنگ شوند؛ GitHub Secret Scanning و Push Protection فعال شود.
  - `.gitignore`، `.env.example` و یک runbook خصوصی برای مدیریت secrets اصلاح شوند؛ public docs و private operations از هم جدا باشند.
  - **Verify:** جست‌وجوی secret scan در HEAD و history پاک باشد؛ credentialهای قبلی کار نکنند؛ ورود با credential جدید و health check موفق باشد؛ هیچ secret در diff/WORKLOG دیده نشود.

- [ ] **Task 2 — امن‌سازی authentication، OTP، authorization و ورودی‌ها**
  - در `apps/api/src/modules/auth/auth.service.ts` بازگشت `devCode` فقط برای development محلی مجاز و در production کاملاً fail-closed شود.
  - OTP به Redis با hash، TTL کوتاه، single-use، resend cooldown، سقف تلاش، rate limit شماره/IP/device و CAPTCHA بعد از رفتار مشکوک منتقل شود؛ SMS failure هیچ کدی افشا نکند.
  - وضعیت `PENDING/BLOCKED/SUSPENDED` و مجوز B2B هنگام login و هر عملیات حساس enforce شود؛ OTP هیچ حساب غیرفعالی را خودکار مجاز نکند.
  - JWT بدون secret معتبر در production startup نشود؛ `tokenVersion`/session revocation، logout-all، password policy، محدودیت login و audit log اضافه شود.
  - همه `@Body() any` در auth/order/payment/settings با DTOهای `class-validator` یا Zod جایگزین شوند؛ `forbidNonWhitelisted` فعال و bounds رشته/عدد/enum اعمال شود.
  - IDOR مسیرهای installment/quote/order/payment رفع شود: customer ID از JWT و Company context استخراج شود و فقط admin بتواند شناسه دلخواه بدهد.
  - **Verify:** تست production SMS failure هیچ OTP برنگرداند؛ تست rate limit/replay/expiry پاس شود؛ pending B2B نتواند سفارش عمده بسازد؛ IDOR و payloadهای منفی/NaN/بزرگ/اضافی با 400/403 رد شوند.

- [ ] **Task 3 — اتمیک‌کردن checkout، موجودی، کیف پول، تخفیف و لغو**
  - ساخت سفارش در `apps/api/src/modules/order/order.service.ts` با TypeORM `QueryRunner` در یک transaction انجام شود: resolve مشتری/کانال، قیمت، MOQ، موجودی، shipping، discount، wallet/credit، order/items، invoice و inventory movement.
  - کانال `WHOLESALE/RETAIL` و تمام قیمت‌ها و هزینه ارسال فقط server-side از customer/site/settings تعیین شوند؛ `freeShipping` یا fee کلاینت نادیده گرفته شود.
  - موجودی با conditional atomic update یا row lock کم شود؛ `Math.max(0)` حذف و کمبود موجودی خطا دهد. wallet debit و discount `usedCount` نیز conditional atomic باشند.
  - شماره سفارش به DB sequence/UUID+unique retry منتقل و `idempotencyKey` یکتا برای checkout اضافه شود.
  - لغو، void، edit و reverse effects داخل transaction و با row lock/state guard اجرا شوند تا double-restock/refund ممکن نباشد؛ failure وسط عملیات rollback کامل کند.
  - state machine صریح برای Order/Invoice/Payment تعریف شود و transition آزاد حذف گردد؛ هر transition مجوز، actor، reason، timestamp و audit event داشته باشد.
  - **Verify:** تست ۵۰ checkout هم‌زمان روی آخرین موجودی فقط تعداد مجاز را موفق کند؛ wallet/discount از سقف عبور نکند؛ failure injection هیچ partial state نسازد؛ cancel+void هم‌زمان فقط یک reversal ایجاد کند.

- [ ] **Task 4 — بازطراحی پرداخت، callback، refund و reconciliation**
  - `amount/customerId/orderId/invoiceId` از body قابل اعتماد نباشند؛ سفارش/فاکتور متعلق به مشتری از DB resolve و مبلغ server-side محاسبه شود.
  - `authority` callback دقیقاً با authority ذخیره‌شده مقایسه و روی authority/refId unique constraint گذاشته شود؛ callback تکراری idempotent باشد.
  - تغییر Payment، Order، Invoice، wallet/credit و affiliate postback در یک transaction/outbox مطمئن انجام شود؛ postback خارجی retry و deduplication داشته باشد.
  - expiry برای پرداخت معلق، retry امن، refund state machine و ledger immutable ساخته شود؛ job reconciliation مغایرت درگاه/Payment/Order/Invoice را گزارش کند.
  - endpointهای start/verify با ownership، rate limit و DTO معتبر محافظت و audit شوند.
  - **Verify:** amount/customer/order جعلی رد شود؛ authority mismatch و replay اثر مالی نسازند؛ callback موفق تمام موجودیت‌ها را یک‌بار sync کند؛ reconciliation مغایرت عمدی را پیدا کند.

- [ ] **Task 5 — تکمیل دامنه حرفه‌ای B2B**
  - مدل Company Account با چند location و کاربران دارای نقش `COMPANY_ADMIN/BUYER/APPROVER/ACCOUNTANT` ایجاد شود؛ pricing/catalog و داده‌ها همیشه با `companyId` scope شوند.
  - Credit Limit، Credit Used، Available Credit و Net 15/30/60/90 با consume/release اتمیک، overdue، aging report و payment reminder پیاده شوند.
  - Quote workflow شامل request، version، line-level negotiated price، approver، expiry، audit و تبدیل idempotent به order ساخته شود.
  - PO Number در checkout، order، invoice، PDF، جست‌وجو و export اجباری/اختیاری بر اساس Company policy پشتیبانی شود.
  - Price List، tier pricing، company catalog، MOQ، carton multiple و approval threshold ساخته شوند؛ هیچ شرکت قیمت/سفارش شرکت دیگر را نبیند.
  - migrationها versioned، reversible و دارای backfill امن باشند؛ ADR مرزهای domain → application → infra ثبت شود.
  - **Verify:** تست جداسازی دو شرکت، نقش‌ها، approval، quote expiry، PO invoice و دو سفارش هم‌زمان روی credit limit پاس شود؛ پرداخت/لغو اعتبار را دقیق آزاد کند.

- [ ] **Task 6 — فعال‌کردن quality gates و پوشش تست واقعی**
  - ESLint یا Biome، formatter و TypeScript strict برای تمام workspaceها تنظیم شود؛ script منسوخ `next lint` جایگزین گردد.
  - Jest/Vitest و Supertest برای API، تست component برای web و Playwright برای E2E نصب و واقعاً به package scripts اضافه شوند.
  - تست‌های auth/OTP/RBAC/IDOR، order concurrency، wallet/discount، payment replay، state transitions، company isolation، checkout B2B/B2C و migration نوشته شوند.
  - Husky/Lefthook و lint-staged روی commit، و GitHub CI با ترتیب `format-check → lint → typecheck → unit → integration → build → e2e-smoke → CodeQL → npm audit → Trivy → license/SBOM` فعال شود.
  - branch protection، required checks و حداقل coverage برای کدهای مالی/امنیتی تنظیم شود؛ flaky test اجازه merge ندهد.
  - **Verify:** `npm ci` روی checkout تمیز و همه gateها سبز باشند؛ یک خطای عمدی lint/type/test merge را متوقف کند؛ تست‌ها بدون secret و وابستگی production اجرا شوند.

- [ ] **Task 7 — پایدارسازی CI/CD، Docker، migration، backup و recovery**
  - production در GitHub Environment محافظت‌شده با approval، concurrency lock و rollback قرار گیرد؛ deploy مستقیم هر push و auto-deploy timer موازی حذف/یکپارچه شوند.
  - imageهای immutable در CI build/scan شوند و با digest deploy گردند؛ GitHub Actions و third-party actionها به SHA معتبر pin شوند.
  - API با user غیرroot، production-only dependencies، healthcheck، read-only filesystem/cap-drop در حد امکان اجرا شود؛ web فقط envهای لازم را بگیرد و کل `.env` دریافت نکند.
  - فقط TypeORM migration versioned منبع حقیقت schema باشد؛ safety-net SQL دائمی حذف و migration با backup، transaction، dry-run staging و rollback/runbook اجرا شود.
  - backup رمزگذاری‌شده PostgreSQL و MinIO خارج از VPS، retention روزانه/هفتگی/ماهانه، monitoring شکست و restore drill دوره‌ای با RPO/RTO تعریف شود.
  - blue/green یا rolling deploy با smoke test و rollback خودکار پیاده شود؛ `deploy.sh` و shell scriptها با ShellCheck و `set -euo pipefail` معتبر شوند.
  - **Verify:** staging deploy و rollback موفق؛ restore روی محیط خالی داده و تصاویر را برگرداند؛ health failure نسخه قبلی را حفظ کند؛ containerها nonroot و imageها digest-pinned باشند.

- [ ] **Task 8 — اصلاح UX، accessibility و جریان فروش B2B/B2C**
  - fallback محصولات/قیمت ساختگی در `RetailProductGrid.tsx` فقط در preview/dev مجاز و در production با empty/error/retry صادقانه جایگزین شود.
  - لینک «همه محصولات» با routing/canonical واقعی اصلاح؛ wholesale catalog دارای pagination/load-more و page در URL شود.
  - API facet مستقل با count برای category/color/size/price/availability بسازد؛ فیلترها از ۲۴ نتیجه فعلی استخراج نشوند و URL/back/forward/SSR را پشتیبانی کنند.
  - Modal/Drawer مشترک استاندارد با `role=dialog`، `aria-modal`، focus trap/restore، Escape و scroll lock ساخته و همه modalها منتقل شوند.
  - mega-menu با click/keyboard/touch، فرم‌ها با label/htmlFor/error-describedby و نتایج/loading/error با `aria-live` اصلاح شوند؛ axe تست شود.
  - قابلیت‌های conversion شامل reorder، draft order، wishlist، search autocomplete، نمایش MOQ/available stock، tracking و abandoned-cart recovery پس از تأیید محصولی اضافه شوند.
  - **Verify:** Playwright desktop/mobile مسیر catalog→filter→PDP→cart→checkout را پاس کند؛ keyboard-only و axe خطای بحرانی نداشته باشند؛ خطای API هیچ کالای ساختگی نشان ندهد؛ محصول ۲۵ به بعد قابل دسترسی باشد.

- [ ] **Task 9 — SEO، performance، observability و داده قابل مدیریت**
  - sitemap از `updatedAt` واقعی استفاده، chunk/index و pagination داشته باشد؛ canonical/robots/noindex برای دامنه و کانال با تست پوشش داده شوند.
  - Organization/Product/Article/FAQ JSON-LD از public settings/CMS معتبر بیاید؛ تلفن، آدرس، ساعات و متن‌های storefront hard-coded نباشند.
  - formatter مرکزی پول/عدد/تاریخ و قرارداد واحد تومان/ریال ایجاد؛ متن‌های UI به catalog فارسی منتقل و bidi برای SKU/phone/amount رعایت شود.
  - queryهای dashboard/payment/order با aggregate SQL و index بهینه، N+1 حذف، pagination اجباری و cache Redis با invalidation مشخص شود؛ قبل/بعد profile ثبت شود.
  - JSON structured logs، correlation ID، redaction داده حساس، Sentry و OpenTelemetry اضافه شوند؛ metrics و alert برای checkout/payment/stock/OTP/deploy/backup تعریف شوند.
  - Lighthouse CI و budget برای Core Web Vitals، JS bundle، image و API latency فعال شود؛ تصاویر responsive AVIF/WebP و CDN بررسی شوند.
  - **Verify:** sitemap تاریخ جعلی/حذف silent نداشته باشد؛ structured data validator پاس شود؛ logها secret/OTP نداشته باشند؛ alert آزمایشی دریافت شود؛ شاخص‌های performance قبل/بعد مستند شوند.

- [ ] **Task 10 — Verification نهایی، پاک‌سازی و تحویل**
  - تمام فایل‌های موقت `scripts/tmp-*` و branchهای قدیمی ابتدا مالکیت‌سنجی و سپس با اجازه مالک حذف، ignore یا به ابزار رسمی تبدیل شوند؛ هیچ تغییر کاربر overwrite نشود.
  - README، SETUP، Swagger، runbook امنیت/deploy/backup/recovery و مستند مدل B2B با رفتار واقعی هماهنگ شوند؛ credential نمونه واقعی حذف شود.
  - `.Codex/memory.json`، `docs/reports/README.md` و ADR index تکمیل و تمام WORKLOG/reportها به commit/PR مربوط لینک شوند.
  - full clean install، lint، typecheck، unit، integration، migration up/down، build، E2E B2B/B2C، security scan، container scan، backup/restore و staging smoke اجرا شود.
  - threat model و checklist OWASP ASVS برای auth/payment/order/upload/admin مرور؛ load test checkout/catalog و failure/rollback drill انجام شود.
  - فقط پس از تأیید مالک، production release تدریجی انجام و ۲۴ ساعت metrics/log/error/payment reconciliation پایش شود.
  - **Verify:** همه CI gateها سبز، secret scan پاک، backup restore‌شده، rollback تست‌شده، هیچ P0/P1 باز، مستندات کامل و production SLOها در محدوده توافق‌شده باشند.

## Done When

- [ ] هیچ secret یا credential واقعی در HEAD، تاریخچه قابل‌دسترسی، docs و logs وجود ندارد و همه مقادیر افشاشده rotate شده‌اند.
- [ ] auth، checkout، inventory، wallet، discount، credit و payment در برابر concurrency، replay، IDOR و دستکاری کلاینت تست و ایمن هستند.
- [ ] Company Account، roles، quote، PO، price list و credit terms به‌صورت tenant-safe کار می‌کنند.
- [ ] lint/typecheck/test/build/security/e2e در PR اجباری و سبز هستند.
- [ ] deploy، migration، backup، restore و rollback مستند و آزمایش‌شده‌اند.
- [ ] UX، accessibility، SEO، performance و observability معیار پذیرش ثبت‌شده را پاس کرده‌اند.
- [ ] WORKLOG، reports، ADRها و `.Codex/memory.json` برای Cursor و Codex کاملاً به‌روزند.

