# گزارش — هزینه ارسال تکی + پک عمده + انتخاب رنگ

**تاریخ:** 2026-07-29

## هزینه ارسال فروشگاه تکی

فرمول در `ShippingService.quote`:

1. `weightKg = ceil(pieces × kgPerPiece × 10) / 10`
2. `fee = baseFee + ceil(weightKg) × perKgFee`
3. پیک تهران / SNAPP: `fee = min(fee, baseFee)`
4. اگر `orderTotal ≥ freeThreshold` → رایگان

جزئیات و فیلدهای قابل‌ویرایش در **تنظیمات سیستم → روش‌های ارسال** (`/admin/settings`):

| فیلد | نقش |
|------|-----|
| کارمزد پایه | پایه تکی + هزینه ثابت عمده |
| کارمزد هر کیلو | فقط تکی |
| وزن تقریبی هر عدد (`kgPerPiece`) | پیش‌فرض ۰٫۴۵ |
| آستانه ارسال رایگان | تکی و عمده |
| شرکت‌های حمل | لیست checkout |

## فاکتور عمده بر اساس پک

اگر محصول `specs.packQty` داشته باشد:

- تعداد انتخابی کاربر = **تعداد پک**
- برای **هر رنگ** و **هر سایز**: `qty = packQty × تعداد پک`
- اگر `allowWholesaleColorSelect` خاموش باشد → همه رنگ‌ها
- اگر روشن باشد → فقط رنگ‌های انتخابی، با حداقل `minWholesaleColors`

## فیلدهای جدید محصول

- `allowWholesaleColorSelect` (boolean)
- `minWholesaleColors` (int ≥ 1)

SQL: `apps/api/src/database/sql/20260729-wholesale-color-select.sql`
