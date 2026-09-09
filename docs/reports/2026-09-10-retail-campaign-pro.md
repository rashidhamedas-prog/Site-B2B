# Retail campaign heroes — professional recreate

Date: 2026-09-10  
Task: TASK-20260910-020

## Problem

Live DigiPay and Prima/Negin plates on `poshaktaranom.ir` were upscaled ~1024px artwork. Prima also baked wholesale copy (عمده / `.com`).

## Change

Same method as wholesale TASK-019: portrait/lifestyle photo + Vazirmatn HTML, Chrome 2× screenshot, Lanczos to 1920×560 / 1200×600, WebP q92.

| File | Size |
| --- | --- |
| digipay retail-desktop-182e2ad9311d.webp | 1920×560 ~105KB |
| digipay retail-mobile-78fce6fbea4c.webp | 1200×600 ~70KB |
| prima retail-desktop-e6ae94c783d0.webp | 1920×560 ~105KB |
| prima retail-mobile-9c9af33ce4a9.webp | 1200×600 ~74KB |

Copy: DigiPay unchanged in meaning. Prima headline «مدل بعدی ویترینت را انتخاب کن», CTA «دیدن کت‌ها», URL `poshaktaranom.ir`. Hrefs stay `/products` and `/category/women-coats`.

`RetailHero` now prepends campaign slides in code (same pattern as wholesale).

Migration: `RetailCampaignHeroesPro1757510000020`. Does not drop 013 backups. Payment adapters untouched.

## Out of scope

Wholesale heroes, BoutiqueHero overlay template, DigiPay gateway.
