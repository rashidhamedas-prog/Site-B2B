# Omnichannel PR-10 — channel settings + templates (2026-10-29)

## Summary
Per-destination channel settings (REQ-C10): content + `ownerChatId` («آی‌دی مقصد هدایت پیام‌ها»), footer, order-bot fields, UTM; templates activate with ضدآب guard + cross-channel contamination warn/block; UI behind `OMNICHANNEL_CHANNEL_SETTINGS_UI` / `OMNICHANNEL_TEMPLATES_UI` (default off). Cap/gap/quiet remain per-destination.

## Evidence
- Unit: `channel-settings`, `template-claim-guard`, `cross-channel-contamination`, `omnichannel-settings.service`, `publication-template`, `omnichannel-health`, web channel-settings + templates specs; `apps/api` + `apps/web` `tsc --noEmit` clean.
- Composer consumes per-destination `showPriceDefault` (never invents true).
- No invented LIVE ids / `ownerChatId` defaults empty for Hamed.
- No Telegram egress / connector enable / FORCE / SMS / migration (nested `publishSettings.channelSettings`).

## Deploy
GO حامد ۲۹ اکتبر ۲۰۲۶ for package; merge/deploy after CI green + deploy-approval for exact SHA.
