# Acceptance checklist

Run from `apps/api` unless noted.

- `npx ts-node --transpile-only src/modules/omnichannel/omnichannel-phase-acceptance.spec.ts`
- `npx ts-node --transpile-only src/modules/omnichannel/oos-policy.spec.ts`
- Focused specs for the slice (`cms-sanitize`, `public-product-channel`, `channel-projection`, `publication-sync`, `outbox-lease`)
- `npx tsc --noEmit`

Must stay true:

- Connectors off by default
- Auto-publish off by default
- No plaintext secret in schema/response
- Public catalog/CMS cannot read the other channel
- Worker does not send Telegram while flags are off
