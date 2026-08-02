# قالب ورود مقاله (Import)

از پنل `/admin/blog` → دکمه **Import** یا API:

`POST /v1/blog/admin/import`

## JSON

```json
{
  "siteKey": "retail",
  "title": "برای پاییز چه مانتویی بخریم؟",
  "slug": "how-to-choose-autumn-manto",
  "excerpt": "راهنمای کامل انتخاب مانتو مناسب فصل پاییز",
  "contentFormat": "MARKDOWN",
  "content": "# برای پاییز چه مانتویی بخریم؟\n\nمتن مقاله...",
  "categorySlug": "autumn-style",
  "tags": ["مانتو پاییزه", "مانتو کتان"],
  "seo": {
    "seoTitle": "برای پاییز چه مانتویی بخریم؟ راهنمای کامل",
    "metaDescription": "برای خرید مانتو پاییزه، جنس پارچه، اندازه، رنگ و مدل مناسب را بشناسید.",
    "focusKeyword": "خرید مانتو پاییزه",
    "secondaryKeywords": ["مانتو پاییزه زنانه", "مانتو کتان"],
    "searchIntent": "COMMERCIAL",
    "canonicalType": "SELF",
    "robotsIndex": true,
    "robotsFollow": true,
    "maxImagePreview": "large"
  },
  "schema": {
    "type": "BlogPosting",
    "articleSchemaEnabled": true,
    "breadcrumbEnabled": true,
    "faqSchemaEnabled": true
  },
  "faqItems": [
    {
      "question": "برای شروع پاییز مانتوی ضخیم بخریم؟",
      "answer": "در شروع پاییز معمولاً مانتوی بین‌فصلی کاربردی‌تر است.",
      "sortOrder": 1,
      "isVisible": true,
      "includeInSchema": true
    }
  ],
  "tableOfContentsEnabled": true,
  "sitemapEnabled": true,
  "sitemapPriority": 0.8,
  "rssEnabled": true
}
```

`siteKey`: `retail` | `wholesale`  
مقاله همیشه به‌صورت **DRAFT** وارد می‌شود.

## Markdown

متن با `# عنوان` در خط اول؛ بقیه به‌عنوان content. کانال از تب فعال ادمین گرفته می‌شود.

## cURL

```bash
curl -X POST "$API/v1/blog/admin/import" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @article.json
```
