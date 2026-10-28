# 2026-10-28 — گزارش پیش از PR-6 (continue-119)

**Host:** Iran `tnadmin@185.213.167.61:3031` · خوانده‌شده ~12:07–12:10Z UTC · بدون retry DEAD · بدون FORCE

## ۱) PR-3 تا PR-5

| PR | GitHub | commit | deploy Iran | health | smoke | بکاپ DB |
| --- | --- | --- | --- | --- | --- | --- |
| PR-3 Idempotency | #121 | `0c8a7d3a` | بله `2026-10-28T10:52:32Z` | `/v1/health` ok | unit + migrate CI؛ index mutation زنده | **`/opt/taranom/backups/postgres/20261028T095010Z`** قبل از `20261028-001` |
| PR-4 HOLD | #124 | `32e35e14` | بله `2026-10-28T11:31:05Z` | ok؛ `/ipc` سالم | unit؛ بدون migration | لازم نبود |
| PR-5 quiet@claim | #126 | `158f0fd6` | بله `2026-10-28T12:07:35Z` | ok؛ heartbeat age≈0 | unit 160؛ بدون migration | لازم نبود |

HEAD ایران: `158f0fd6`.

## ۲) تأیید #119 (+ #122)

| چک | نتیجه |
| --- | --- |
| هشدار heartbeat کهنه | **پاک** — api و worker هر دو `/ipc` را می‌بینند؛ فایل heartbeat تازه؛ مالک `taranom` |
| تکرار `$2` / 42P08 بعد از hotfix | **نه** در لاگ از 09:00Z؛ ۳ DEAD قدیمی دست‌نخورده |
| canary بله `4858359991` | **موفق** — canary-ping پس از #119 با `providerMessageId: 264` (HTTP 201). ردیف delivery با id پیام 264 ساخته نشده (مسیر ping جداست) |
| Stalled PROCESSING | **۰** |

### سه DEAD ناشی از `$2` (بدون retry)

| delivery | کانال | مقصد | محصول | زمان UTC | علت |
| --- | --- | --- | --- | --- | --- |
| `cca8d2b3-1ab3-4347-8350-e7e60c47110c` | BALE | کانال عمده بله / `4858359991` | SKU 5047 سوئیشرت تدی کلاهدار مدل گود | 2026-10-27 15:11:36 | `inconsistent types deduced for parameter $2` |
| `7cab161d-9385-4783-b90c-8a1efb732440` | TELEGRAM | کانال عمده تلگرام / `@toliditaranom` | SKU 5047 سوئیشرت تدی کلاهدار مدل گود | 2026-10-27 15:11:22 | همان |
| `738fc8be-3ee7-4b01-9b08-192e7acc989f` | TELEGRAM | کانال عمده تلگرام / `@toliditaranom` | SKU 7148 کاپشن بامبری مموری زنانه | 2026-10-25 14:26:03 | همان |

## ۳) مالکیت `/ipc`

- Volume + مسیرها در کد (#119 compose).
- chown هنگام deploy در کد (#122 `auto-deploy.sh`) — لایو الان سبز است.
- Dockerfile/entrypoint تا این نوبت نبود → **#128** (`cb900f76`) entrypoint + `su-exec` اضافه می‌کند؛ auto-deploy chown می‌ماند.

## بعدی

PR-6 = #129 (migration `20261028-002` → بکاپ قبل از migrate روی ایران).
