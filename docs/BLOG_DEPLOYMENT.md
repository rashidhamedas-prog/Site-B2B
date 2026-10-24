# استقرار ماژول وبلاگ

## Migration

روی سرور بعد از pull:

```bash
# داخل کانتینر API یا با data-source پروژه
npm run migration:run --workspace=apps/api
```

مهاجرت‌های مرتبط:

- `20260802-001-advanced-blog-seo-module.ts`
- `20260802-002-blog-phase2-extensions.ts`

اسکریپت `auto-deploy.sh` معمولاً schema safety-net را هم اعمال می‌کند.

## Env

```env
NEXT_PUBLIC_API_URL=https://api.poshaktaranom.com/v1
NEXT_PUBLIC_SITE_URL=https://poshaktaranom.com
NEXT_PUBLIC_RETAIL_URL=https://poshaktaranom.ir
NEXT_PUBLIC_GA4_WHOLESALE_ID=G-XXXX
NEXT_PUBLIC_GA4_RETAIL_ID=G-YYYY
# یا از ادمین → تنظیمات → Google
BLOG_ALLOW_FALLBACK=0
```

## Deploy

```bash
git push origin master
# Sole Iran origin — never Hetzner
ssh -p 3031 -i ~/.ssh/id_ed25519_taranom_storefront_ir -o IdentitiesOnly=yes tnadmin@185.213.167.61 \
  'cd /opt/taranom && bash scripts/auto-deploy.sh'
```

## Smoke

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.poshaktaranom.com/v1/health
curl -s -o /dev/null -w '%{http_code}\n' https://poshaktaranom.com/blog
curl -s -o /dev/null -w '%{http_code}\n' https://poshaktaranom.ir/blog
```
