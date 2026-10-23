# robots Draft A و یکسان‌سازی سال فعالیت تولیدی

تاریخ: ۱۴۰۵/۰۸/۰۱ (2026-10-23)
وضعیت: PR، بدون merge و بدون deploy

## تصمیم قفل‌شده

حامد Draft A برای robots و گزینه A برای ادعای برند را تأیید کرد. این تغییر فقط در کد است. production دست نخورده.

## robots

`apps/web/src/app/robots.ts` از `buildRobotsRules()` استفاده می‌کند:

- `User-agent: OAI-SearchBot` با همان `Allow: /` و `Allow: /api/v1/feeds/` و همان `COMMON_DISALLOW` گروه `*`
- `GPTBot` و `Google-Extended` گروه جدا ندارند و از `*` ارث می‌برند
- گروه `Googlebot` اضافه نشده
- `Sitemap` برای عمده `https://poshaktaranom.com/sitemap.xml` و برای تکی `https://www.poshaktaranom.ir/sitemap.xml`

## سال فعالیت

فرض «تابع `yearsOfOperation` الان ۱۴ برمی‌گرداند» درست نبود.

- تابع قبلی: `now.getFullYear() - foundedGregorianYear` (۲۰۱۵). در ۲۳ اکتبر ۲۰۲۶ نتیجه ۱۱ است، نه ۱۴.
- هوم زنده `.com`: کارت «چرا تولیدی ترنم؟» عنوان ذخیره‌شدهٔ CMS «۱۴ سال تجربه تولیدی» دارد. نوار آمار «۱۰+ / سال تجربه / در بازار پوشاک» است. هر دو متن ثابت CMS هستند و با هر درخواست دوباره حساب نمی‌شوند.
- دربارهٔ ما: «۱۱+» از خود تابع می‌آید و برچسبش از قبل «سال فعالیت تولیدی» بود. جملهٔ «بیش از ۱۰ سال تجربه در بازاریابی… حامد» بیو شخصی است و عوض نشده.

تابع جدید: سال شمسی `Asia/Tehran` منهای ۱۳۹۴. در ۱ آبان ۱۴۰۵ برابر ۱۱ است. بین ۱ ژانویه و نوروز (مثلاً ۱۵ دی ۱۴۰۵ / ۱۵ ژانویه ۲۰۲۷) میلادی ۱۲ می‌شد و شمسی هنوز ۱۱ است؛ همان اختلاف اصلاح شد.

ویترین، اگر عنوان فیچر یا برچسب آمار ادعای سال شرکت باشد (`سال تجربه`، `تجربه تولیدی`، `در بازار پوشاک`)، مقدار را با عدد شمسی و برچسب «سال فعالیت تولیدی» / زیرعنوان «در مشهد» عوض می‌کند. بقیهٔ آمار CMS مثل مشتری و مدل دست نمی‌خورند.

## تأیید محلی

```bash
npx tsx apps/web/src/lib/robots-policy.spec.ts
npx tsx apps/web/src/lib/business-facts.spec.ts
node --experimental-strip-types apps/web/src/lib/wholesale-stat-kind.spec.mts
```

برای خود `robots.txt` بعد از بالا آوردن وب:

```bash
# عمده
curl -s -H 'Host: poshaktaranom.com' http://127.0.0.1:3000/robots.txt
# تکی
curl -s -H 'Host: www.poshaktaranom.ir' http://127.0.0.1:3000/robots.txt
```

باید `User-Agent: OAI-SearchBot` قبل از `User-Agent: *` باشد، مسیرهای Disallow یکی باشند، و Sitemap همان دامنه باشد. `GPTBot` و `Google-Extended` و `Googlebot` خط جدا نداشته باشند.

## Deploy (ops، نه این PR)

1. PR را merge کنید.
2. روی VPS: `cd /opt/taranom && bash scripts/auto-deploy.sh`
3. `curl -s https://poshaktaranom.com/robots.txt` و `curl -s https://www.poshaktaranom.ir/robots.txt`
4. هوم عمده: کارت «۱۴ سال تجربه تولیدی» نباشد؛ آمار سال «فعالیت تولیدی» باشد و با ۱۳۹۴ بخواند (الان ۱۱+). دربارهٔ ما همان برچسب را نشان بدهد و جملهٔ بازاریابی حامد سر جایش بماند.
5. اگر متن قدیمی هنوز داخل `/admin/site-content` دیده می‌شود، ویترین آن ردیف را بازنویسی می‌کند؛ ذخیرهٔ دوباره آن را به ۱۴ برنمی‌گرداند.
