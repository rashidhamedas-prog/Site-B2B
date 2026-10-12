# ارسال گروهی پیامک شخصی‌سازی‌شده — بازاریابی

**Task:** TASK-20261013-001  
**Depth:** skill-top full + ECC nestjs/frontend + Slack (بدون نتیجه مرتبط)

## خلاصه

در ادمین بازاریابی تب **ارسال گروهی** اضافه شد: انتخاب مشتریان به‌ازای کانال تکی/عمده، پیش‌نمایش شخصی‌سازی با `{name}`/`{city}`، ساخت کمپین فقط از واجدین رضایت، کاناری، سپس ارسال زنده با تأیید.

## جریان

1. فیلتر کانال (RETAIL / WHOLESALE)
2. انتخاب چندتایی از لیست مشتریان (حداکثر ۱۰۰)
3. قالب یا متن دستی + کلاس NURTURE/PROMO
4. `POST /v1/marketing/bulk/preview` → واجد / رد با دلیل
5. `POST /v1/marketing/bulk/compose` → کمپین با `filter.customerIds`
6. `POST /v1/marketing/campaigns/:id/canary`
7. `POST /v1/marketing/campaigns/:id/go-live` (فقط اگر مخاطب انتخابی باشد)

## امنیت / رضایت

- `decideConsent` + suppression در پیش‌نمایش و دوباره در `queueSms`
- سقف روزانه کانال و quiet hours تهران حفظ می‌شود
- `createCampaign` و `goLive` بدون `customerIds` رد می‌شوند (دیگر blast سراسری از این مسیر نیست)
- سقف متن ۷۰۰ کاراکتر

## مرجع الگو

- sangkips/campaign-dispatch-service — preview شخصی‌سازی قبل از ارسال
- بهترین‌عملکرد SMS 2026: consent، سقف فرکانس، شخصی‌سازی

## تأیید

- `campaign-audience.spec.ts: ok`
- `admin-customer-workspace` تب `blast`
- web `tsc --noEmit` سبز
- Verify متخصص: PASS WITH CONDITIONS → شرایط با الزام مخاطب بسته شد
