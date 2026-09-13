# Capture سفارش بعد از زرین‌پال بدون rollback موجودی

تاریخ: ۲۰۲۶-۰۹-۱۳  
تسک: TASK-20260913-001  
سفارش شاهد: `ORD-2026-00036-4FEF94`

## هدف و غیرهدف

- **هدف:** اگر زرین‌پال پرداخت را گرفته، سفارش از «در انتظار پرداخت» خارج شود و موجودی یک‌بار کسر شود.
- **غیرهدف:** تعویض درگاه، وب‌هوک زرین‌پال، تغییر مبلغ/مرچنت.

## فرض‌های تأییدشده (پروداکشن)

- سفارش تکی `RETAIL_WEBSITE` / `ONLINE` / جمع `۱۱۶۰۰۰۰۰` ریال / وضعیت `AWAITING_PAYMENT`.
- ردیف پرداخت `ZARINPAL` هنوز `PENDING` است؛ `stockCommittedAt` خالی است.
- `payment_events` در `06:42:14Z` با `Authority…:OK` و `signatureValid=true` ثبت شده — یعنی بازگشت مرورگر و `POST /payments/verify` انجام شده.
- لاگ API: `payment.verify.begin` سپس  
  `QueryFailedError: FOR UPDATE cannot be applied to the nullable side of an outer join`  
  در `commitStockForOrder` → کل تراکنش verify برگشت و پرداخت محلی `PENDING` ماند.
- زرین‌پال قبلاً تراکنش را گرفته؛ در دیتابیس محلی هیچ `PAID` زرین‌پالی قبل از این سفارش وجود نداشت، بنابراین این مسیر تا امروز روی پول واقعی تست نشده بود.

## قرارداد

1. قفل بدبینانه فقط روی ردیف `orders` است؛ آیتم‌ها با SELECT جدا بدون `FOR UPDATE` روی JOIN.
2. Verify تکراری (`PAID` محلی یا کد ۱۰۱ زرین‌پال) دوباره `applyCapturedPayment` را صدا می‌زند (idempotent).
3. اگر پرداخت محلی از قبل `PAID` باشد، «تکمیل پرداخت» درگاه جدید نمی‌سازد.
4. `Status` زرین‌پال بدون حساسیت به حروف است.

## توالی قبلی (شکست)

```text
PSP capture OK
  → POST /payments/verify
  → CAS payment PENDING→PAID (همان txn)
  → applyCapturedPayment
  → commitStockForOrder findOne(lock + relations items)
  → LEFT JOIN order_items FOR UPDATE
  → PostgreSQL error
  → rollback کل txn
  → سفارش AWAITING_PAYMENT، پرداخت PENDING
```

## توالی بعد از اصلاح

```text
PSP capture / verify 100 یا 101
  → lock orders row only
  → load order_items separately
  → PAID + PENDING_REVIEW + stock once
```

## بازیابی سفارش شاهد

بعد از دیپلوی، همان `POST /v1/payments/verify` با `paymentId` و `Authority` موجود (کد ۱۰۱ زرین‌پال مجاز است).
