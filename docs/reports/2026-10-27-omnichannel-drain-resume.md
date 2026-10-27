# Omnichannel soft-drain cancel/resume

**تاریخ:** ۲۰۲۶-۱۰-۲۷ · **شاخه:** `fix/omnichannel-drain-resume` · **GO:** حامد ۲۷ اکتبر، بستهٔ بازطراحی

## مشکل
بعد از `touch /tmp/omnichannel-worker.drain`، حذف فایل پرچم حافظهٔ `stopping` را پاک نمی‌کرد؛ ورکر تا restart ادعا (claim) نمی‌کرد. تایمر ۲ثانیه‌ای هم با `beginDrain` قطع می‌شد و cancel دیده نمی‌شد.

## اصلاح
- `outbox-worker-drain.ts`: ماشین حالت خالص (`resumeDrainIfCleared`, `decideDrainTick`, `shouldKeepDrainPollTimer`)
- فایل soft-drain: تایمر poll می‌ماند تا cancel دیده شود؛ فقط `shutdown` تایمر را قطع می‌کند
- حذف پرچم drain (یا abort بعد از drained) → `stopping=false`، پاک‌کردن `.drained`، ادامه claim
- `onModuleDestroy` / origin=`shutdown` هرگز resume نمی‌شود

## تست
```
npx ts-node --transpile-only src/modules/omnichannel/services/outbox-worker.drain.spec.ts
```
سناریوها: drain، cancel mid-flight، resume بعد از drained، shutdown بدون resume، سیاست تایمر.

## خارج از دامنه
تغییر `TELEGRAM_API_URL`، دامنه Worker، vault توکن، انتشار واقعی.
