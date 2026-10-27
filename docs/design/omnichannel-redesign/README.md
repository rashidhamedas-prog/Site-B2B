# بسته بازطراحی کانال انتشار (Omnichannel)

**GO حامد رشید — ۲۷ اکتبر ۲۰۲۶** · منبع: `taranom-omnichannel-redesign.zip`

| فایل | نقش |
|---|---|
| `00-CURSOR-MASTER-PROMPT.md` | دستور اجرا، قوانین سخت، روال PR/deploy، توقف |
| `prompt-redesign-v1.md` | brief و معیار موفقیت |
| `stage1-requirements.md` | ۵۷ نیاز + تصمیم‌های حل‌شده |
| `stage2-design.md` | UX، فنی، جدول PR |
| `stage2-wireframe.html` | وایرفریم |
| `pr0-plan.md` | گیت deploy — **انجام‌شده** (`3642bfc4` / #111) |
| `req-*.md` | نیازهای خام مدیران |

## ترتیب اجرا (عملیاتی)

1. **رفع resume بعد از soft-drain** (باگ: حذف `/tmp/omnichannel-worker.drain` حافظهٔ `stopping` را پاک نمی‌کند)
2. PR-1 … PR-11 و PR-13 و PR-15 از `stage2-design.md`
3. **رد:** PR-0، PR-12 (دامنه Worker / vault توکن / `TELEGRAM_API_URL`)
4. **آخر:** PR-14 ربات‌های سفارش

اتصال‌ها LIVE می‌مانند؛ فقط «توقف اضطراری» دستی Owner. تنظیمات محتوا per-channel و بدون پیش‌فرض آیدی.
