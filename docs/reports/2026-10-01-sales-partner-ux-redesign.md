# گزارش — بازطراحی UX همکار بازاریاب

تاریخ: 2026-10-01  
Task: `TASK-20261001-003`  
دامنه: لندینگ apply + پنل `/sales-partners` + تأیید مشتری

## خلاصه

UI/UX موبایل‌اول برای همکار بازاریاب، بدون تغییر قرارداد API یا قوانین پول. تمرکز روی درک سریع برای کاربر غیرفنی، دکمه/موشن سبک، و یکدست بودن ظاهر.

## Smoke قبل از تغییر

| چک | نتیجه |
|---|---|
| `GET /.ir/sales-partnership` | 200 |
| `GET /.ir/sales-partnership/terms` | 200 |
| `GET /.ir/sales-partners/login` | 200 |
| `GET api…/public-settings` | `enabled=true`, `applyOpen=true`, terms `2026-09-23-v1` final |
| `GET api…/sales-partners/me` بدون توکن | 401 |

پنل احرازشده: residual — حساب ACTIVE تست در این نوبت کلیک نشد؛ empty/loading/error در UI پوشش داده شد.

## تغییرها

- `SpUi` + `SalesPartnerShell`: دکمه، toast، skeleton، step rail، nav آیکون‌دار
- Apply / Home / Catalog / Orders / NewOrder wizard / Reports / Commissions / Payouts / Profile / Guide / Confirm / Order detail
- Labels انسانی‌تر در `sp-labels` + `spDraftNextStep`

## غیرهدف

- ادمین `/admin/sales-partners`
- درصد پورسانت / ledger / attribution
- Vendor `/partners`

## پذیرش

- `apps/web` tsc: 0 errors
- بدون waterfall/JS سنگین روی لندینگ CMS
- موشن با `prefers-reduced-motion` و مدت کوتاه
