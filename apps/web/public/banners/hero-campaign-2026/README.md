# Hero campaign 2026

شش بنر کمپین صفحه اصلی از کلاژ تأییدشده کاربر استخراج و برای وب به WebP تبدیل شده‌اند.

| کانال | دسکتاپ | موبایل |
|---|---|---|
| عمده | `wholesale-01.webp` تا `wholesale-03.webp` | `wholesale-01-mobile.webp` تا `wholesale-03-mobile.webp` |
| تکی | `retail-01.webp` تا `retail-03.webp` | `retail-01-mobile.webp` تا `retail-03-mobile.webp` |

- Desktop: `1536×680`، WebP quality 88
- Mobile: `600×800`، WebP quality 84
- هیچ PNG/JPG اصلی در public deploy نشده است.
- چون متن در artwork حک شده، اسلایدها با `presentation: artwork` رندر می‌شوند. متن معادل، H1 و CTA واقعی همچنان در HTML وجود دارند.
- نسخه موبایل فقط بخش تصویری را نمایش می‌دهد و متن/CTA با HTML روی آن قرار می‌گیرد.

## محدودیت منبع

منبع یک کلاژ `1536×1024` بود و هر بنر فقط حدود ۷۶۷ پیکسل عرض واقعی داشت. خروجی‌ها برای layout یکسان resize شده‌اند، اما جزئیات واقعی Retina تولید نشده است. اگر فایل‌های مستقل حداقل `1920×800` یا artwork بدون متن تحویل شد، همین نام‌ها را بدون تأیید صریح overwrite نکنید؛ نسخه جدید نام‌گذاری و CMS به آن migrate شود.

