# Design System Master File — پوشاک ترنم

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** پوشاک ترنم  
**Updated:** 2026-07-21  
**Category:** B2B Wholesale Fashion (Manufacturing)  
**Style:** Trust & Authority + Soft UI Evolution + Glass accents  
**Direction:** RTL (فارسی)

Glass evolution (2026-07-22): frosted surfaces via `--glass-*` tokens (default blur 12px). Keep emerald+gold palette locked. Do not swap to rose/pink or full glassmorphism rewrite.

---

## Global Rules

### Color Palette (Brand Locked)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1B5C4A` | `--color-primary` |
| Primary Light | `#2D7A5F` | `--color-primary-light` |
| Primary Dark | `#124035` | `--color-primary-dark` |
| Secondary / Gold | `#C9A84C` | `--color-secondary` |
| Secondary Light | `#E5C97C` | `--color-secondary-light` |
| Secondary Dark | `#A88530` | `--color-secondary-dark` |
| Background | `#FAFBF9` | `--color-background` |
| Surface | `#FFFFFF` | `--color-surface` |
| Surface Muted | `#F3F6F4` | `--color-surface-muted` |
| Foreground | `#111827` | `--color-foreground` |
| Muted Text | `#6B7280` | `--color-muted` |
| Border | `#E5E9E6` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |

**Notes:** Emerald green + warm gold. No navy swap. No AI purple/pink gradients.

### Typography

- **Font:** Vazirmatn (all weights 400–800) — Persian RTL
- **Mood:** Refined wholesale / premium manufacturing
- **Do not use:** Cormorant, Montserrat, Inter, Roboto as primary

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Icon gaps |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Card padding |
| `--space-xl` | `32px` | Large gaps |
| `--space-2xl` | `48px` | Section gaps |
| `--space-3xl` | `72px` | Section vertical (mobile+) |
| `--space-4xl` | `96px` | Section vertical (lg) |

### Shadows (Soft UI)

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(27,92,74,0.04)` | Subtle |
| `--shadow-md` | `0 4px 16px rgba(27,92,74,0.07)` | Interactive cards |
| `--shadow-lg` | `0 12px 32px rgba(27,92,74,0.12)` | Hover / elevated |
| `--shadow-xl` | `0 24px 48px rgba(18,64,53,0.18)` | Hero depth |

### Motion

- Duration: 150–300ms ease
- Reveal: `opacity + translateY(16px)` staggered
- Respect `prefers-reduced-motion: reduce`

---

## Style Guidelines

**Pattern:** Trust & Authority + Feature Showcase  
**CTA:** Above fold + repeated after social proof  
**Effects:** Soft shadows, glass accents (`backdrop-filter` 10–20px), gentle hover lift, metric reveal, editorial product grids

### Anti-Patterns

- Playful / chaotic design
- Floating badges / promo chips on hero media
- Stats / schedules inside first viewport hero
- AI purple gradients, neon, heavy multi-layer shadows
- Emojis as icons (use Lucide)
- Dense card grids in hero

---

## Pre-Delivery Checklist

- [ ] No emojis as icons
- [ ] `cursor-pointer` on clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Contrast ≥ 4.5:1
- [ ] Focus-visible states
- [ ] `prefers-reduced-motion`
- [ ] Responsive: 375 / 768 / 1024 / 1440
