# Hero Banner Production Brief — 2026

## Goal
Replace current catalog-SKU heroes with 3 professional carousel plates for RETAIL + WHOLESALE (shared visuals, channel-specific copy).

## Image engine (FREE default)

| Engine | Cost | Status |
|--------|------|--------|
| **Cursor `GenerateImage`** | Free in Cursor | **Primary — use this** |
| fal.ai | Paid after free credits | Optional later (balance exhausted) |

Do **not** block on fal. Generate full-bleed plates with Cursor GenerateImage + reference photos, then upload to CMS.

## Slides

1. **Editorial Linen** — soft linen manto mood
2. **Bold Outerwear** — coat / seasonal layer
3. **Soft Sets** — ready daily set

## Pipeline

1. Intake photos from `assets/banners/hero-intake/` (or use existing product refs)
2. Generate plates with Cursor GenerateImage (16:9, no Persian text in image)
3. Site overlay already handles Persian copy via `slides[]`
4. Upload finals to MinIO → set `imageUrl` in CMS (both channels)
5. QA desktop + mobile + reduced-motion

## Locked tokens
See `docs/brand-guidelines.md` — forest `#1B5C4A` / dark `#0F2F28` / gold `#C9A84C`.

## Blockers
- [ ] User provides 6 photos (3 lifestyle + 3 product) — or approve using current catalog + hero-model refs
- [x] Free generator available (Cursor GenerateImage)
- [ ] fal optional (needs billing top-up)
