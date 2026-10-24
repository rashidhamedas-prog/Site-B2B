# آپلود عکس تلگرام و رد فایل ناقص

تاریخ: ۲۰۲۶-۱۰-۲۴

دیپلوی ایران و `wrangler deploy` در این تغییر انجام نشده. env و دیتابیس تولید عوض نشده.

## تلگرام

`sendPhoto` / `sendMediaGroup` آدرس `https://poshaktaranom.com/media/products/*.webp` را به تلگرام می‌داد. سرورهای تلگرام آن دامنه را (که فقط به مبدأ ایران می‌رسد) قابل‌اعتماد fetch نمی‌کنند و آلبوم با `WEBPAGE_CURL_FAILED` می‌میرد. بله همان URL را از داخل ایران باز می‌کند.

پرچم `TELEGRAM_MEDIA_UPLOAD_MODE`:

| مقدار | رفتار |
| --- | --- |
| خالی، `url`، یا هر چیز دیگر | مثل قبل: JSON و URL عکس |
| `upload` | خواندن از MinIO اگر کلید `/media/products|blog/…` باشد، وگرنه HTTPS همان مبدأ؛ Sharp فایل را JPEG می‌کند (لبهٔ بلند حداکثر ۲۵۶۰، کیفیت ۸۲ و در صورت نیاز پایین‌تر، زیر ۹MB) و `multipart/form-data` با `attach://` از همان `TELEGRAM_API_URL` |

روشن کردن: ورکر egress این ریویژن را دیپلوی کنید، بعد در env ایران `TELEGRAM_MEDIA_UPLOAD_MODE=upload` و api و worker کانال را ری‌استارت کنید.

برگشت: متغیر را حذف کنید یا `url` بگذارید و همان دو پروسه را ری‌استارت کنید. ورکر می‌تواند سر جایش بماند. دیتابیس عوض نمی‌شود.

تایم‌اوت: خواندن هر عکس ۱۲ ثانیه (دو تا همزمان)، ارسال multipart ۲۸ ثانیه. ورکر fetch بالادست را ۲۶ ثانیه بعد قطع می‌کند تا به‌جای قطع مبهم، ۵۰۲ برگردد.

## ورکر

بدنه با reader تا سقف ۳۲MB خوانده می‌شود و فقط همان بافر کامل، با `Content-Type` اصلی (شامل boundary) و `Content-Length` واقعی، فرستاده می‌شود. بزرگ‌تر از سقف: ۴۱۳ و هیچ درخواستی به `api.telegram.org` نمی‌رود. بدنهٔ نصفه پروکسی نمی‌شود.

ریسک: CPU و زمان Worker برای خود تبدیل تصویر نیست (Sharp روی API است). بدنهٔ آلبوم تا ۳۲MB در حافظهٔ Worker می‌ماند. آلبوم ۱۰تایی از JPEGهای نزدیک سقف ممکن است به این سقف یا به زمان Worker بخورد؛ خروجی معمول محصول خیلی کوچک‌تر است. اگر Sharp در API نباشد، بایت اصلی فقط وقتی زیر سقف عکس باشد همان‌طور آپلود می‌شود.

## آپلود محصول

سقف multipart قبلاً `5 * 1024 * 1024` بود. busboy استریم را دقیقاً روی ۵۲۴۲۸۸۰ بایت می‌بندد و `file.truncated` را true می‌کند، بدون اینکه `for await` خطا بدهد. شرط `size > limit` برای بافرِ هم‌اندازهٔ سقف false است، پس JPEG بدون مارکر EOI ذخیره می‌شد و بله `UNSUPPORTED_FILE` می‌داد.

الان `truncated` و هر بایت اضافه رد می‌شود (پیام ۲۰ مگابایت). JPEG که SOI دارد و EOI ندارد قبل از Sharp رد می‌شود. بعد از `putObject` آبجکت دوباره خوانده و decode می‌شود؛ اگر طول یا decode نخواند، آبجکت پاک می‌شود. عکس سالم زیر ۲۰MB همچنان با Sharp به WebP حداکثر ۱۲۰۰×۱۶۰۰ کوچک می‌شود.

## تست

- `cd apps/api && npx tsc --noEmit` پاک.
- `cd apps/api && npm test` پاک (بعد از `npm run build -w @taranom/shared-types`، مثل CI). شامل `upload-bytes.spec.ts`، `telegram-media.spec.ts`، `telegram.adapter.spec.ts`.
- `cd deploy/telegram-egress-worker && node --experimental-strip-types --test src/index.spec.ts` — ۱۰ تست، ۰ شکست.
