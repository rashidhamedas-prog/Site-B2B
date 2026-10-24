# تایپ‌چک API بعد از sharp 0.35.5

شاخه `cursor/fix-sharp-callable-types-090f`. به master merge نشده و دیپلوی اجرا نشده است.

## ریشه

از #94 (`1d8fbd7`) هر دو ورک‌اسپیس `sharp` را روی 0.35.5 پین کردند. قبل از آن lock روی 0.34.5 بود و `"types": "lib/index.d.ts"` با `export = sharp` بود؛ کست `require('sharp') as typeof import('sharp')` یک تابع بود.

sharp 0.35.5 پکیج دوگانه است:

| شرط | تایپ | شکل |
| --- | --- | --- |
| `package.json` `types` | `dist/index.d.mts` | `export default` (namespace، callable نیست) |
| `exports.require.types` | `dist/index.d.cts` | `export = sharp` (همان factory) |

`apps/api/tsconfig.json` فقط `"module": "commonjs"` دارد و `moduleResolution` ندارد، پس TypeScript از resolution کلاسیک Node استفاده می‌کند و `exports` را نمی‌خواند. `typeof import('sharp')` به `.d.mts` می‌رسد و `tsc --noEmit` با TS2349 («This expression is not callable») در `image-processor.ts` و spec آن می‌شکند. تست‌های API با `ts-node --transpile-only` این را رد می‌کنند؛ برای همین سوئیت واحد سبز ماند و فقط استپ Type check API قرمز شد.

`require('sharp')` در Node همچنان `module.exports = Sharp` از `dist/index.cjs` است و تابع است.

## تغییر

کست به default export (`SharpFactory`). JS کامپایل‌شده همان `const sharp = require('sharp')` و فراخوانی مستقیم است. `next@15.5.28` و `sharp@0.35.5` سر جایشان ماندند.

## ریسک

- اجرا: ابعاد، webp، timeout و سقف پیکسل عوض نشده. spec پردازش تصویر روی sharp 0.35.5 سبز است.
- دیپلوی: این شاخه `origin/master` را جلو نمی‌برد. تایمر ایران فقط master را pull می‌کند. merge به master ایمیج را دوباره می‌سازد.
- ایمیج: Dockerfile و باینری native عوض نشده. sharp داخل ایمیج همان 0.35.5 می‌ماند.
- جاب `omnichannel-migrate` به sharp ربطی ندارد. روی این PR یک‌بار شکست چون `pg_isready` در پنجرهٔ init ایمیج رسمی Postgres موفق شد و psql بعدی سوکت را پیدا نکرد. اسکریپت حالا تا دومین پیام `database system is ready to accept connections` صبر می‌کند. اسکیمای production عوض نشده.

## تست‌های وب از قبل قرمز

جزو CI نیستند. روی همین درخت، بدون دست زدن به آن‌ها:

- `retail-analytics.spec.ts`: `sanitizeAnalyticsSearch('Authority=A000&utm_source=torob')` انتظار `utm_source=torob` دارد و `utm_source=torob&utm_medium=cpc` می‌گیرد.
- `wholesale-order.spec.ts`: `wholesaleOrderSummary(...).canOrder` انتظار `true` دارد و `false` است.
- `WholesaleQuickOrder.portal.spec.ts`: از `533884a2` (motion) کلاس `hover:-translate-y-0.5` در کارت نیست. این یکی قبل از #94 نبود؛ روی master فعلی است و این PR آن را عوض نمی‌کند.
