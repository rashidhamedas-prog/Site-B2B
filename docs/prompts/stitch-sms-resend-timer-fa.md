# پرامپت حرفه‌ای Stitch — تأیید پیامک (OTP) با تایمر ارسال مجدد | ترنم

یک مرحله «تأیید شماره موبایل با کد پیامک» برای فروشگاه پوشاک ایرانی «ترنم» طراحی کن. زبان رابط **فارسی**، جهت **RTL**، و حس **لوکس مینیمال ایرانی معاصر** — نه ظاهر generic بنفش/گرادیان AI. الهام ساختاری از الگوهای OTP Verification Card و **resend countdown** (مثل نمونه‌های 21st) باشد، اما رنگ، تایپوگرافی و فضای سفید کاملاً شخصی‌سازی‌شده برای ترنم.

خروجی باید برای پیاده‌سازی با Next.js، React و Tailwind در پروژه Site B2B قابل تبدیل باشد (component set + annotation، نه فقط mockup تزئینی).

## هویت بصری

- پالت اصلی: سبز جنگلی `#1B5C4A`، طلایی `#C9A84C`، کرم `#F6F1E8`، متن `#1A1A1A`، خطوط ظریف `#E5DFD4`.
- پس‌زمینه صفحه: کرم یا سفید گرم؛ کارت OTP روی `#FFFFFF` با border بسیار ملایم و سایه نرم (بدون glassmorphism سنگین).
- سبک: مینیمال، بدون شلوغی تزئینی، بدون illustration اضافه یا آیکون‌های بی‌ربط؛ فقط لوگوی کوچک ترنم (placeholder متن «ترنم» مجاز).
- تایپوگرافی فارسی خوانا؛ اعداد countdown **فارسی** در متن («۳۰ ثانیه»).
- responsive: موبایل 360px (اولویت)، تبلت 768px؛ کارت حداکثر ~420px عرض در دسکتاپ و وسط‌چین.

## محتوا و ساختار مرحله

1. **عنوان:** «کد تأیید را وارد کنید»
2. **توضیح یک خطی:** «کد ۶ رقمی به شماره ۰۹۱۲***۶۷۸۹ ارسال شد.» (نمایش ماسک‌شده شماره)
3. **فیلد OTP:** ۶ خانه جدا (یا یک input با segment بصری) — autofocus روی اولین خانه، paste کد ۶ رقمی پشتیبانی شود
4. **دکمه اصلی:** «تأیید و ادامه» — پررنگ سبز `#1B5C4A`، متن سفید، full-width در موبایل
5. **ردیف ارسال مجدد:** لینک/دکمه ثانویه «ارسال دوباره پیامک» + حالت countdown (پایین)
6. **لینک کمکی:** «ویرایش شماره موبایل» — متن کوچک، underline on hover/focus

## دکمه «ارسال دوباره پیامک» — states (الزامی)

| state | ظاهر | copy |
|-------|------|------|
| **idle** (قابل کلیک) | لینک یا ghost button؛ رنگ `#1B5C4A` یا طلایی `#C9A84C` برای accent | «ارسال دوباره پیامک» |
| **counting** | غیرفعال بصری؛ بدون underline کلیک | «ارسال دوباره تا **N** ثانیه دیگر» — N از ۶۰ به ۰ |
| **disabled** | opacity ~0.5، `cursor: not-allowed`؛ در حین ارسال درخواست API | «در حال ارسال…» یا همان counting |
| **focus-visible** | ring 2px `#C9A84C` offset 2px روی idle و لینک «ویرایش شماره» | — |

- حداقل **ارتفاع/ناحیه لمس 44px** برای دکمه تأیید، هر خانه OTP (touch target)، و کنترل resend.
- کنtrast متن و پس‌زمینه **WCAG AA**.
- حرکت countdown: فقط opacity/subtle pulse ممنوع — ترجیح **بدون انیمیشن** یا fade 150ms برای تغییر عدد؛ `prefers-reduced-motion: reduce` بدون transition.

## حالت‌های کل صفحه

- **default:** OTP خالی، resend در حالت counting (مثلاً ۴۵ ثانیه باقی‌مانده)
- **typing:** یک خانه پر شده با border سبز ملایم
- **error:** پیام خطا زیر OTP: «کد وارد شده نادرست است» — border قرمز ملایم `#B91C1C`، متن خطا readable
- **success (optional frame):** checkmark کوچک + «در حال ورود…»
- **loading submit:** دکمه تأیید spinner + disabled

## الهام 21st (بدون کپی مستقیم)

- از **OTP Verification Card**: چیدمان عمودی، فاصله‌گذاری generous، CTA واضح.
- از **resend countdown**: جایگذاری resend زیر OTP و بالای لینک ویرایش شماره؛ countdown در همان خط یا خط بعد با typography کوچک‌تر (`text-sm`).
- **شخصی‌سازی ترنم:** جای بنفش/آبی پیش‌فرض، سبز جنگلی + accent طلایی؛ پس‌زمینه کرم؛ بدون blob shapes یا gradient mesh.

## تحویل مورد انتظار از Stitch

- یک frame موبایل 360px + یک frame دسکتاپ با همان کارت
- Component set: `OtpVerifyStep` با subcomponents `OtpInput`, `ResendSmsControl`, `PrimaryButton`
- Variantها: `resend-idle`, `resend-counting`, `resend-sending`, `otp-error`, `submit-loading`
- Annotation کوتاه: spacing (8px grid), radius دکمه/خانه OTP (مثلاً 12px), font sizes, token hex
- متن **واقعی فارسی** — بدون Lorem Ipsum
- بدون clutter: بدون captcha تصویری، بدون بنر تبلیغ، بدون فیلد اضافه

## یادداشت پیاده‌سازی (برای agent بعدی — خارج از Stitch)

پس از export، در کد از کامپوننت‌های موجود پروژه و توکن‌های design-system استفاده شود؛ این فایل فقط مرجع طراحی است.
