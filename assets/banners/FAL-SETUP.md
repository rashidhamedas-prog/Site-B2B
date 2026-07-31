# fal.ai setup — پوشاک ترنم

## Status (2026-07-30)

| Item | Status |
|------|--------|
| `FAL_KEY` in Windows User env | Set |
| API auth (`Authorization: Key …`) | OK (HTTP 200) |
| Image generation | **Blocked — exhausted balance** |
| Cursor MCP header | `Key ${env:FAL_KEY}` (not Bearer) |

## Your next steps

1. Top up: https://fal.ai/dashboard/billing  
2. Fully quit & reopen Cursor (so MCP reads `FAL_KEY`)  
3. Drop **6 photos** into `assets/banners/hero-intake/` (see README there)  
4. Tell the agent: «شروع طراحی بنر»

## Security

The API key was pasted in chat. After topping up, consider rotating the key in fal dashboard and updating the Windows `FAL_KEY` env var.
