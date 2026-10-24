# وصله امنیتی Next.js 15.5.28 و sharp 0.35.5

شاخه `cursor/next-15-5-security-4bd9`. به master merge نشده و دیپلوی/رازها عوض نشده‌اند.

## نسخه‌ها

| بسته | قبل | بعد |
| --- | --- | --- |
| `next` (apps/web) | 15.5.19 (`^15.1.0`) | 15.5.28 (پین دقیق) |
| `sharp` هوست‌شده برای Next | 0.34.5 | 0.35.5 |
| `sharp` اپ API | 0.33.5 (تو در تو) | 0.35.5 (هوست‌شده کنار وب) |
| react / react-dom | 19.2.7 | 19.2.7 |

آخرین نسخه خط 15.5 روی npm همان 15.5.28 است. به Next 16 نرفتیم.

`next@15.5.28` وابستگی اختیاری `sharp` را `^0.34.3 || ^0.35.5` اعلام می‌کند. نصب تنها `next@15.5.28` روی lockfile موجود، sharp 0.34.5 را نگه می‌داشت چون هنوز بازه را برآورده می‌کند. برای همین sharp در هر دو `apps/web` و `apps/api` روی 0.35.5 پین شد.

## Advisoryها

تأیید با متن رسمی GitHub و `npm audit --json` بعد از نصب:

| Advisory | وضعیت |
| --- | --- |
| GHSA-2xp9-vwfh-vxw4 (بحرانی، RCE از AVIF / libheif، اصلاح Next ≥15.5.24) | برطرف. در audit نیست. sharp 0.35.5 کتابخانه heif ‏1.23.5 را گزارش می‌کند. Next 15.5.28 رمزگشایی AVIF را فقط وقتی امن می‌داند که heif ≥1.23.2 باشد، پس بهینه‌ساز AVIF روشن می‌ماند. |
| GHSA-2464-fhr4-w9xw / CVE-2026-96889 (بحرانی، RCE از SVG / librsvg) | برطرف برای Next و برای sharp. rsvg باندل‌شده 2.63.2 است. advisory جداگانه sharp یعنی GHSA-wq5f-xc86-pv6w (بازه `<0.35.5`) هم بعد از ارتقای sharp اپ API از audit رفت. |
| GHSA-p3m5-59mp-jv5r (بالا، DoS در Server Actions، تا 15.5.27) | برطرف با 15.5.28. در `apps/web` و بقیه مخزن هیچ `"use server"` نیست؛ طبق خود advisory، اپ بدون Server Action آسیب‌پذیر نیست. |
| GHSA-673q-mjm6-r5xr | فقط 16.x. شامل این پروژه نیست. |

`images.formats` همان `['image/webp', 'image/avif']` ماند. `dangerouslyAllowSVG` تنظیم نشده (پیش‌فرض خاموش) و پاسخ SVG بالادست را بهینه‌ساز رد می‌کند. محدودیت webp-only لازم نبود چون هر دو مسیر تصویر با نسخه وصله‌شده پوشش داده شد.

## آزمون

- `apps/web` `tsc --noEmit`: موفق. `next build` با Next.js 15.5.28: کامپایل و ۱۲۳ صفحه استاتیک موفق. خروجی standalone شامل `next@15.5.28` و `sharp@0.35.5` است.
- `apps/api` `npm test`: موفق، از جمله `image-processor.spec.ts` روی sharp 0.35.5.
- specهای واحد وب با `tsx --test` از داخل `apps/web`: دو شکست از قبل روی master و بی‌ربط به این ارتقا (`retail-analytics.spec.ts`، `wholesale-order.spec.ts`). بقیه سبز.
- `npm audit`: این چهار شناسه غایب‌اند. آسیب‌پذیری‌های باقی (از جمله critical روی `@fastify/middie` و `proxy-addr`) از قبل‌اند و جزو این کار نیستند.

## ریسک

- sharp 0.35.5 به Node `>=20.9.0` نیاز دارد. `package.json` ریشه همین کف را دارد. Dockerfileها هنوز `node:20-alpine` هستند و در این PR عوض نشدند. خط ۲۰ بعد از آوریل ۲۰۲۶ در حالت پایان پشتیبانی است، ولی آخرین انتشارهایش بالاتر از 20.9 است و باینری native لود می‌شود. اینجا Docker در دسترس نبود؛ گیت بیلد ایمیج اجرا نشد.
- ایمیج تولید Alpine/musl است. advisory مربوط به RCE روی لینوکس glibc است؛ musl ریسک عملی را کم می‌کند. lockfile هر دو باینری `linux-x64` و `linuxmusl-x64` نسخه 0.35.5 را دارد. بیلد Docker روی Alpine باینری musl را انتخاب می‌کند.
- sharp اپ API دیگر زیر `apps/api/node_modules/sharp` نیست و به ریشه هوست شده. Dockerfile موجود اول `node_modules` ریشه را کپی می‌کند و فقط اگر کپی تو در تو وجود داشته باشد آن را روی root می‌گذارد. گیت `require('sharp')` همان Dockerfile سر جایش است.
- libvips باندل‌شده 8.18.7 است. ابعاد و فرمت خروجی آپلود (webp) و بهینه‌ساز عوض نشده، ولی بایت‌های فشرده ممکن است کمی فرق کنند.
- این شاخه نباید تا مرور PR به master برود؛ merge به master سایت‌های زنده را دیپلوی می‌کند.
