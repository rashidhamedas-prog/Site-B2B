---
name: web-design-guidelines
description: Vercel Web Interface Guidelines. Use when reviewing storefront UI, accessibility, motion, and CTA focus.
metadata:
  author: vercel
  version: "1.0.0"
---

# Web Interface Guidelines

Installed from vercel-labs/agent-skills (30k+ stars). Fresh rules: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Hard rules applied in this pass:

- Icon-only controls need `aria-label`
- Links are `<a>`/`<Link>`, not clickable divs
- Visible `:focus-visible` on ticker pause and CTAs
- Animate `transform`/`opacity` only; no `transition: all`
- Autoplay motion longer than 5s has pause/stop
- `prefers-reduced-motion` disables the ticker loop
- Above-fold hero keeps a single LCP image
- Specific CTA labels, active voice
- Flex children that truncate need `min-w-0`
