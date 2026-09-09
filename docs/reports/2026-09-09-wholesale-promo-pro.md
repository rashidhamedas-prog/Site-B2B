# Wholesale promo heroes — professional recreate

Date: 2026-09-09  
Task: TASK-20260909-019

## Problem

Previous 1920×560 WebP files were contain/extend of ~1024×409 JPGs, then a 16:9 plate stretched across 24:7. Type and photo stayed soft.

## Change

New plates: portrait fashion photos on the left (~50%), brand panel and Vazirmatn type composed in HTML, Chrome screenshot at 2× then Lanczos downscale to exact hero size, WebP q92.

| File | Size |
| --- | --- |
| partnership-d8771aca17fe.webp | 1920×560 ~90KB |
| partnership-mobile-ecf1c65e857b.webp | 1200×600 ~64KB |
| jackets-19fc4bd8d65a.webp | 1920×560 ~58KB |
| jackets-mobile-b38e5ccce891.webp | 1200×600 ~51KB |

Copy and CTAs unchanged: `/portal/register`, `/category/women-coats`. Presentation remains `artwork`.

Migration: `WholesalePromoHeroesPro1757430000019` (backup table `site_content_wholesale_promo_pro_backups`). Does not drop 012/017 backups.

## Out of scope

Retail heroes, DigiPay/Prima-Negin, Adobe App Builder.
