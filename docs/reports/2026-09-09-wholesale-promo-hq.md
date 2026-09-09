# Wholesale promo heroes — 1920×560 contain, no stretch — 2026-09-09

## Outcome

بنرهای همکاری و کت روی هیروی عمده دوباره از JPG اصلی (۱۰۲۴×۴۰۹) روی بوم **۱۹۲۰×۵۶۰ / ۲۴:۷** گذاشته شدند. نسبت طرح عوض نشد؛ برش و کشیدگی حذف شد. کیفیت WebP از q74 به q92 رسید.

## Why the previous plates looked soft

- منبع پیکسل بیشتری از ۱۰۲۴ عرض ندارد؛ upscale پوششی به ۱۹۲۰ با `cover`/`fill` هم جزئیات را می‌برد هم تار می‌کرد.
- نسخهٔ `a858faa` بوم را با `fit: fill` می‌کشید (نسبت چهره/متن عوض می‌شد).
- اسلاید دوم از optimizer نکست با quality ۷۰/۷۵ دوباره فشرده می‌شد.

## What changed

- Desktop: contain + امتداد لبه روی ۱۹۲۰×۵۶۰ (۲۴:۷ دقیق).
- Mobile: همان طرح کامل روی ۱۲۰۰×۶۰۰ (۲:۱)، بدون برش سمت مدل.
- `HeroSection` برای فایل استاتیک محلی `<img>` خام می‌گذارد و `object-fill` را برمی‌دارد.
- Migration `WholesalePromoHeroesHq1757430000017` هش CMS عمده را عوض می‌کند. Retail دست نخورده است.

## Performance

- LCP partnership ≈ ۹۷KB WebP (قبلی زنده ۴۴KB تار؛ نسخهٔ کشیدهٔ master حدود ۱۱۶KB).
- فقط اسلاید ۰ `priority` دارد.

## Files

- `apps/web/public/banners/wholesale-promo-2026/`
- `apps/web/src/lib/cms/wholesale-promo-slides.ts`
- `apps/web/src/components/wholesale/HeroSection.tsx`
- `apps/api/src/database/wholesale-promo-hero.util.ts`
- `apps/api/src/database/migrations/20260909-017-wholesale-promo-heroes-hq.ts`
