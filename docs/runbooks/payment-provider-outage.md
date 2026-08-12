# Runbook — Provider outage (ZarinPal)

## Detect
- Timeouts / `PROVIDER_TIMEOUT` in start/verify logs
- Elevated `payment_failure_total`
- Provider status page / sandbox vs production mismatch

## Mitigate
1. Enable `maintenanceMode` or disable ZARINPAL in `payment_providers` (ADMIN)
2. Keep MANUAL / CASH / INSTALLMENT paths available for wholesale as business allows
3. Retail ONLINE: show clear «درگاه موقتاً در دسترس نیست» — do not guess alternate PSP

## Recover
1. Confirm provider healthy
2. Re-enable provider; smoke `POST /payments/start` on disposable/staging only
3. Watch metrics for 15 minutes
